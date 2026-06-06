import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetchAll() {
  try {
    const fetchTask = Promise.all([
      supabase.from('blocks').select('*'),
      supabase.from('questions').select('id, question_text, category, year, options, correct_index'),
      supabase.from('results').select('topic'),
    ]);
    const res = await fetchTask;
    console.log('Result 1 (blocks) error:', res[0].error);
    console.log('Result 2 (questions) error:', res[1].error);
    console.log('Result 3 (results) error:', res[2].error);
  } catch (err) {
    console.error('Caught error:', err);
  }
}

testFetchAll();
