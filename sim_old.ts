import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export function getCurrentAcademicYear(now: Date = new Date()): number {
  const month = now.getMonth();
  const date = now.getDate();
  const year = now.getFullYear();
  const isRollover = month > 5 || (month === 5 && date >= 14);
  return isRollover ? year + 1 : year;
}

async function run() {
  const [blocksRes, scheduleRes, resultsRes, profilesRes, rosterRes] = await Promise.all([
    supabase.from('blocks').select('*'),
    supabase.from('block_schedule').select('*'),
    supabase.from('results').select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at, academic_year, timing_status'),
    supabase.from('profiles').select('*'),
    supabase.from('authorized_roster').select('*'),
  ]);

  const blocks = blocksRes.data || [];
  const allResults = resultsRes.data || [];
  const profiles = profilesRes.data || [];
  
  const selectedYear = 2026; // Testing AY 25-26

  const profileMap = new Map<string, string>();
  profiles.forEach((p: any) => {
    const email = p?.email || p?.email;
    if (p?.id && email) {
      profileMap.set(p.id, email);
    }
  });

  const enrichedResults = allResults
    .filter((r: any) => (selectedYear === 0 || r.academic_year === selectedYear) && !r.topic?.toLowerCase().includes('demo'))
    .map((r: any) => ({
      ...r,
      email: r.legacy_email || (r.user_id ? profileMap.get(r.user_id) : null),
    }))
    .filter((r: any) => r.email);

  console.log(`enrichedResults length for ${selectedYear}:`, enrichedResults.length);

  const block2 = blocks.find(b => b.title.includes('Neurology'));
  if (!block2) return;

  const blockResults = enrichedResults.filter(r => r.topic === block2.title);
  
  console.log(`Block 2 completions:`, blockResults.length);
}
run();
