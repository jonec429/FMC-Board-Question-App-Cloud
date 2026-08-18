import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  // Validate VAPID keys are configured
  if (!publicKey || !privateKey) {
    console.error('[faculty-digest] VAPID keys not configured.');
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
    console.warn('[faculty-digest] Unauthorized request — CRON_SECRET mismatch or missing.');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Bi-weekly logic: start June 29, 2026. Only run if it's an even number of weeks since then.
    // June 29, 2026 is a Monday.
    const startDate = new Date('2026-06-29T00:00:00Z');
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

    // Wait, if it runs on June 29, diffWeeks is 0 (even), so it runs.
    // Next week (July 6), diffWeeks is 1 (odd), so it skips.
    // Next week (July 13), diffWeeks is 2 (even), so it runs.
    if (diffWeeks % 2 !== 0) {
      console.log(`[faculty-digest] Off-week (Week ${diffWeeks} since start). Skipping push notifications.`);
      return NextResponse.json({ success: true, message: 'Skipped (off-week)' });
    }

    // Find all faculty users
    const { data: facultyProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, notification_preferences')
      .in('role', ['faculty', 'admin']);
    
    if (profileError) throw profileError;

    // Filter out users who have opted out of the faculty digest
    const optedInFaculty = facultyProfiles?.filter(p => 
      p.notification_preferences?.faculty_digest !== false
    ) || [];

    if (optedInFaculty.length === 0) {
      console.log('[faculty-digest] No faculty users found with digest notifications enabled.');
      return NextResponse.json({ success: true, message: 'No faculty found', counts: { total: 0 } });
    }

    const facultyIds = optedInFaculty.map(p => p.id);

    // Get their push subscriptions
    const { data: subs, error: subsError } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .in('user_id', facultyIds);

    if (subsError) throw subsError;

    if (!subs || subs.length === 0) {
      console.log('[faculty-digest] No subscriptions found for faculty.');
      return NextResponse.json({ success: true, message: 'No subscriptions found for faculty.', counts: { total: 0 } });
    }

    const run_id = crypto.randomUUID();
    console.log(`[faculty-digest] Found ${subs.length} subscription(s) for faculty. Sending notifications... (Run ID: ${run_id})`);

    // The ?admin=performance deep link will be handled in the service worker.
    const payload = JSON.stringify({
      title: 'Advisor Digest',
      body: 'Your bi-weekly resident performance report is ready. Tap to review advisee progress.',
      data: { run_id, url: '/?admin=performance' }
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;
    let skipped = 0;

    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < subs.length; i += BATCH_SIZE) {
      const batch = subs.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (sub) => {
        if (!sub.p256dh || !sub.auth || !sub.endpoint) {
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
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 401 || status === 403 || status === 404 || status === 410) {
            console.log(`[faculty-digest] Subscription invalid/expired (${status}), deleting: ${sub.endpoint.slice(0, 60)}...`);
            await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
            expired++;
          } else {
            console.error(`[faculty-digest] Push failed for ${sub.endpoint.slice(0, 60)}...:`, status, (err as { body?: string }).body || (err instanceof Error ? err.message : String(err)));
            failed++;
          }
        }
      });

      await Promise.allSettled(batchPromises);

      // Sleep before next batch to prevent rate-limiting/socket congestion
      if (i + BATCH_SIZE < subs.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const summary = { total: subs.length, sent, failed, expired, skipped };
    console.log('[faculty-digest] Complete:', JSON.stringify(summary));
    
    // Log to Supabase
    await supabase.from('cron_logs').insert({
      cron_name: 'faculty-digest',
      status: 'success',
      details: { ...summary, run_id }
    });

    return NextResponse.json({ success: true, message: `Faculty digest notifications processed.`, counts: summary });

  } catch (err: unknown) {
    console.error('[faculty-digest] Fatal error:', err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}



