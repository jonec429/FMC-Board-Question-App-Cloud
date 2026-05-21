import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { subscription, legacyEmail } = await request.json();

    if (!subscription || !subscription.endpoint || !legacyEmail) {
      return NextResponse.json({ error: 'Missing subscription or legacyEmail' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;

    const { error } = await supabase.from('web_push_subscriptions').upsert(
      {
        legacy_email: legacyEmail,
        endpoint: endpoint,
        auth: keys.auth,
        p256dh: keys.p256dh,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
