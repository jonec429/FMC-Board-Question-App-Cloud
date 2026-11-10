import { NextResponse } from 'next/server';
import { requireAdminOrFaculty } from '@/lib/supabaseServer';
import { getCurrentAcademicYear } from '@/lib/academicYear';

interface BulkAttendanceEntry {
  resident_email: string;
  topic: string;
  points?: number;
  date?: string;
  resident_name?: string;
  status?: string;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrFaculty(request);
    if (!authResult.authorized || !authResult.adminSupabase) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = authResult.adminSupabase;
    const body = await request.json();
    const { entries } = body;

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Invalid payload: entries must be an array' }, { status: 400 });
    }

    // Deduplicate: Fetch attendance for these topics and emails from the last 1 hour
    const emailsToFetch = Array.from(new Set(entries.map((e: BulkAttendanceEntry) => e.resident_email).filter(Boolean)));
    const topicsToFetch = Array.from(new Set(entries.map((e: BulkAttendanceEntry) => e.topic).filter(Boolean)));
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: existingAttendance } = await adminSupabase
      .from('attendance')
      .select('resident_email, topic')
      .gte('created_at', oneHourAgo)
      .in('resident_email', emailsToFetch)
      .in('topic', topicsToFetch);

    const existingSet = new Set(
      (existingAttendance || []).map((a: { resident_email: string; topic: string }) => `${a.resident_email}::${a.topic}`)
    );

    const newEntries = entries.filter(
      (e: BulkAttendanceEntry) => e.resident_email && e.topic && !existingSet.has(`${e.resident_email}::${e.topic}`)
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
    const defaultAy = getCurrentAcademicYear();

    const resultEntries = newEntries.map((entry: BulkAttendanceEntry) => {
      // Extract AY from topic, e.g. "[AY 25] Block: Gastro" -> 25
      const ayMatch = entry.topic?.match(/\[AY\s+(\d+)\]/);
      const ay = ayMatch ? parseInt(ayMatch[1], 10) : defaultAy;

      let createdAt = new Date().toISOString();
      if (entry.date) {
        try {
          const parsed = new Date(entry.date.includes('T') ? entry.date : `${entry.date}T12:00:00Z`);
          if (!isNaN(parsed.getTime())) {
            createdAt = parsed.toISOString();
          }
        } catch {}
      }

      return {
        legacy_email: entry.resident_email,
        topic: `[Attendance] ${entry.topic}`,
        academic_points: Number(entry.points) || 1,
        timing_status: 'Manual',
        academic_year: ay,
        created_at: createdAt
      };
    });

    const { error: resultsError } = await adminSupabase.from('results').insert(resultEntries);

    if (resultsError) {
      console.error('Error inserting attendance points to results:', resultsError);
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: newEntries.length });
  } catch (error: unknown) {
    console.error('Bulk attendance error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
