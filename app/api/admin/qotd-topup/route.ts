import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';

// Service-role client (mirrors app/api/admin/push-audit). Bypasses RLS; gated by
// the admin check below before any privileged work is done.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Admin-only: extend the Daily Question schedule with newly-imported questions.
 * Delegates to the qotd_topup() Postgres function (20260608_qotd_topup.sql), which
 * rebuilds only future dates from never-used questions — "frozen past, fresh future".
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const callerEmail = user.email || '';
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isAdmin =
      SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail.toLowerCase()) ||
      profile?.role === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: 'Auth validation error' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase.rpc('qotd_topup');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: true,
      added: row?.added ?? 0,
      last_day: row?.last_day ?? null,
    });
  } catch (err: any) {
    console.error('[qotd-topup] Error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Top-up failed' }, { status: 500 });
  }
}
