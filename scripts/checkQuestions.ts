import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuestions() {
  const { data, count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true });
  console.log('questions count:', count);
  console.log('questions error:', error);
}

checkQuestions();
