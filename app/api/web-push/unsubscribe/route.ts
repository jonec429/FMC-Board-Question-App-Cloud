import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Unsubscribe error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
