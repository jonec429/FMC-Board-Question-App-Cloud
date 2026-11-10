import { NextResponse } from 'next/server';
import { getAdminSupabase, verifyCronSecret } from '@/lib/supabaseServer';
import { Resend } from 'resend';
import webpush from 'web-push';
import { getEasternDateParts, getEasternUpcomingSunday, getEasternTimeString } from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');

export async function GET(request: Request) {
  try {
    if (!verifyCronSecret(request)) {
      console.warn('Unauthorized block reminder cron attempt.');
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = getAdminSupabase();

    // Early Trigger Guard (DST-safety): Target is Thursday 9:00 AM Eastern.
    const estParts = getEasternDateParts();
    const estTimeStr = getEasternTimeString();
    if (estParts.hour < 8) {
      console.log(`[block-reminders] Early trigger received at ${estTimeStr} Eastern (target 09:00). Skipping.`);
      return NextResponse.json({ success: true, message: `Skipped early trigger at ${estTimeStr} Eastern.` });
    }

    // Get dates strictly in Eastern Time (America/New_York)
    // This cron runs on Thursday. The due date is the upcoming Sunday at 11:59 PM.
    const sundayDateStr = getEasternUpcomingSunday();

    // Find if there is a block due on this upcoming Sunday
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('block_schedule')
      .select('block_id, end_date, blocks(title)')
      .eq('end_date', sundayDateStr)
      .limit(1)
      .maybeSingle();

    if (scheduleError) {
      throw new Error(`Failed to fetch block schedule: ${scheduleError.message}`);
    }

    if (!scheduleData || !scheduleData.block_id) {
      console.log('No block is due this upcoming Sunday. Exiting.');
      return NextResponse.json({ success: true, message: 'No block due.' });
    }

    // Supabase types relation as array or single object depending on constraints
    const blocksData = scheduleData.blocks as { title?: string } | { title?: string }[];
    const blockTitle = (Array.isArray(blocksData) ? blocksData[0]?.title : blocksData?.title) || 'the current block';

    // Get all active residents from authorized_roster (strictly excluding faculty and graduated/on-leave)
    const { data: roster, error: rosterError } = await supabase
      .from('authorized_roster')
      .select('email, name, pgy, track, role, status');

    if (rosterError) {
      throw new Error(`Failed to fetch roster: ${rosterError.message}`);
    }

    // Find who has completed the block
    const { data: results, error: resultsError } = await supabase
      .from('results')
      .select('legacy_email')
      .eq('topic', blockTitle);

    if (resultsError) {
      throw new Error(`Failed to fetch results: ${resultsError.message}`);
    }

    const completedEmails = new Set(results.map(r => r.legacy_email.toLowerCase()));

    const activeResidents = (roster || []).filter(r =>
      r.email &&
      r.status !== 'graduated' &&
      r.status !== 'on_leave' &&
      r.track !== 'faculty' &&
      (r.pgy || '').toLowerCase() !== 'faculty' &&
      (r.role || '').toLowerCase() !== 'faculty' &&
      (r.role || '').toLowerCase() !== 'admin'
    );

    // Find residents who have NOT completed the block
    const missingUsers = activeResidents.filter(r => !completedEmails.has(r.email.toLowerCase()));

    if (missingUsers.length === 0) {
      console.log('All residents have completed the block. Great job!');
      return NextResponse.json({ success: true, message: 'Everyone completed the block!' });
    }

    console.log(`Found ${missingUsers.length} residents who have not completed ${blockTitle}. Sending reminders...`);

    // Prepare Web Push
    let pushPayload = JSON.stringify({
      title: 'Block Reminder',
      body: `Don't forget! ${blockTitle} is due this Sunday at 11:59 PM.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      url: '/',
    });
    
    // Set VAPID details if configured
    let pushEnabled = false;
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:admin@example.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      pushEnabled = true;
    }

    const failedEmails: string[] = [];
    
    // Send notifications
    for (const user of missingUsers) {
      // 1. Send Email via Resend
      if (process.env.RESEND_API_KEY) {
        try {
          await resend.emails.send({
            from: 'FMC Board Prep <noreply@fmcboardprep.com>',
            to: [user.email],
            subject: `Action Required: ${blockTitle} is due this Sunday!`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4f46e5;">Friendly Reminder!</h2>
                <p>Hi ${user.name.split(' ')[0]},</p>
                <p>This is a quick reminder that <strong>${blockTitle}</strong> is due this coming Sunday at 11:59 PM.</p>
                <p>Please log in and complete the block to maintain your streaks and stay on track!</p>
                <a href="https://${request.headers.get('host') || 'fmc-board-prep.vercel.app'}/" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;">Go to Dashboard</a>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr);
          failedEmails.push(user.email);
        }
      }

      // 2. Send Web Push
      if (pushEnabled) {
        // Find their push subscriptions. We need their user_id from the profiles table.
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, notification_preferences')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();

        if (profile?.id) {
          const prefs = (profile.notification_preferences as Record<string, unknown>) || {};
          if (prefs.block_reminders !== false) {
            const { data: subs } = await supabase
            .from('web_push_subscriptions')
            .select('*')
            .eq('user_id', profile.id);

          if (subs && subs.length > 0) {
            for (const sub of subs) {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  auth: sub.keys_auth,
                  p256dh: sub.keys_p256dh,
                },
              };
              try {
                await webpush.sendNotification(pushSubscription, pushPayload);
              } catch (pushErr: unknown) {
                const status = (pushErr as { statusCode?: number }).statusCode;
                if (status === 401 || status === 403 || status === 404 || status === 410) {
                  // Subscription expired or invalid, remove it
                  await supabase.from('web_push_subscriptions').delete().eq('id', sub.id);
                }
              }
            }
          }
        }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: missingUsers.length,
      failedEmails,
      message: `Sent reminders for ${blockTitle}`
    });

  } catch (error: unknown) {
    console.error('Cron block-reminders error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
