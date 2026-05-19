import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoinQuery() {
  const { data, error } = await supabase
    .from('block_schedule')
    .select('id, block_id, start_date, end_date, blocks(id, title, block_type, question_count)')
    .order('start_date', { ascending: true });
    
  console.log('Error:', error);
}

testJoinQuery();
