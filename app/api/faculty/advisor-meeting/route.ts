import { NextResponse } from 'next/server';
import { requireAdminOrFaculty } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrFaculty(request);
    if (!authResult.authorized || !authResult.user || !authResult.adminSupabase) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const adminSupabase = authResult.adminSupabase;

    const { data: callerRoster } = user.email
      ? await adminSupabase
          .from('authorized_roster')
          .select('name')
          .ilike('email', user.email)
          .maybeSingle()
      : { data: null };

    const body = await request.json();
    const { residentEmail, blockTitle, selectedYear, notes } = body;

    if (!residentEmail || !blockTitle || !selectedYear) {
      return NextResponse.json({ error: 'Missing required parameters (residentEmail, blockTitle, selectedYear)' }, { status: 400 });
    }

    const cleanResidentEmail = String(residentEmail).trim().toLowerCase();

    // Look up resident name & profile user_id
    const [{ data: residentRoster }, { data: residentProfile }] = await Promise.all([
      adminSupabase
        .from('authorized_roster')
        .select('name, email')
        .ilike('email', cleanResidentEmail)
        .maybeSingle(),
      adminSupabase
        .from('profiles')
        .select('id')
        .ilike('email', cleanResidentEmail)
        .maybeSingle(),
    ]);

    const residentName = residentRoster?.name || cleanResidentEmail;
    const canonicalEmail = residentRoster?.email || cleanResidentEmail;
    const advisorName = callerRoster?.name || user.email || 'Faculty Advisor';

    const baseTopic = `[AY ${selectedYear}] Block: ${blockTitle} - Advisor Meeting`;
    const fullTopic = `[Attendance] ${baseTopic}`;

    // Deduplication check in results table (case-insensitive email)
    const { data: existing } = await adminSupabase
      .from('results')
      .select('id')
      .ilike('legacy_email', canonicalEmail)
      .eq('topic', fullTopic)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Advisor meeting point already logged for this block.' }, { status: 409 });
    }

    // Insert attendance record
    const attendanceNotes = notes?.trim() ? ` [Notes: ${notes.trim()}]` : '';
    const attendanceEntry = {
      resident_email: canonicalEmail,
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
      ...(residentProfile?.id ? { user_id: residentProfile.id } : {}),
      legacy_email: canonicalEmail,
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
