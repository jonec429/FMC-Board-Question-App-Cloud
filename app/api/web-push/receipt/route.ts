import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { run_id, endpoint } = await request.json();

    if (!run_id || !endpoint) {
      return NextResponse.json({ error: 'Missing run_id or endpoint' }, { status: 400 });
    }

    // Attempt to lookup the user's email based on the endpoint
    const { data: sub } = await supabase
      .from('web_push_subscriptions')
      .select('email')
      .eq('endpoint', endpoint)
      .maybeSingle();

    const email = sub?.email || 'unknown';

    // Insert the receipt
    const { error } = await supabase
      .from('push_receipts')
      .insert({
        run_id,
        endpoint,
        email
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[web-push/receipt] Error saving receipt:', err.message);
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 });
  }
}
