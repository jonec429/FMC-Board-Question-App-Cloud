import { NextResponse } from 'next/server';
import webpush from 'web-push';
import {
  getAdminSupabase,
  recordPushDispatchFailure,
  PushDispatchError,
  verifyCronSecret,
  requireAdminOnly,
} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = getAdminSupabase();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  // Validate VAPID keys are configured
  if (!publicKey || !privateKey) {
    console.error('[web-push/send] VAPID keys not configured. NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.');
    return NextResponse.json({ success: false, error: 'VAPID keys not configured' }, { status: 500 });
  }

  webpush.setVapidDetails(
    'mailto:jonathan.carbungco@ascension.org',
    publicKey,
    privateKey
  );

  // Authenticate request: CRON_SECRET or strict Admin role
  let callerEmail = '';
  if (verifyCronSecret(request)) {
    callerEmail = 'cron-system';
  } else {
    const authResult = await requireAdminOnly(request);
    if (!authResult.authorized || !authResult.user) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    callerEmail = authResult.user.email || '';
  }

  try {
    const { title, body, targetUserId } = await request.json();
    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Query subscriptions
    let query = supabase.from('web_push_subscriptions').select('*');
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: subs, error: queryError } = await query;
    if (queryError) throw queryError;

    if (!subs || subs.length === 0) {
      console.log(`[web-push/send] No subscriptions found for targetUserId: ${targetUserId || 'ALL'}`);
      return NextResponse.json({ success: true, message: 'No subscriptions found to notify.', counts: { total: 0, sent: 0 } });
    }

    const run_id = crypto.randomUUID();
    console.log(`[web-push/send] Dispatching notifications to ${subs.length} devices (Requested by: ${callerEmail})... (Run ID: ${run_id})`);

    const payload = JSON.stringify({
      title,
      body,
      data: { run_id }
    });
    let sent = 0;
    let failed = 0;
    let expired = 0;
    let skipped = 0;
    const pushErrors: PushDispatchError[] = [];

    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < subs.length; i += BATCH_SIZE) {
      const batch = subs.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (sub) => {
        if (!sub.p256dh || !sub.auth || !sub.endpoint) {
          console.warn(`[web-push/send] Skipping subscription ${sub.id}: missing p256dh, auth, or endpoint.`);
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
          await webpush.sendNotification(pushSubscription, payload, { urgency: 'high', TTL: 14400 });
          sent++;
        } catch (err: unknown) {
          const outcome = await recordPushDispatchFailure(supabase, 'web-push/send', sub, err, pushErrors);
          if (outcome === 'expired') {
            expired++;
          } else {
            failed++;
          }
        }
      });

      await Promise.allSettled(batchPromises);

      if (i + BATCH_SIZE < subs.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const summary = { total: subs.length, sent, failed, expired, skipped };
    console.log('[web-push/send] Dispatch complete:', JSON.stringify(summary));
    
    // Log the manual broadcast
    await supabase.from('cron_logs').insert({
      cron_name: 'manual_broadcast',
      status: 'success',
      details: { ...summary, run_id, title, body, sent_by: callerEmail, ...(pushErrors.length > 0 ? { errors: pushErrors.slice(0, 15) } : {}) }
    });

    // Cleanup receipts older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await supabase.from('push_receipts').delete().lt('delivered_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      success: true,
      message: `Notification dispatch complete.`,
      counts: summary,
      errors: pushErrors.slice(0, 15)
    });

  } catch (err: unknown) {
    console.error('[web-push/send] Fatal error:', err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authResult = await requireAdminOnly(request);
  if (!authResult.authorized || !authResult.adminSupabase) {
    return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { count, error } = await authResult.adminSupabase
      .from('web_push_subscriptions')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}



