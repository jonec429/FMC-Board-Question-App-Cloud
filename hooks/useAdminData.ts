import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/supabasePagination';
import { AdminData } from '@/lib/types';

type CoreData = Omit<AdminData, 'questions'>;

async function fetchCore(): Promise<CoreData> {
  const [blocksRes, scheduleRes, profilesRes, rosterRes] = await Promise.all([
    supabase.from('blocks').select('*'),
    supabase.from('block_schedule').select('*'),
    supabase.from('profiles').select('*'),
    supabase.from('authorized_roster').select('*'),
  ]);

  const failures = [blocksRes, scheduleRes, profilesRes, rosterRes].filter((r) => r.error);
  if (failures.length > 0) {
    const errorMessages = failures.map(f => f.error?.message).join(' | ');
    throw new Error(`Failed to load admin data: ${errorMessages}`);
  }

  // Fetch potentially large tables with deterministic 1,000-row pagination
  const [resultsData, attendanceData] = await Promise.all([
    fetchAllPages<any>((from, to) =>
      supabase
        .from('results')
        .select('user_id, legacy_email, topic, score, total, percentage, academic_points, created_at, academic_year, timing_status, category_stats, review_data')
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllPages<any>((from, to) =>
      supabase
        .from('attendance')
        .select('*')
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ]);

  return {
    blocks: blocksRes.data || [],
    block_schedule: scheduleRes.data || [],
    results: resultsData || [],
    profiles: profilesRes.data || [],
    roster: rosterRes.data || [],
    attendance: attendanceData || [],
  };
}

/**
 * Questions is the heaviest table — fetched lazily, only when a tab needs it
 * (Questions / Curriculum). Slim select omits `explanation`/`resource_link`
 * (lazy-fetched in the question editor). Do NOT add columns without verifying
 * they exist in the DB — a missing column fails the whole query.
 */
async function fetchQuestions(): Promise<any[]> {
  return fetchAllPages((from, to) =>
    supabase
      .from('questions')
      .select('id, question_text, category, year, options, correct_index')
      .order('year', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
  );
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

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  }, [queryClient]);

  return { data, loading, error, refetch };
}
