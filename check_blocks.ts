import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: blocks } = await supabase.from('blocks').select('*');
  const { data: scheds } = await supabase.from('block_schedule').select('*');
  
  if (!blocks) return;
  console.log(`Found ${blocks.length} blocks`);
  
  for (const b of blocks.slice(0, 10)) {
    const s = scheds?.find(x => x.block_id === b.id);
    console.log(`[${b.title}] AY:${b.academic_year} | Start:${s?.start_date} End:${s?.end_date}`);
  }
}
run();
