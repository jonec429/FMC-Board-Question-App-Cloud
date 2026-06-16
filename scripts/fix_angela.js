import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.from('results').insert([{
    topic: '2024-2025 Legacy System Migration',
    score: 0,
    total: 0,
    percentage: 100,
    academic_points: 33,
    legacy_email: 'angela.nguyen1@ascension.org',
    category_stats: {}
  }]);
  if (error) console.error(error);
  else console.log('Successfully inserted Angela Nguyen');
}
run();
