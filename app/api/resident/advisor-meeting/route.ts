import { NextResponse } from 'next/server';
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

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { blockId, blockTitle, selectedYear } = body;

    if (!blockId || !blockTitle || !selectedYear) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Fetch the resident's full name from roster
    const { data: rosterData } = await adminSupabase
      .from('authorized_roster')
      .select('name')
      .eq('email', user.email)
      .maybeSingle();

    const residentName = rosterData?.name || user.email;

    const baseTopic = `[AY ${selectedYear}] Block: ${blockTitle} - Advisor Meeting`;
    const fullTopic = `[Attendance] ${baseTopic}`;

    // Deduplication check: check if already claimed
    const { data: existing } = await adminSupabase
      .from('results')
      .select('id')
      .eq('legacy_email', user.email)
      .eq('topic', fullTopic)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Advisor meeting point already claimed for this block.' }, { status: 409 });
    }

    // Insert into attendance table
    const attendanceEntry = {
      resident_email: user.email,
      resident_name: residentName,
      date: new Date().toISOString().split('T')[0],
      status: 'Attended',
      points: 1,
      topic: baseTopic
    };

    const { error: attError } = await adminSupabase.from('attendance').insert([attendanceEntry]);
    
    if (attError) {
      console.error('Error inserting attendance for advisor meeting:', attError);
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }

    // Insert into results table for academic points
    const resultEntry = {
      legacy_email: user.email,
      topic: fullTopic,
      academic_points: 1,
      timing_status: 'Manual',
      academic_year: selectedYear
    };

    const { error: resError } = await adminSupabase.from('results').insert([resultEntry]);

    if (resError) {
      console.error('Error inserting results for advisor meeting:', resError);
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Advisor meeting claim error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
