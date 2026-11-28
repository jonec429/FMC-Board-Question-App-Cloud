import { NextResponse } from 'next/server';
import { getAdminSupabase, getAuthenticatedUser } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(request);
    if (!user || errorResponse) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Unsubscribe error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
