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
      // Each query gets its OWN timeout and runs under Promise.allSettled so that
      // one slow/hung table (e.g. a Supabase cold start) can't sink the entire
      // console. We collect whatever succeeds and soft-fail the rest.
      //
      // Slim `questions` select: only columns confirmed in import_questions.sql.
      // Omits `explanation` and `resource_link` (multi-paragraph, lazy-fetched by
      // QuestionBankManager.openEditModal). Do NOT add columns without verifying
      // they exist in the DB — a missing column fails that query silently.
      // 30s per query: forgiving enough for a sluggish/cold Supabase connection
      // (free tier), while still isolating any single truly-hung query.
      const PER_QUERY_TIMEOUT = 30000;
      const q = <T,>(p: PromiseLike<T>) => withTimeout(p, PER_QUERY_TIMEOUT);

      const settled = await Promise.allSettled([
        q(supabase.from('questions').select('id, question_text, category, year, options, correct_index').order('year', { ascending: false })),
        q(supabase.from('blocks').select('*')),
        q(supabase.from('block_schedule').select('*')),
        q(supabase.from('results').select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at')),
        q(supabase.from('profiles').select('*')),
        // Full roster (faculty included). Consumers filter by track/status.
        q(supabase.from('authorized_roster').select('*')),
      ]);

      // Unwrap a settled result into rows, soft-failing (logged) on timeout/error.
      const unwrap = (s: PromiseSettledResult<any>, name: string): { rows: any[]; failed: boolean } => {
        if (s.status === 'rejected') {
          console.warn(`admin fetch: ${name} timed out / rejected:`, s.reason?.message);
          return { rows: [], failed: true };
        }
        if (s.value?.error) {
          console.warn(`admin fetch: ${name} error:`, s.value.error.message);
          return { rows: [], failed: true };
        }
        return { rows: s.value?.data || [], failed: false };
      };

      const questions = unwrap(settled[0], 'questions');
      const blocks = unwrap(settled[1], 'blocks');
      const schedule = unwrap(settled[2], 'block_schedule');
      const results = unwrap(settled[3], 'results');
      const profiles = unwrap(settled[4], 'profiles');
      const roster = unwrap(settled[5], 'authorized_roster');

      // Only hard-fail if BOTH load-bearing tables fail — the console is still
      // useful (Roster, Attendance) even if questions/blocks are unavailable.
      if (questions.failed && blocks.failed) {
        throw new Error('Failed to load core data (questions and blocks). Please retry.');
      }

      setData({
        questions: questions.rows,
        blocks: blocks.rows,
        block_schedule: schedule.rows,
        results: results.rows,
        profiles: profiles.rows,
        roster: roster.rows,
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
