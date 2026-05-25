import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdminData } from '@/lib/types';

type CoreData = Omit<AdminData, 'questions'>;

/**
 * Core admin tables — all small (blocks, schedule, results, profiles, roster).
 * Bundled in one query via Promise.all. If the database connection drops or 
 * throttles, this will throw an error and React Query will automatically retry 
 * up to 3 times before displaying the error UI.
 */
async function fetchCore(): Promise<CoreData> {
  const [blocksRes, scheduleRes, resultsRes, profilesRes, rosterRes] = await Promise.all([
    supabase.from('blocks').select('*'),
    supabase.from('block_schedule').select('*'),
    supabase.from('results').select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at'),
    supabase.from('profiles').select('*'),
    supabase.from('authorized_roster').select('*'),
  ]);

  const failures = [blocksRes, scheduleRes, resultsRes, profilesRes, rosterRes].filter((r) => r.error);
  if (failures.length > 0) {
    const errorMessages = failures.map(f => f.error?.message).join(' | ');
    throw new Error(`Failed to load admin data: ${errorMessages}`);
  }

  return {
    blocks: blocksRes.data || [],
    block_schedule: scheduleRes.data || [],
    results: resultsRes.data || [],
    profiles: profilesRes.data || [],
    roster: rosterRes.data || [],
  };
}

/**
 * Questions is the heaviest table — fetched lazily, only when a tab needs it
 * (Questions / Curriculum). Slim select omits `explanation`/`resource_link`
 * (lazy-fetched in the question editor). Do NOT add columns without verifying
 * they exist in the DB — a missing column fails the whole query.
 */
async function fetchQuestions(): Promise<any[]> {
  const res: any = await supabase
    .from('questions')
    .select('id, question_text, category, year, options, correct_index')
    .order('year', { ascending: false });

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

  // Allow React Query to handle retries natively (defaults to 3 retries)
  const coreQuery = useQuery({ 
    queryKey: ['admin', 'core'], 
    queryFn: fetchCore 
  });

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions'],
    queryFn: fetchQuestions,
    enabled: includeQuestions
  });

  const data: AdminData | null = coreQuery.data
    ? { ...coreQuery.data, questions: questionsQuery.data ?? [] }
    : null;

  // Show the full-screen loader for the initial core load, and for the first
  // lazy-load of questions. Subsequent cache-refetches happen invisibly.
  const loading = coreQuery.isLoading || (includeQuestions && questionsQuery.isLoading);
  
  const error = coreQuery.error || questionsQuery.error;

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  return { data, loading, error, refetch };
}
