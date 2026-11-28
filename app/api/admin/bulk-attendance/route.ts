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

interface SkippedEntrySummary {
  email: string;
  name?: string;
  date?: string;
  topic: string;
  reason: string;
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

    const topicsToFetch = Array.from(new Set(entries.map((e: BulkAttendanceEntry) => e.topic).filter(Boolean)));
    const oneHourMs = 60 * 60 * 1000;
    const cutoffMs = Date.now() - oneHourMs;

    // Fetch existing attendance for these session topics so we can reconcile:
    // 1) Case-insensitive email + exact topic + same calendar date (prevents double NI uploads across days)
    // 2) Case-insensitive email + exact topic created within the past hour (double-click protection)
    const { data: existingAttendance } = topicsToFetch.length > 0
      ? await adminSupabase
          .from('attendance')
          .select('resident_email, topic, date, created_at')
          .in('topic', topicsToFetch)
      : { data: [] };

    const recentKeys = new Set<string>();
    const datedKeys = new Set<string>();

    (existingAttendance || []).forEach((a: { resident_email: string; topic: string; date?: string | null; created_at?: string | null }) => {
      const emailKey = (a.resident_email || '').trim().toLowerCase();
      const topicKey = (a.topic || '').trim();
      if (!emailKey || !topicKey) return;

      if (a.date) {
        datedKeys.add(`${emailKey}::${topicKey}::${a.date}`);
      }
      if (a.created_at) {
        const ts = new Date(a.created_at).getTime();
        if (!Number.isNaN(ts) && ts >= cutoffMs) {
          recentKeys.add(`${emailKey}::${topicKey}`);
        }
      }
    });

    const newEntries: BulkAttendanceEntry[] = [];
    const skippedEntries: SkippedEntrySummary[] = [];

    for (const entry of entries as BulkAttendanceEntry[]) {
      const emailKey = (entry.resident_email || '').trim().toLowerCase();
      const topicKey = (entry.topic || '').trim();
      if (!emailKey || !topicKey) continue;

      const dateKey = entry.date ? `${emailKey}::${topicKey}::${entry.date}` : '';
      const recentKey = `${emailKey}::${topicKey}`;

      if ((dateKey && datedKeys.has(dateKey)) || recentKeys.has(recentKey)) {
        skippedEntries.push({
          email: entry.resident_email,
          name: entry.resident_name,
          date: entry.date,
          topic: entry.topic,
          reason: dateKey && datedKeys.has(dateKey)
            ? 'Already credited for this date & topic'
            : 'Uploaded within the past hour',
        });
        continue;
      }

      // Guard against duplicates inside the same batch
      if (dateKey) datedKeys.add(dateKey);
      recentKeys.add(recentKey);
      newEntries.push({
        resident_email: entry.resident_email.trim(),
        topic: topicKey,
        points: Number(entry.points) || 1,
        ...(entry.date ? { date: entry.date } : {}),
        ...(entry.resident_name ? { resident_name: entry.resident_name } : {}),
        ...(entry.status ? { status: entry.status } : {}),
      });
    }

    if (newEntries.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        insertedCount: 0,
        skippedCount: skippedEntries.length,
        skippedEntries,
        message: 'No new attendance credits inserted (all entries already recorded).',
      });
    }

    const { data: insertedAtt, error } = await adminSupabase
      .from('attendance')
      .insert(newEntries)
      .select('id');

    if (error) {
      console.error('Error inserting bulk attendance:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve user_ids from profiles so attendance points link cleanly to user_id
    const { data: profilesList } = await adminSupabase
      .from('profiles')
      .select('id, email');
    const userIdByEmail = new Map<string, string>();
    (profilesList || []).forEach((p: { id: string; email?: string | null }) => {
      if (p.email && p.id) userIdByEmail.set(p.email.toLowerCase().trim(), p.id);
    });

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

      const uid = userIdByEmail.get(entry.resident_email.toLowerCase().trim());

      return {
        ...(uid ? { user_id: uid } : {}),
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
      // Roll back the attendance rows just inserted so the two tables stay consistent
      const insertedIds = (insertedAtt || []).map((row: { id: string }) => row.id).filter(Boolean);
      if (insertedIds.length > 0) {
        await adminSupabase.from('attendance').delete().in('id', insertedIds);
      }
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: newEntries.length,
      insertedCount: newEntries.length,
      skippedCount: skippedEntries.length,
      skippedEntries,
    });
  } catch (error: unknown) {
    console.error('Bulk attendance error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
