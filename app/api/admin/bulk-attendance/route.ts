import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Authenticate with standard client using token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Insert with service role key to bypass RLS and fetch admin role
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Verify admin/faculty status using the admin client
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'faculty')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { entries } = body;

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { error } = await adminSupabase.from('attendance').insert(entries);

    if (error) {
      console.error('Error inserting bulk attendance:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also award academic points for attendance by inserting into the results table
    const resultEntries = entries.map((entry: any) => {
      // Extract AY from topic, e.g. "[AY 25] Block: Gastro" -> 25
      const ayMatch = entry.topic?.match(/\[AY\s+(\d+)\]/);
      const ay = ayMatch ? parseInt(ayMatch[1], 10) : new Date().getFullYear();

      return {
        legacy_email: entry.resident_email,
        topic: `[Attendance] ${entry.topic}`,
        academic_points: entry.points || 1,
        timing_status: 'Manual',
        academic_year: ay
      };
    });

    const { error: resultsError } = await adminSupabase.from('results').insert(resultEntries);

    if (resultsError) {
      console.error('Error inserting attendance points to results:', resultsError);
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Bulk attendance error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
