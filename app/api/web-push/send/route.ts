import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
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

  // Authenticate request
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) {
    console.warn('[web-push/send] Unauthorized request — Authorization header missing.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  let isAuthorized = false;
  let callerEmail = '';

  if (token === process.env.CRON_SECRET) {
    isAuthorized = true;
    callerEmail = 'cron-system';
  } else {
    // Verify using Supabase token
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.warn('[web-push/send] Unauthorized request — Invalid Supabase user token.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      callerEmail = user.email || '';

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const isAdmin =
        SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail.toLowerCase()) ||
        profile?.role === 'admin';

      if (isAdmin) {
        isAuthorized = true;
      }
    } catch (err) {
      console.error('[web-push/send] Auth validation failed:', err);
      return NextResponse.json({ error: 'Auth validation error' }, { status: 401 });
    }
  }

  if (!isAuthorized) {
    console.warn(`[web-push/send] Forbidden request — User ${callerEmail} is not an administrator.`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    const notifications = subs.map(async (sub) => {
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
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[web-push/send] Subscription expired (${err.statusCode}), deleting: ${sub.endpoint.slice(0, 60)}...`);
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
          expired++;
        } else {
          console.error(`[web-push/send] Push failed for ${sub.endpoint.slice(0, 60)}...:`, err.statusCode, err.body || err.message);
          failed++;
        }
      }
    });

    await Promise.allSettled(notifications);

    const summary = { total: subs.length, sent, failed, expired, skipped };
    console.log('[web-push/send] Dispatch complete:', JSON.stringify(summary));
    
    // Log the manual broadcast
    await supabase.from('cron_logs').insert({
      cron_name: 'manual_broadcast',
      status: 'success',
      details: { ...summary, run_id, title, body, sent_by: callerEmail }
    });

    // Cleanup receipts older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await supabase.from('push_receipts').delete().lt('delivered_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      success: true,
      message: `Notification dispatch complete.`,
      counts: summary
    });

  } catch (err: any) {
    console.error('[web-push/send] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  let isAuthorized = false;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerEmail = user.email || '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin =
      SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail.toLowerCase()) ||
      profile?.role === 'admin';

    if (isAdmin) {
      isAuthorized = true;
    }
  } catch (err) {
    return NextResponse.json({ error: 'Auth validation error' }, { status: 401 });
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { count, error } = await supabase
      .from('web_push_subscriptions')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
