import { NextResponse } from 'next/server';
import { requireAdminOnly } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await requireAdminOnly(request);
  if (!authResult.authorized || !authResult.adminSupabase) {
    return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = authResult.adminSupabase;

  try {
    let cronLogs = [];
    let receipts = [];
    let subs = [];
    let roster = [];

    // 1. Fetch Cron Logs (Push Dispatches)
    try {
      const { data, error } = await supabase
        .from('cron_logs')
        .select('*')
        .in('cron_name', ['qotd-morning', 'qotd-reminder', 'qotd-noon', 'manual_broadcast'])
        .order('executed_at', { ascending: false })
        .limit(50);
      if (!error && data) cronLogs = data;
    } catch (e) { console.warn('Failed to fetch cron_logs'); }

    // 2. Fetch Push Receipts
    try {
      const { data, error } = await supabase
        .from('push_receipts')
        .select('*')
        .order('delivered_at', { ascending: false })
        .limit(200);
      if (!error && data) receipts = data;
    } catch (e) { console.warn('Failed to fetch push_receipts'); }

    // 3. Fetch web_push_subscriptions and map to emails
    try {
      const { data, error } = await supabase
        .from('web_push_subscriptions')
        .select('endpoint, created_at, user_id');
      if (!error && data) subs = data;
    } catch (e) { console.warn('Failed to fetch web_push_subscriptions'); }

    // We fetch profiles to map user_id to email manually
    let profileMap = new Map();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      if (!error && data) profileMap = new Map(data.map(p => [p.id, p]));
    } catch (e) { console.warn('Failed to fetch profiles'); }

    const enrichedSubs = subs.map((sub: any) => ({
      ...sub,
      email: profileMap.get(sub.user_id)?.email || 'unknown',
      full_name: profileMap.get(sub.user_id)?.full_name || 'unknown'
    }));

    // 4. Fetch roster to show who has NOT registered
    try {
      const { data, error } = await supabase
        .from('authorized_roster')
        .select('email, name, pgy_override')
        .eq('status', 'active');
      if (!error && data) roster = data;
    } catch (e) { console.warn('Failed to fetch roster'); }

    return NextResponse.json({
      success: true,
      logs: cronLogs,
      receipts,
      subscriptions: enrichedSubs,
      roster
    });
  } catch (err: unknown) {
    console.error('[push-audit] Error:', (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ error: 'Failed to fetch audit data' }, { status: 500 });
  }
}


