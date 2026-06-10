import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: qotd } = await supabase.from('questions').select('id').order('created_at', { ascending: false }).limit(1).single();
  console.log("QOTD ID:", qotd?.id);
  
  if (qotd) {
    const { data, error } = await supabase.rpc('get_qotd_cohort_stats', { p_question_ids: [qotd.id] });
    console.log("RPC Result:", data);
    console.log("RPC Error:", error);
  }
}
run();
