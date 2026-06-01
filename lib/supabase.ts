import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // @ts-ignore: Disable multiTab to prevent navigator.locks infinite hangs on iOS / PWAs
    multiTab: false,
    // @ts-ignore: Override lock with no-op to completely bypass Web Locks API hanging
    lock: async (name: string, callback: () => Promise<any>) => callback(),
  }
});
