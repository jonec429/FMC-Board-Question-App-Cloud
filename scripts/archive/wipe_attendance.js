const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function wipeAttendance() {
  console.log('Wiping all [Attendance] and [Manual] points...');
  
  // Supabase delete() requires a match, we can use like() for topics containing [Attendance] or [Manual]
  // Because we want an OR, we have to do it in two steps or use an in filter.
  // We'll do it in two steps.
  
  console.log('Deleting [Attendance] records...');
  const { data: attData, error: attErr } = await supabase
    .from('results')
    .delete()
    .like('topic', '%[Attendance]%')
    .select('id');
    
  if (attErr) {
    console.error('Error deleting attendance:', attErr);
  } else {
    console.log(`Deleted ${attData ? attData.length : 0} attendance records.`);
  }
  
  console.log('Deleting [Manual] records...');
  const { data: manData, error: manErr } = await supabase
    .from('results')
    .delete()
    .like('topic', '%[Manual]%')
    .select('id');
    
  if (manErr) {
    console.error('Error deleting manual records:', manErr);
  } else {
    console.log(`Deleted ${manData ? manData.length : 0} manual records.`);
  }
  
  console.log('Wipe complete.');
}

wipeAttendance();
