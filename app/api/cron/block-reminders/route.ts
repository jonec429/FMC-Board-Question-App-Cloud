import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      console.warn('Unauthorized block reminder cron attempt.');
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get dates
    const today = new Date();
    // This cron runs on Thursday. The due date is the upcoming Sunday.
    // Sunday is 3 days away from Thursday.
    const upcomingSunday = new Date(today);
    upcomingSunday.setDate(today.getDate() + 3);
    const sundayDateStr = upcomingSunday.toISOString().split('T')[0];

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
    const blocksData: any = scheduleData.blocks;
    const blockTitle = (Array.isArray(blocksData) ? blocksData[0]?.title : blocksData?.title) || 'the current block';

    // Get all residents from authorized_roster
    const { data: roster, error: rosterError } = await supabase
      .from('authorized_roster')
      .select('email, name, pgy')
      .neq('pgy', 'Faculty');

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

    // Find users who have NOT completed the block
    const missingUsers = roster.filter(r => r.email && !completedEmails.has(r.email.toLowerCase()));

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
          const prefs: any = profile.notification_preferences || {};
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
              } catch (pushErr: any) {
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
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

  } catch (error: any) {
    console.error('Cron block-reminders error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
