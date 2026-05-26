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
    console.error('[qotd-morning] VAPID keys not configured. NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.');
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
    console.warn('[qotd-morning] Unauthorized request — CRON_SECRET mismatch or missing.');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: subs, error } = await supabase.from('web_push_subscriptions').select('*');
    if (error) throw error;

    if (!subs || subs.length === 0) {
      console.log('[qotd-morning] No subscriptions found in web_push_subscriptions table.');
      return NextResponse.json({ success: true, message: 'No subscriptions found.', counts: { total: 0 } });
    }

    console.log(`[qotd-morning] Found ${subs.length} subscription(s). Sending notifications...`);

    const payload = JSON.stringify({
      title: 'Question of the Day',
      body: 'A new high-yield question is ready! Review it before Noon Conference.'
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;
    let skipped = 0;

    const notifications = subs.map(async (sub) => {
      // Validate required fields
      if (!sub.p256dh || !sub.auth || !sub.endpoint) {
        console.warn(`[qotd-morning] Skipping subscription ${sub.id}: missing p256dh, auth, or endpoint.`);
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
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[qotd-morning] Subscription expired (${err.statusCode}), deleting: ${sub.endpoint.slice(0, 60)}...`);
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
          expired++;
        } else {
          console.error(`[qotd-morning] Push failed for ${sub.endpoint.slice(0, 60)}...:`, err.statusCode, err.body || err.message);
          failed++;
        }
      }
    });

    await Promise.allSettled(notifications);

    const summary = { total: subs.length, sent, failed, expired, skipped };
    console.log('[qotd-morning] Complete:', JSON.stringify(summary));
    return NextResponse.json({ success: true, message: `Morning QOTD notifications processed.`, counts: summary });

  } catch (err: any) {
    console.error('[qotd-morning] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
