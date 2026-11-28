import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseServer';

// Basic in-memory rate limiting (per lambda instance)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT = 40;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();

    if (rateLimitMap.size > 500) {
      rateLimitMap.forEach((val, key) => {
        if (val.expiresAt <= now) rateLimitMap.delete(key);
      });
    }

    const record = rateLimitMap.get(ip);
    if (record && record.expiresAt > now) {
      if (record.count >= RATE_LIMIT) {
        return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
      }
      record.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.endsWith('@ascension.org')) {
      return NextResponse.json({ error: 'Invalid email domain' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { data: authorized, error } = await supabase
      .from('authorized_roster')
      .select('email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (error || !authorized) {
      // Intentional generic message + sleep to prevent timing attacks / enumeration
      await new Promise((r) => setTimeout(r, Math.random() * 500 + 500));
      return NextResponse.json({ error: 'Email not found in authorized roster' }, { status: 404 });
    }

    // Do not leak PII (name, PGY, role) to unauthenticated callers
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Verify Roster Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

