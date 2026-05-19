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
      // Slim `questions` select: omits `explanation` and `resource_link`. Those fields
      // are multi-paragraph and only needed by the QuestionBankManager edit modal,
      // which lazy-fetches the full row on demand. Pulling them upfront blew past
      // the 30s timeout on the initial admin load.
      const fetchTask = Promise.all([
        supabase.from('questions').select('id, question_text, category, year, keyword, options, correct_index').order('year', { ascending: false }),
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
      ] = await withTimeout(fetchTask, 45000);

      // Soft failures: log per-table errors, show whatever loaded. Only escalate to
      // a hard error if BOTH load-bearing tables (questions + blocks) fail — the
      // admin console can still be useful (Roster, Attendance) without questions.
      const failed: string[] = [];
      if (qRes.error) { console.warn('admin fetch: questions failed:', qRes.error.message); failed.push('questions'); }
      if (blocksRes.error) { console.warn('admin fetch: blocks failed:', blocksRes.error.message); failed.push('blocks'); }
      if (scheduleRes.error) console.warn('admin fetch: block_schedule failed:', scheduleRes.error.message);
      if (resultsRes.error) console.warn('admin fetch: results failed:', resultsRes.error.message);
      if (profilesRes.error) console.warn('admin fetch: profiles failed:', profilesRes.error.message);
      if (rosterRes.error) console.warn('admin fetch: roster failed:', rosterRes.error.message);

      if (failed.length === 2) {
        throw new Error('Failed to load core data (questions and blocks both unavailable). Please retry.');
      }

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
