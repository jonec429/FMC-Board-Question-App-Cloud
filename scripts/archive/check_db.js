const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log('Fetching demo questions...');
  const { data: demoQs, error: demoErr } = await supabase.from('questions').select('id, category, year').eq('category', 'Demo');
  console.log('Demo category:', demoQs, demoErr);
  
  const { data: q, error: qErr } = await supabase.from('questions').select('id').limit(1);
  console.log('Sample question ID:', q, qErr);

  const { data: qa, error: qaErr } = await supabase.from('question_attempts').select('id, question_id, user_id').limit(1);
  console.log('Sample attempt:', qa, qaErr);
}
main();
