import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getCurrentAcademicYear } from '@/lib/academicYear';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin/faculty status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'faculty')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, email, points, reason } = body;

    if (!userId || typeof points !== 'number' || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('results').insert({
      user_id: userId,
      legacy_email: email,
      topic: `[Manual] ${reason}`,
      academic_points: points,
      timing_status: 'Manual',
      academic_year: getCurrentAcademicYear(),
    });

    if (error) {
      console.error('Error inserting manual points:', error);
      return NextResponse.json({ error: 'Failed to insert points' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Manual points error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
