const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: q, error: qErr } = await supabase.from('questions').select('id, resource_link').not('resource_link', 'is', null).limit(5);
  console.log('Sample resource links:', q, qErr);
}
main();
