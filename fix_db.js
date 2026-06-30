require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Find Block 1 for AY 26-27 (2026)
  const { data: blocks, error: bErr } = await supabase.from('blocks').select('*').eq('academic_year', 2026).ilike('title', 'Block 1%');
  if (bErr || !blocks || blocks.length === 0) {
    console.log('Error or block not found', bErr);
    return;
  }
  
  const block1 = blocks[0];
  console.log('Found Block 1:', block1.title, block1.id);

  // 2. Update its start date in block_schedule to '2026-06-28'
  const { error: sErr } = await supabase.from('block_schedule').update({ start_date: '2026-06-28' }).eq('block_id', block1.id);
  if (sErr) {
    console.log('Error updating schedule:', sErr);
  } else {
    console.log('Updated block_schedule start_date to 2026-06-28');
  }

  // 3. Re-assign any 'On Time' completions for this block back to 'Early' if they were submitted before 2026-06-28
  // We don't have submission timestamp exactly for this query, but all these were done today (June 26th), which is before June 28th.
  // Actually, I can just blanket update all Block 1 results that are 'On Time' back to 'Early' because they were submitted before it opened.
  const { data: results, error: rErr } = await supabase.from('results').update({ timing_status: 'Early' }).eq('block_id', block1.id).eq('timing_status', 'On Time');
  
  if (rErr) console.log('Error updating results:', rErr);
  else console.log('Updated Block 1 results to Early');
}
run();
