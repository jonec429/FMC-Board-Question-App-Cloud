import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminOrFaculty } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Strips trailing advisor/notes annotations added by faculty advisor meeting logging
 * so `attendance.topic` can be matched cleanly against `[Attendance] <baseTopic>` in `results`.
 */
function stripAdvisorMetadata(attTopic: string): string {
  return attTopic
    .replace(/\s*\(Advisor:[^)]*\)(?:\s*\[Notes:[^\]]*\])?$/i, '')
    .trim();
}

/**
 * Escapes LIKE wildcards (`%`, `_`, `\`) for literal PostgREST `.ilike()` matching.
 */
function escapeLikeLiteral(str: string): string {
  return str.replace(/[\\%_]/g, '\\$&');
}

async function syncAttendanceFromResult(
  adminSupabase: SupabaseClient,
  existingResult: { legacy_email?: string | null; topic?: string | null; created_at?: string | null },
  action: 'update' | 'delete',
  points?: number
) {
  const resTopic = existingResult.topic || '';
  const email = existingResult.legacy_email;
  if (!resTopic.includes('[Attendance]') || !email) return;

  const rawTopic = resTopic.replace(/^\[Attendance\]\s*/i, '').trim();
  if (!rawTopic) return;

  const basePattern = escapeLikeLiteral(rawTopic);
  const dateStr = existingResult.created_at ? existingResult.created_at.slice(0, 10) : null;

  // Narrow by date first when available so deleting/editing one session doesn't clobber other dates
  let matchingIds: string[] = [];
  if (dateStr) {
    const { data: datedRows } = await adminSupabase
      .from('attendance')
      .select('id')
      .ilike('resident_email', email)
      .eq('date', dateStr)
      .or(`topic.ilike.${basePattern},topic.ilike.${basePattern} (Advisor:%`);
    matchingIds = (datedRows || []).map((r: { id: string }) => r.id);
  }

  if (matchingIds.length === 0) {
    const { data: fallbackRows } = await adminSupabase
      .from('attendance')
      .select('id')
      .ilike('resident_email', email)
      .or(`topic.ilike.${basePattern},topic.ilike.${basePattern} (Advisor:%`);
    matchingIds = (fallbackRows || []).map((r: { id: string }) => r.id);
  }

  if (matchingIds.length === 0) return;

  if (action === 'update' && typeof points === 'number') {
    await adminSupabase.from('attendance').update({ points }).in('id', matchingIds);
  } else if (action === 'delete') {
    await adminSupabase.from('attendance').delete().in('id', matchingIds);
  }
}

