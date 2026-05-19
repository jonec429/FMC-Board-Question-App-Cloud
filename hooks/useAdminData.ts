import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';

export interface AdminData {
  questions: any[];
  blocks: any[];
  block_schedule: any[];
  results: any[];
  profiles: any[];
  roster: any[];
}

export function useAdminData(userIsAdmin: boolean) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // We fetch the core curriculum and performance datasets all at once.
      // This takes 2-4 seconds on initial load, but makes tab switching instant.
      const fetchTask = Promise.all([
        supabase.from('questions').select('*').order('year', { ascending: false }),
        supabase.from('blocks').select('*'),
        supabase.from('block_schedule').select('*'),
        supabase.from('results').select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at'),
        supabase.from('profiles').select('*'),
        supabase.from('authorized_roster').select('*').neq('pgy', 'Faculty'),
      ]);

      const [
        qRes,
        blocksRes,
        scheduleRes,
        resultsRes,
        profilesRes,
        rosterRes
      ] = await withTimeout(fetchTask, 30000);

      // Check for hard errors on critical tables
      if (qRes.error) throw qRes.error;
      if (blocksRes.error) throw blocksRes.error;

      setData({
        questions: qRes.data || [],
        blocks: blocksRes.data || [],
        block_schedule: scheduleRes.data || [],
        results: resultsRes.data || [],
        profiles: profilesRes.data || [],
        roster: rosterRes.data || [],
      });
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      setError(err.message || 'Failed to load database. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}
