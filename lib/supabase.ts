import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // @ts-ignore
    lock: (...args: any[]) => {
      console.log('LOCK OVERRIDE CALLED WITH ARGS:', args);
      const cb = args[args.length - 1];
      if (typeof cb === 'function') {
        return cb();
      }
      return Promise.resolve();
    }
  }
});
