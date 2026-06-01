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
    // @ts-ignore: Override lock with custom timeout to prevent Web Locks API deadlock on Chrome/iOS
    lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks) {
          // Attempt standard Web Lock but force a timeout to prevent infinite deadlocks
          return await Promise.race([
            navigator.locks.request(name, { ifAvailable: false }, fn),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Lock timeout')), 3000))
          ]);
        }
        return await fn();
      } catch (e) {
        console.warn('Web Locks API failed or timed out, bypassing cross-tab lock.', e);
        return await fn();
      }
    },
  }
});
