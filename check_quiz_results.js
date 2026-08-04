const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('results')
    .select('id, legacy_email, user_id, topic, academic_points, academic_year')
    .not('topic', 'ilike', '%[Attendance]%')
    .limit(10);
  console.log('Quiz results:');
  console.log(data);
}
main();
