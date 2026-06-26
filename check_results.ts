import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: results } = await supabase.from('results').select('topic, academic_year').limit(100);
  
  if (!results) return;
  
  const counts = results.reduce((acc, r) => {
    const key = r.academic_year === null ? 'NULL' : String(r.academic_year);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Results academic_year counts:', counts);

  const block2Results = results.filter(r => r.topic?.includes('Neurology'));
  console.log('Neurology results:', block2Results.slice(0, 5));
}
run();
