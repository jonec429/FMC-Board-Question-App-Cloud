const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('attendance').select('*').ilike('resident_email', '%ball%').limit(20);
  console.log("Attendance table:", data);
  
  const { data: resultsData } = await supabase.from('results').select('*').ilike('legacy_email', '%ball%').ilike('topic', '%Attendance%').limit(20);
  console.log("Results table:", resultsData);
}
main();
