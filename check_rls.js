import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// We need an actual user token to test RLS accurately, but we can't easily get it here.
// I'll just check the DB using the service role key to see the exact policy definitions.

const supabaseService = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseService.rpc('execute_sql', { query: "SELECT * FROM pg_policies WHERE tablename = 'quiz_sessions'" });
  if (error) {
    // try direct postgres query if rpc doesn't exist
    console.log("No rpc:", error.message);
  } else {
    console.log("Policies:", data);
  }
}
check();
