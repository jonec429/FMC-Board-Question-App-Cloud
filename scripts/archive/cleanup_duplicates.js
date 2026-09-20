const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Cleaning up duplicate attendance records in results...');
  
  // 1. Fetch all attendance results
  let allResults = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from('results').select('id, legacy_email, topic').ilike('topic', '%[Attendance]%').range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allResults = allResults.concat(data);
    if (data.length < step) break;
    from += step;
  }

  // 2. Identify duplicates
  const seen = new Set();
  const duplicateIds = [];
  for (const r of allResults) {
    const key = `${r.legacy_email}::${r.topic}`;
    if (seen.has(key)) {
      duplicateIds.push(r.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate attendance records in 'results'.`);

  // 3. Delete duplicates
  if (duplicateIds.length > 0) {
    for (let i = 0; i < duplicateIds.length; i += 100) {
      const batch = duplicateIds.slice(i, i + 100);
      const { error } = await supabase.from('results').delete().in('id', batch);
      if (error) {
         console.error('Error deleting results:', error);
      }
    }
    console.log('Deleted duplicate results.');
  }

  console.log('Cleaning up duplicate attendance records in attendance...');
  // 4. Fetch all attendance table records
  let allAttendance = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase.from('attendance').select('id, resident_email, topic').range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allAttendance = allAttendance.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const seenAtt = new Set();
  const duplicateAttIds = [];
  for (const a of allAttendance) {
    const key = `${a.resident_email}::${a.topic}`;
    if (seenAtt.has(key)) {
      duplicateAttIds.push(a.id);
    } else {
      seenAtt.add(key);
    }
  }

  console.log(`Found ${duplicateAttIds.length} duplicate attendance records in 'attendance'.`);

  if (duplicateAttIds.length > 0) {
    for (let i = 0; i < duplicateAttIds.length; i += 100) {
      const batch = duplicateAttIds.slice(i, i + 100);
      const { error } = await supabase.from('attendance').delete().in('id', batch);
      if (error) {
         console.error('Error deleting attendance:', error);
      }
    }
    console.log('Deleted duplicate attendance records.');
  }
}
main();
