import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  const { data, error } = await supabase.rpc('query_sql', { sql: "SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'" });
  if (error) {
    console.log('rpc failed, trying direct pg_class query...');
    // In Postgres, we can query pg_class directly
    const { data: classData, error: classErr } = await supabase.from('pg_class').select('relname, relrowsecurity').in('relname', ['questions', 'blocks', 'block_schedule']);
    console.log('RLS Status:', classData);
  } else {
    console.log(data);
  }
}

checkRLS();
