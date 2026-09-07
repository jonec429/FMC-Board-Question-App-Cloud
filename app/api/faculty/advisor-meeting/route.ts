import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Verify caller has faculty or admin role
    const { data: callerRoster } = await adminSupabase
      .from('authorized_roster')
      .select('role, name')
      .eq('email', user.email)
      .maybeSingle();

    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const callerRole = (callerProfile?.role || callerRoster?.role || '').toLowerCase();
    const isFacultyOrAdmin = ['faculty', 'admin', 'superadmin', 'pd', 'apd'].includes(callerRole);

    if (!isFacultyOrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only faculty and admins can log advisor meetings' }, { status: 403 });
    }

    const body = await request.json();
    const { residentEmail, blockTitle, selectedYear, notes } = body;

    if (!residentEmail || !blockTitle || !selectedYear) {
      return NextResponse.json({ error: 'Missing required parameters (residentEmail, blockTitle, selectedYear)' }, { status: 400 });
    }

    // Look up resident name
    const { data: residentRoster } = await adminSupabase
      .from('authorized_roster')
      .select('name')
      .eq('email', residentEmail)
      .maybeSingle();

    const residentName = residentRoster?.name || residentEmail;
    const advisorName = callerRoster?.name || user.email;

    const baseTopic = `[AY ${selectedYear}] Block: ${blockTitle} - Advisor Meeting`;
    const fullTopic = `[Attendance] ${baseTopic}`;

    // Deduplication check in results table
    const { data: existing } = await adminSupabase
      .from('results')
      .select('id')
      .eq('legacy_email', residentEmail)
      .eq('topic', fullTopic)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Advisor meeting point already logged for this block.' }, { status: 409 });
    }

    // Insert attendance record
    const attendanceNotes = notes?.trim() ? ` [Notes: ${notes.trim()}]` : '';
    const attendanceEntry = {
      resident_email: residentEmail,
      resident_name: residentName,
      date: new Date().toISOString().split('T')[0],
      status: 'Attended',
      points: 1,
      topic: `${baseTopic} (Advisor: ${advisorName})${attendanceNotes}`
    };

    const { error: attError } = await adminSupabase.from('attendance').insert([attendanceEntry]);
    if (attError) {
      console.error('Error inserting attendance:', attError);
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }

    // Insert results record for academic points
    const resultEntry = {
      legacy_email: residentEmail,
      topic: fullTopic,
      academic_points: 1,
      timing_status: 'Manual',
      academic_year: selectedYear
    };

    const { error: resError } = await adminSupabase.from('results').insert([resultEntry]);
    if (resError) {
      console.error('Error inserting results:', resError);
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Advisor meeting recorded and 1 AP awarded.' });
  } catch (err: any) {
    console.error('Faculty advisor meeting log error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
