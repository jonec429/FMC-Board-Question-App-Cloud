import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  // Validate VAPID keys are configured
  if (!publicKey || !privateKey) {
    console.error('[qotd-noon] VAPID keys not configured. NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.');
    return NextResponse.json({ success: false, error: 'VAPID keys not configured' }, { status: 500 });
  }

  webpush.setVapidDetails(
    'mailto:jonathan.carbungco@ascension.org',
    publicKey,
    privateKey
  );

  // Verify Vercel Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[qotd-noon] Unauthorized request — CRON_SECRET mismatch or missing.');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: subs, error } = await supabase.from('web_push_subscriptions').select('*');
    if (error) throw error;

    if (!subs || subs.length === 0) {
      console.log('[qotd-noon] No subscriptions found in web_push_subscriptions table.');
      return NextResponse.json({ success: true, message: 'No subscriptions found.', counts: { total: 0 } });
    }

    const { data: profs } = await supabase.from('profiles').select('id, notification_preferences');
    const prefsMap = new Map((profs || []).map(p => [p.id, p.notification_preferences || {}]));

    // Find today's QOTD question ID
    const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}-${String(estDate.getDate()).padStart(2, '0')}`;

    const { data: qotdSchedule } = await supabase
      .from('qotd_schedule')
      .select('question_id')
      .eq('schedule_date', todayStr)
      .maybeSingle();

    if (!qotdSchedule) {
      console.log('[qotd-noon] No QOTD scheduled for today.');
      return NextResponse.json({ success: true, message: 'No QOTD scheduled.', counts: { total: 0 } });
    }

    // Find users who have already attempted today's QOTD
    const { data: attempts } = await supabase
      .from('question_attempts')
      .select('user_id')
      .eq('question_id', qotdSchedule.question_id);

    const attemptedUserIds = new Set((attempts || []).map(a => a.user_id));

    const targetSubs = subs.filter(sub => {
      const prefs: any = prefsMap.get(sub.user_id) || {};
      if (prefs.qotd_reminder === false) return false;
      if (attemptedUserIds.has(sub.user_id)) return false;
      return true;
    });

    if (targetSubs.length === 0) {
      console.log('[qotd-noon] No subscriptions opted in for QOTD reminder push.');
      return NextResponse.json({ success: true, message: 'No users opted in.', counts: { total: 0 } });
    }

    const run_id = crypto.randomUUID();
    console.log(`[qotd-noon] Found ${targetSubs.length} opted-in subscription(s) out of ${subs.length}. Sending notifications... (Run ID: ${run_id})`);

    const payload = JSON.stringify({
      title: 'Question of the Day',
      body: 'Today\'s QOTD is still waiting for you. Complete it before the day ends!',
      data: { run_id }
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;
    let skipped = 0;

    const notifications = targetSubs.map(async (sub) => {
      // Validate required fields
      if (!sub.p256dh || !sub.auth || !sub.endpoint) {
        console.warn(`[qotd-noon] Skipping subscription ${sub.id}: missing p256dh, auth, or endpoint.`);
        skipped++;
        return;
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err: unknown) {
        if ((err as any).statusCode === 404 || (err as any).statusCode === 410) {
          console.log(`[qotd-noon] Subscription expired (${(err as any).statusCode}), deleting: ${sub.endpoint.slice(0, 60)}...`);
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
          expired++;
        } else {
          console.error(`[qotd-noon] Push failed for ${sub.endpoint.slice(0, 60)}...:`, (err as any).statusCode, (err as any).body || (err instanceof Error ? err.message : String(err)));
          failed++;
        }
      }
    });

    await Promise.allSettled(notifications);

    const summary = { total: targetSubs.length, sent, failed, expired, skipped };
    console.log('[qotd-noon] Complete:', JSON.stringify(summary));
    
    // Log to Supabase
    await supabase.from('cron_logs').insert({
      cron_name: 'qotd-noon',
      status: 'success',
      details: { ...summary, run_id }
    });

    // Cleanup receipts older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { error: cleanupError } = await supabase
      .from('push_receipts')
      .delete()
      .lt('delivered_at', thirtyDaysAgo.toISOString());
    
    if (cleanupError) {
      console.error('[qotd-noon] Failed to prune old push receipts:', cleanupError);
    }

    return NextResponse.json({ success: true, message: `Noon QOTD notifications processed.`, counts: summary });

  } catch (err: unknown) {
    console.error('[qotd-noon] Fatal error:', err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}