async function syncResultFromAttendance(
  adminSupabase: SupabaseClient,
  existingAtt: { resident_email?: string | null; topic?: string | null; date?: string | null },
  action: 'update' | 'delete',
  points?: number
) {
  if (!existingAtt.resident_email || !existingAtt.topic) return;

  const baseTopic = stripAdvisorMetadata(existingAtt.topic);
  if (!baseTopic) return;

  // Strictly match `[Attendance] <baseTopic>` — NEVER `%topic%` which could match real quiz results!
  const expectedResultTopic = `[Attendance] ${baseTopic}`;
  let query = adminSupabase
    .from('results')
    .select('id, created_at')
    .ilike('legacy_email', existingAtt.resident_email)
    .ilike('topic', escapeLikeLiteral(expectedResultTopic));

  const { data: candidateResults } = await query;
  if (!candidateResults || candidateResults.length === 0) return;

  let targetIds = candidateResults.map((r: { id: string }) => r.id);
  if (existingAtt.date && candidateResults.length > 1) {
    const dated = candidateResults
      .filter((r: { id: string; created_at?: string | null }) => r.created_at?.slice(0, 10) === existingAtt.date)
      .map((r: { id: string }) => r.id);
    if (dated.length > 0) targetIds = dated;
  }

  if (action === 'update' && typeof points === 'number') {
    await adminSupabase.from('results').update({ academic_points: points }).in('id', targetIds);
  } else if (action === 'delete') {
    await adminSupabase.from('results').delete().in('id', targetIds);
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdminOrFaculty(request);
    if (!authResult.authorized || !authResult.adminSupabase) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = authResult.adminSupabase;
    const body = await request.json();
    const { resultId, attendanceId, points, topic, date } = body;

    if (typeof points !== 'number' || isNaN(points)) {
      return NextResponse.json({ error: 'Points must be a valid number' }, { status: 400 });
    }

    // 1. If resultId is provided, update results table
    if (resultId) {
      const { data: existingResult, error: fetchErr } = await adminSupabase
        .from('results')
        .select('*')
        .eq('id', resultId)
        .single();

      if (fetchErr || !existingResult) {
        return NextResponse.json({ error: 'Result not found' }, { status: 404 });
      }

      const updates: Record<string, any> = { academic_points: points };
      if (topic) updates.topic = topic;

      const { error: updateErr } = await adminSupabase
        .from('results')
        .update(updates)
        .eq('id', resultId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      await syncAttendanceFromResult(adminSupabase, existingResult, 'update', points);

      return NextResponse.json({ success: true, updated: 'result' });
    }

    // 2. If attendanceId is provided, update attendance table
    if (attendanceId) {
      const { data: existingAtt, error: fetchErr } = await adminSupabase
        .from('attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      if (fetchErr || !existingAtt) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      const updates: Record<string, any> = { points };
      if (topic) updates.topic = topic;
      if (date) updates.date = date;

      const { error: updateErr } = await adminSupabase
        .from('attendance')
        .update(updates)
        .eq('id', attendanceId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      await syncResultFromAttendance(adminSupabase, existingAtt, 'update', points);

      return NextResponse.json({ success: true, updated: 'attendance' });
    }

    return NextResponse.json({ error: 'Must provide resultId or attendanceId' }, { status: 400 });

  } catch (error: unknown) {
    console.error('Error updating points:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdminOrFaculty(request);
    if (!authResult.authorized || !authResult.adminSupabase) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = authResult.adminSupabase;
    const body = await request.json();
    const { resultId, attendanceId, resultIds, attendanceIds } = body;

    // Batch deletion support
    if (Array.isArray(resultIds) && resultIds.length > 0) {
      const { data: resultsToDelete } = await adminSupabase
        .from('results')
        .select('id, legacy_email, topic, created_at')
        .in('id', resultIds);

      const { error: delErr } = await adminSupabase
        .from('results')
        .delete()
        .in('id', resultIds);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      if (resultsToDelete && resultsToDelete.length > 0) {
        for (const r of resultsToDelete) {
          await syncAttendanceFromResult(adminSupabase, r, 'delete');
        }
      }

      return NextResponse.json({ success: true, deletedCount: resultIds.length });
    }

    if (Array.isArray(attendanceIds) && attendanceIds.length > 0) {
      const { data: attToDelete } = await adminSupabase
        .from('attendance')
        .select('id, resident_email, topic, date')
        .in('id', attendanceIds);

      const { error: delErr } = await adminSupabase
        .from('attendance')
        .delete()
        .in('id', attendanceIds);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      if (attToDelete && attToDelete.length > 0) {
        for (const a of attToDelete) {
          await syncResultFromAttendance(adminSupabase, a, 'delete');
        }
      }

      return NextResponse.json({ success: true, deletedCount: attendanceIds.length });
    }

    // Single result deletion
    if (resultId) {
      const { data: existingResult } = await adminSupabase
        .from('results')
        .select('*')
        .eq('id', resultId)
        .single();

      if (!existingResult) {
        return NextResponse.json({ error: 'Result not found' }, { status: 404 });
      }

      const { error: delErr } = await adminSupabase
        .from('results')
        .delete()
        .eq('id', resultId);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      await syncAttendanceFromResult(adminSupabase, existingResult, 'delete');

      return NextResponse.json({ success: true, deleted: 'result' });
    }

    // Single attendance deletion
    if (attendanceId) {
      const { data: existingAtt } = await adminSupabase
        .from('attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      if (!existingAtt) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      const { error: delErr } = await adminSupabase
        .from('attendance')
        .delete()
        .eq('id', attendanceId);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      await syncResultFromAttendance(adminSupabase, existingAtt, 'delete');

      return NextResponse.json({ success: true, deleted: 'attendance' });
    }

    return NextResponse.json({ error: 'Must provide resultId, attendanceId, resultIds, or attendanceIds' }, { status: 400 });

  } catch (error: unknown) {
    console.error('Error deleting points:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
