import { NextResponse } from 'next/server';
import { getCurrentAcademicYear } from '@/lib/academicYear';
import { requireAdminOrFaculty } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrFaculty(request);
    if (!authResult.authorized || !authResult.adminSupabase) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = authResult.adminSupabase;
    const body = await request.json();
    const { userId, email, points, reason } = body;

    if (!userId || typeof points !== 'number' || isNaN(points) || !reason) {
      return NextResponse.json({ error: 'Missing or invalid required fields (userId, points, reason)' }, { status: 400 });
    }

    const { error } = await adminSupabase.from('results').insert({
      user_id: userId,
      legacy_email: email,
      topic: `[Manual] ${reason.trim()}`,
      academic_points: points,
      timing_status: 'Manual',
      academic_year: getCurrentAcademicYear(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error inserting manual points:', error);
      return NextResponse.json({ error: 'Failed to insert points' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Manual points error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
