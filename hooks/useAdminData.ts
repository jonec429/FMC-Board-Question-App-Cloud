import { useQuery, useQueryClient } from '@tanstack/react-query';
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

type CoreData = Omit<AdminData, 'questions'>;

// Per-query timeout as defense-in-depth; React Query retries on top of this.
const PER_QUERY_TIMEOUT = 30000;
const q = <T,>(p: PromiseLike<T>) => withTimeout(p, PER_QUERY_TIMEOUT);

function unwrap(s: PromiseSettledResult<any>, name: string): { rows: any[]; failed: boolean } {
  if (s.status === 'rejected') {
    console.warn(`admin fetch: ${name} timed out / rejected:`, s.reason?.message);
    return { rows: [], failed: true };
  }
  if (s.value?.error) {
    console.warn(`admin fetch: ${name} error:`, s.value.error.message);
    return { rows: [], failed: true };
  }
  return { rows: s.value?.data || [], failed: false };
}

/**
 * Core admin tables — all small (blocks, schedule, results, profiles, roster).
 * Bundled in one query; individual table failures soft-fail to []. Throws only
 * on a total outage so React Query retries and eventually surfaces the error UI.
 */
async function fetchCore(): Promise<CoreData> {
  const settled = await Promise.allSettled([
    q(supabase.from('blocks').select('*')),
    q(supabase.from('block_schedule').select('*')),
    q(supabase.from('results').select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at')),
    q(supabase.from('profiles').select('*')),
    // Full roster (faculty included). Consumers filter by track/status.
    q(supabase.from('authorized_roster').select('*')),
  ]);

  const blocks = unwrap(settled[0], 'blocks');
  const schedule = unwrap(settled[1], 'block_schedule');
  const results = unwrap(settled[2], 'results');
  const profiles = unwrap(settled[3], 'profiles');
  const roster = unwrap(settled[4], 'authorized_roster');

  if ([blocks, schedule, results, profiles, roster].every((r) => r.failed)) {
    throw new Error('Failed to load admin data. Please retry.');
  }

  return {
    blocks: blocks.rows,
    block_schedule: schedule.rows,
    results: results.rows,
    profiles: profiles.rows,
    roster: roster.rows,
  };
}

/**
 * Questions is the heaviest table — fetched lazily, only when a tab needs it
 * (Questions / Curriculum). Slim select omits `explanation`/`resource_link`
 * (lazy-fetched in the question editor). Do NOT add columns without verifying
 * they exist in the DB — a missing column fails the whole query.
 */
async function fetchQuestions(): Promise<any[]> {
  const res: any = await q(
    supabase
      .from('questions')
      .select('id, question_text, category, year, options, correct_index')
      .order('year', { ascending: false })
  );
  if (res?.error) throw res.error;
  return res?.data || [];
}

/**
 * Admin data layer, powered by React Query (retries, caching, dedup,
 * stale-while-revalidate). Core tables always load; `questions` is gated by
 * `includeQuestions` so the heavy fetch only happens on the tabs that use it.
 * Keeps the original return shape so consumers are unchanged.
 */
export function useAdminData({ includeQuestions = false }: { includeQuestions?: boolean } = {}) {
  const queryClient = useQueryClient();

  const coreQuery = useQuery({ queryKey: ['admin', 'core'], queryFn: fetchCore });

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions'],
    queryFn: fetchQuestions,
    enabled: includeQuestions,
  });

  const data: AdminData | null = coreQuery.data
    ? { ...coreQuery.data, questions: questionsQuery.data ?? [] }
    : null;

  // Show the full-screen loader for the initial core load, and for the first
  // questions fetch when a questions-dependent tab is opened (cached after).
  const loading = coreQuery.isLoading || (includeQuestions && questionsQuery.isLoading);
  const error = coreQuery.error ? (coreQuery.error as Error).message : null;

  // Refetch everything admin-related; disabled (idle) queries refetch when next enabled.
  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  return { data, loading, error, refetch };
}
