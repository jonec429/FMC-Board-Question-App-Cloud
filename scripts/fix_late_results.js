require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: results, error: resultsErr } = await supabase
    .from('results')
    .select('*')
    .eq('timing_status', 'Late');
    
  if (resultsErr) {
    console.error('Error fetching results:', resultsErr);
    return;
  }
  
  const { data: blocks, error: blocksErr } = await supabase
    .from('blocks')
    .select('id, title');
    
  if (blocksErr) {
    console.error('Error fetching blocks:', blocksErr);
    return;
  }
  
  const { data: schedules, error: schedulesErr } = await supabase
    .from('block_schedule')
    .select('*');
    
  if (schedulesErr) {
    console.error('Error fetching schedules:', schedulesErr);
    return;
  }
  
  let fixedCount = 0;
  
  for (const result of results) {
    const block = blocks.find(b => b.title === result.topic);
    if (!block) continue;
    
    const sched = schedules.find(s => s.block_id === block.id);
    if (!sched || !sched.end_date) continue;
    
    // Check if created_at (in NY time) is <= end_date
    const estFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const submitEstStr = estFormatter.format(new Date(result.created_at));
    
    if (submitEstStr <= sched.end_date) {
      console.log(`Fixing result ${result.id} for ${result.topic} - Submitted ${submitEstStr}, Due ${sched.end_date}`);
      
      const { error: updateErr } = await supabase
        .from('results')
        .update({ 
          timing_status: 'On Time',
          academic_points: 2 
        })
        .eq('id', result.id);
        
      if (updateErr) {
        console.error('Failed to update', result.id, updateErr);
      } else {
        fixedCount++;
      }
    }
  }
  
  console.log(`Finished fixing ${fixedCount} results.`);
}

main();
