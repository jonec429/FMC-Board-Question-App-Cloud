import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: authorized, error } = await supabase
      .from('authorized_roster')
      .select('name, pgy, role')
      .eq('email', cleanEmail)
      .single();

    if (error || !authorized) {
      return NextResponse.json({ error: 'Email not found in authorized roster' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: authorized });
  } catch (err: any) {
    console.error('Verify Roster Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
