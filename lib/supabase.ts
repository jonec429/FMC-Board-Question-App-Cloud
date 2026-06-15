import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Bypass navigator.locks to prevent infinite hanging when resuming
    // the PWA from the background (a known issue in iOS WebKit/Safari).
    lock: async (...args: unknown[]) => {
      const acquire = args[args.length - 1] as () => Promise<any>;
      
      return await acquire();
    }
  }
});



