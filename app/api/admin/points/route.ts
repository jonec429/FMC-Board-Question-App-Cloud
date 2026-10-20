import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Verify admin or faculty
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'faculty')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Faculty required' }, { status: 403 });
    }

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

      // If it's an attendance record, keep attendance table in sync
      const resTopic = existingResult.topic || '';
      const email = existingResult.legacy_email;
      if (resTopic.includes('[Attendance]') && email) {
        // Strip [Attendance] prefix to find matching attendance record
        const rawTopic = resTopic.replace(/^\[Attendance\]\s*/i, '').trim();
        await adminSupabase
          .from('attendance')
          .update({ points })
          .ilike('resident_email', email)
          .ilike('topic', rawTopic);
      }

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

      // Also update results table if matching record exists
      if (existingAtt.resident_email && existingAtt.topic) {
        await adminSupabase
          .from('results')
          .update({ academic_points: points })
          .ilike('legacy_email', existingAtt.resident_email)
          .ilike('topic', `%${existingAtt.topic}%`);
      }

      return NextResponse.json({ success: true, updated: 'attendance' });
    }

    return NextResponse.json({ error: 'Must provide resultId or attendanceId' }, { status: 400 });

  } catch (error: any) {
    console.error('Error updating points:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Verify admin
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'faculty')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Faculty required' }, { status: 403 });
    }

    const body = await request.json();
    const { resultId, attendanceId, resultIds, attendanceIds } = body;

    // Batch deletion support
    if (Array.isArray(resultIds) && resultIds.length > 0) {
      // Find topics to sync with attendance
      const { data: resultsToDelete } = await adminSupabase
        .from('results')
        .select('id, legacy_email, topic')
        .in('id', resultIds);

      const { error: delErr } = await adminSupabase
        .from('results')
        .delete()
        .in('id', resultIds);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      // Also clean up matching attendance
      if (resultsToDelete && resultsToDelete.length > 0) {
        for (const r of resultsToDelete) {
          if (r.topic?.includes('[Attendance]') && r.legacy_email) {
            const rawTopic = r.topic.replace(/^\[Attendance\]\s*/i, '').trim();
            await adminSupabase
              .from('attendance')
              .delete()
              .ilike('resident_email', r.legacy_email)
              .ilike('topic', rawTopic);
          }
        }
      }

      return NextResponse.json({ success: true, deletedCount: resultIds.length });
    }

    if (Array.isArray(attendanceIds) && attendanceIds.length > 0) {
      const { data: attToDelete } = await adminSupabase
        .from('attendance')
        .select('id, resident_email, topic')
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
          if (a.resident_email && a.topic) {
            await adminSupabase
              .from('results')
              .delete()
              .ilike('legacy_email', a.resident_email)
              .ilike('topic', `%${a.topic}%`);
          }
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

      // If it was attendance, also delete from attendance
      if (existingResult.topic?.includes('[Attendance]') && existingResult.legacy_email) {
        const rawTopic = existingResult.topic.replace(/^\[Attendance\]\s*/i, '').trim();
        await adminSupabase
          .from('attendance')
          .delete()
          .ilike('resident_email', existingResult.legacy_email)
          .ilike('topic', rawTopic);
      }

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

      // Sync with results
      if (existingAtt.resident_email && existingAtt.topic) {
        await adminSupabase
          .from('results')
          .delete()
          .ilike('legacy_email', existingAtt.resident_email)
          .ilike('topic', `%${existingAtt.topic}%`);
      }

      return NextResponse.json({ success: true, deleted: 'attendance' });
    }

    return NextResponse.json({ error: 'Must provide resultId, attendanceId, resultIds, or attendanceIds' }, { status: 400 });

  } catch (error: any) {
    console.error('Error deleting points:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
