require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: profile, error: profileErr } = await supabase
    .from('authorized_roster')
    .select('*')
    .ilike('name', '%keisha%')
    .single();
    
  if (profileErr) {
    console.error('Error finding Keisha in roster:', profileErr);
    return;
  }
  
  console.log('Roster Entry:', profile);
  
  const { data: results, error: resultsErr } = await supabase
    .from('results')
    .select('*')
    .eq('legacy_email', profile.email);
    
  console.log('\nResults for Keisha:');
  console.table(results.map(r => ({
    topic: r.topic,
    submitted_at: r.created_at,
    timing_status: r.timing_status,
    points: r.academic_points,
    score: r.score
  })));
}

main();
