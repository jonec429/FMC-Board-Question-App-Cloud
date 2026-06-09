import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  let isAuthorized = false;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const callerEmail = user.email || '';
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();

    const isAdmin = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail.toLowerCase()) || profile?.role === 'admin';
    if (isAdmin) isAuthorized = true;
  } catch (err) {
    return NextResponse.json({ error: 'Auth validation error' }, { status: 401 });
  }

  if (!isAuthorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // 1. Fetch Cron Logs (Push Dispatches)
    const { data: cronLogs, error: cronError } = await supabase
      .from('cron_logs')
      .select('*')
      .in('cron_name', ['qotd-morning', 'qotd-noon', 'manual_broadcast'])
      .order('executed_at', { ascending: false })
      .limit(50);
    if (cronError) throw cronError;

    // 2. Fetch Push Receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('push_receipts')
      .select('*')
      .order('delivered_at', { ascending: false })
      .limit(200);
    if (receiptsError) throw receiptsError;

    // 3. Fetch web_push_subscriptions and map to emails
    const { data: subs, error: subsError } = await supabase
      .from('web_push_subscriptions')
      .select('endpoint, created_at, user_id');
    if (subsError) throw subsError;

    // We fetch profiles to map user_id to email manually
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name');
    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const enrichedSubs = subs.map(sub => ({
      ...sub,
      email: profileMap.get(sub.user_id)?.email || 'unknown',
      full_name: profileMap.get(sub.user_id)?.full_name || 'unknown'
    }));

    // 4. Fetch roster to show who has NOT registered
    const { data: roster, error: rosterError } = await supabase
      .from('authorized_roster')
      .select('email, full_name, pgy_level')
      .eq('is_active', true);
    if (rosterError) throw rosterError;

    return NextResponse.json({
      success: true,
      logs: cronLogs,
      receipts,
      subscriptions: enrichedSubs,
      roster
    });
  } catch (err: any) {
    console.error('[push-audit] Error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch audit data' }, { status: 500 });
  }
}
