import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number = 30000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), ms)
  );
  return Promise.race([Promise.resolve(promise), timeout]);
}

async function testWithTimeout() {
  try {
    const fetchTask = Promise.all([
      supabase.from('blocks').select('*'),
      supabase.from('questions').select('id, question_text, category, year, options, correct_index'),
      supabase.from('results').select('topic'),
    ]);
    const res = await withTimeout(fetchTask, 5000);
    console.log('Result length:', res.length);
    
    // Also test single query
    const singleRes = await withTimeout(supabase.from('questions').select('*').limit(1), 5000);
    console.log('Single query data:', singleRes.data?.length);
  } catch (err) {
    console.error('Caught error:', err);
  }
}

testWithTimeout();
