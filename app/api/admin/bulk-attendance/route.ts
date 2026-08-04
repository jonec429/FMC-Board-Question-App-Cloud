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

    // Deduplicate: Fetch attendance for these topics and emails from the last 1 hour
    const emailsToFetch = Array.from(new Set(entries.map((e: any) => e.resident_email)));
    const topicsToFetch = Array.from(new Set(entries.map((e: any) => e.topic)));
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: existingAttendance } = await adminSupabase
      .from('attendance')
      .select('resident_email, topic')
      .gte('created_at', oneHourAgo)
      .in('resident_email', emailsToFetch)
      .in('topic', topicsToFetch);

    const existingSet = new Set(
      (existingAttendance || []).map((a: any) => `${a.resident_email}::${a.topic}`)
    );

    const newEntries = entries.filter(
      (e: any) => !existingSet.has(`${e.resident_email}::${e.topic}`)
    );

    if (newEntries.length === 0) {
      return NextResponse.json({ success: true, message: 'No new attendance to insert (recently uploaded)' });
    }

    const { error } = await adminSupabase.from('attendance').insert(newEntries);

    if (error) {
      console.error('Error inserting bulk attendance:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also award academic points for attendance by inserting into the results table
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const isRollover = month > 5 || (month === 5 && date >= 14);
    const defaultAy = isRollover ? year + 1 : year;

    const resultEntries = newEntries.map((entry: any) => {
      // Extract AY from topic, e.g. "[AY 25] Block: Gastro" -> 25
      const ayMatch = entry.topic?.match(/\[AY\s+(\d+)\]/);
      const ay = ayMatch ? parseInt(ayMatch[1], 10) : defaultAy;

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
