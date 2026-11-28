import { NextResponse } from 'next/server';
import { requireAdminOnly } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Admin-only: extend the Daily Question schedule with newly-imported questions.
 * Delegates to the qotd_topup() Postgres function (20260608_qotd_topup.sql), which
 * rebuilds only future dates from never-used questions — "frozen past, fresh future".
 */
export async function POST(request: Request) {
  const authResult = await requireAdminOnly(request);
  if (!authResult.authorized || !authResult.adminSupabase) {
    return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = authResult.adminSupabase;

  try {
    const { data, error } = await supabase.rpc('qotd_topup');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: true,
      added: row?.added ?? 0,
      last_day: row?.last_day ?? null,
    });
  } catch (err: unknown) {
    console.error('[qotd-topup] Error:', (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || 'Top-up failed' }, { status: 500 });
  }
}


