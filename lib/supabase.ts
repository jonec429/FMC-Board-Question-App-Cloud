import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: {
      acquire: (name: string, acquireCallback: () => Promise<any>) => {
        // Bypass navigator.locks entirely to prevent infinite hangs if another background tab has a stale lock
        return acquireCallback();
      }
    } as any,
  }
});
