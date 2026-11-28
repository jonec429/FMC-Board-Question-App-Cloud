import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { run_id, endpoint } = body || {};

    if (
      typeof run_id !== 'string' ||
      typeof endpoint !== 'string' ||
      !run_id.trim() ||
      !endpoint.trim() ||
      run_id.length > 128 ||
      endpoint.length > 1000
    ) {
      return NextResponse.json({ error: 'Invalid run_id or endpoint' }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    // Verify the subscription endpoint is registered so arbitrary callers cannot flood push_receipts
    const { data: sub } = await supabase
      .from('web_push_subscriptions')
      .select('user_id, legacy_email')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ error: 'Unknown push subscription endpoint' }, { status: 403 });
    }

    // Verify run_id corresponds to a recent push dispatch in cron_logs (within 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: matchingRun } = await supabase
      .from('cron_logs')
      .select('id')
      .gte('executed_at', sevenDaysAgo)
      .contains('details', { run_id })
      .limit(1)
      .maybeSingle();

    if (!matchingRun) {
      return NextResponse.json({ error: 'Unrecognized or expired run_id' }, { status: 403 });
    }

    let email = sub.legacy_email || 'unknown';
    if (sub.user_id && email === 'unknown') {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', sub.user_id)
        .maybeSingle();
      if (prof?.email) email = prof.email;
    }

    // Insert the receipt
    const { error } = await supabase
      .from('push_receipts')
      .insert({
        run_id,
        endpoint,
        email,
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[web-push/receipt] Error saving receipt:', (err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 });
  }
}
