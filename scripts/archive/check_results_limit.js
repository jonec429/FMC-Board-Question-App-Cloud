const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, count, error } = await supabase.from('results').select('id', { count: 'exact' }).limit(10000);
  console.log(`Total results count: ${count}, Data length: ${data ? data.length : 0}`);
}
main();
