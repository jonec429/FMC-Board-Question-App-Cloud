import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'dummy_public_key';
  const privateKey = process.env.VAPID_PRIVATE_KEY || 'dummy_private_key';
  
  if (publicKey !== 'dummy_public_key' && privateKey !== 'dummy_private_key') {
    webpush.setVapidDetails(
      'mailto:jonathan.carbungco@ascension.org',
      publicKey,
      privateKey
    );
  }

  // Verify Vercel Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: subs, error } = await supabase.from('web_push_subscriptions').select('*');
    if (error) throw error;
    
    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, message: 'No subscriptions found.' });
    }

    const payload = JSON.stringify({
      title: 'QOTD Results Are In!',
      body: 'See how you did compared to the rest of the cohort and prep for Noon Conference.'
    });

    const notifications = subs.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };
      return webpush.sendNotification(pushSubscription, payload).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or invalid
          console.log('Subscription expired, deleting endpoint:', sub.endpoint);
          return supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('Error sending push:', err);
        }
      });
    });

    await Promise.allSettled(notifications);
    return NextResponse.json({ success: true, message: `Sent ${notifications.length} push notifications.` });

  } catch (err: any) {
    console.error('Noon Cron Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
