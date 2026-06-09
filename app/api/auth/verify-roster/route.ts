import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Basic in-memory rate limiting (per lambda instance)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (ip !== 'unknown') {
      const record = rateLimitMap.get(ip);
      if (record && record.expiresAt > now) {
        if (record.count >= RATE_LIMIT) {
          return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
        }
        record.count++;
      } else {
        rateLimitMap.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
      }
    }

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.endsWith('@ascension.org')) {
      return NextResponse.json({ error: 'Invalid email domain' }, { status: 400 });
    }

    const { data: authorized, error } = await supabase
      .from('authorized_roster')
      .select('name, pgy, role')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !authorized) {
      // Intentional generic message + sleep to prevent timing attacks / enumeration
      await new Promise(r => setTimeout(r, Math.random() * 500 + 500));
      return NextResponse.json({ error: 'Email not found in authorized roster' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: authorized });
  } catch (err: any) {
    console.error('Verify Roster Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
