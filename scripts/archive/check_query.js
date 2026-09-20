import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const today = new Date().toISOString().split('T')[0];
    console.log('today:', today);
    const { data: bData, error } = await supabase
      .from('block_schedule')
      .select('*, blocks(*)')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    console.log('bData:', JSON.stringify(bData, null, 2));
    console.log('error:', error);
}
run();
