import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getQotdQuestion, getTodayDateString } from '@/lib/qotd';
import { computeQotdStreak } from '@/lib/streaks';
import { Block, Result, Question } from '@/lib/types';

interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
}

interface DashboardData {
  blocks: Block[];
  myResults: Result[];
  activeSession: any;
  leaderboard: LeaderboardEntry[];
  hasTakenDemo: boolean;
  qotdQuestion: Question | null;
  qotdAttempt: Result | null;
  userStreak: any;
  userBadges: any[];
}

function getBlockSortKey(block: any): number {
  if (block.sort_order) return block.sort_order; // 0 or null = unset → fall through to title-based order
  const t = block.title || '';
  if (/^demo/i.test(t)) return 9999;
  const m = t.match(/Block\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  if (/bonus/i.test(t)) return 500;
  return 1000;
}

export function useDashboardData(userId: string, userEmail: string, selectedYear: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard', userId, selectedYear],
    queryFn: async ({ signal }): Promise<DashboardData> => {
      // BATCH 1: Critical UI Data
      const [
        { data: blockData, error: blockErr },
        { data: sessionData, error: sessionErr },
        { data: streakData, error: streakErr },
        { data: badgesData, error: badgesErr },
        qotd
      ] = (await Promise.all([
        selectedYear === 0 
          ? supabase.from('blocks').select('*').eq('is_archived', false).abortSignal(signal)
          : supabase.from('blocks').select('*').eq('is_archived', false).eq('academic_year', selectedYear).abortSignal(signal),
        supabase
          .from('quiz_sessions')
          .select('id, topic, quiz_id, current_index, answers, last_updated')
          .eq('user_id', userId)
          .eq('is_completed', false)
          .order('last_updated', { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle(),
        supabase.from('user_streaks').select('*').eq('user_id', userId).abortSignal(signal).maybeSingle(),
        supabase.from('user_badges').select('earned_at, badges(*)').eq('user_id', userId).abortSignal(signal),
        getQotdQuestion(signal).catch(e => {
          console.warn('QOTD fetch failed:', e);
          return null;
        })
      ])) as any[];

      const err1 = blockErr || sessionErr || streakErr || badgesErr;
      if (err1) throw new Error(err1.message || 'Failed to fetch critical dashboard data');

      // BATCH 2: Leaderboard & Heavy Data
      const [
        { data: resultsData, error: resultsErr },
        { data: allResults, error: allResultsErr },
        { data: rosterData, error: rosterErr },
        { data: qotdAttemptData, error: qotdAttemptErr },
        { data: qotdHistoryData }
      ] = (await Promise.all([
        selectedYear === 0
          ? supabase
              .from('results')
              .select('*')
              .or(`user_id.eq.${userId},legacy_email.eq.${userEmail}`)
              .order('created_at', { ascending: false })
              .abortSignal(signal)
          : supabase
              .from('results')
              .select('*')
              .eq('academic_year', selectedYear)
              .or(`user_id.eq.${userId},legacy_email.eq.${userEmail}`)
              .order('created_at', { ascending: false })
              .abortSignal(signal),
        supabase.rpc('get_leaderboard_stats', { p_academic_year: selectedYear }).abortSignal(signal),
        supabase.from('authorized_roster').select('name, email, pgy').neq('pgy', 'Faculty').abortSignal(signal),
        qotd 
          ? supabase
              .from('question_attempts')
              .select('*')
              .eq('user_id', userId)
              .eq('question_id', qotd.id)
              // Only count it "answered" if it was answered AS the QOTD — without
              // this, a prior attempt at the same question inside a normal block
              // would wrongly mark today's QOTD complete and skip to the reactions.
              .eq('is_qotd', true)
              .order('created_at', { ascending: false })
              .limit(1)
              .abortSignal(signal)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        // QOTD answer history (timestamps) — feeds the self-healing streak below.
        supabase
          .from('question_attempts')
          .select('created_at')
          .eq('user_id', userId)
          .eq('is_qotd', true)
          .abortSignal(signal)
      ])) as any[];

      const err2 = resultsErr || allResultsErr || rosterErr || qotdAttemptErr;
      if (err2) throw new Error(err2.message || 'Failed to fetch leaderboard data');

      // Process blocks
      const sortedBlocks = blockData ? [...blockData].sort((a, b) => getBlockSortKey(a) - getBlockSortKey(b)) : [];
      
      // Process results
      const hasTakenDemo = resultsData ? resultsData.some((r: any) => r.topic?.toLowerCase().includes('demo')) : false;
      const myResults = resultsData ? resultsData.filter((r: any) => !r.topic?.toLowerCase().includes('demo')) : [];

      // Process badges
      const userBadges = badgesData ? badgesData.map((b: any) => ({ ...b.badges, earned_at: b.earned_at })) : [];

      // Process leaderboard
      let leaderboard: LeaderboardEntry[] = [];
      if (allResults && rosterData) {
        const rosterByEmail = new Map<string, { name: string; pgy: string }>();
        rosterData.forEach((r: any) => {
          if (r.email) rosterByEmail.set(r.email.toLowerCase(), { name: r.name, pgy: r.pgy });
        });

        const aggregatedByEmail = new Map<string, { totalPoints: number; totalQs: number }>();
        allResults.forEach((r: any) => {
          const email = r.legacy_email?.toLowerCase();
          if (!email) return;
          aggregatedByEmail.set(email, { 
            totalPoints: Number(r.total_points) || 0, 
            totalQs: Number(r.total_qs) || 0 
          });
        });

        rosterByEmail.forEach(({ name, pgy }, email) => {
          const entry = aggregatedByEmail.get(email);
          const totalPoints = entry ? entry.totalPoints : 0;
          const totalQs = entry ? entry.totalQs : 0;
          leaderboard.push({ email, name, pgy, totalPoints, totalQs });
        });
        leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
      }

      // Self-healing QOTD streak — derived from the user's real answer history
      // (EST dates), so a failed/late gamification write or a schedule reset can't
      // silently break it. Overrides the stored counter for display.
      const qotdAnsweredDates = (qotdHistoryData || [])
        .map((r: any) => (r.created_at ? getTodayDateString(new Date(r.created_at)) : null))
        .filter(Boolean) as string[];
      const computedQotdStreak = computeQotdStreak(qotdAnsweredDates, getTodayDateString());
      const mergedStreak = streakData
        ? {
            ...streakData,
            current_qotd_streak: computedQotdStreak,
            max_qotd_streak: Math.max(streakData.max_qotd_streak || 0, computedQotdStreak),
          }
        : computedQotdStreak > 0
          ? { current_qotd_streak: computedQotdStreak, max_qotd_streak: computedQotdStreak }
          : null;

      return {
        blocks: sortedBlocks,
        myResults,
        activeSession: sessionData || null,
        leaderboard,
        hasTakenDemo,
        qotdQuestion: qotd || null,
        // Only treat the QOTD as "answered" if the attempt was logged TODAY (Eastern).
        // The schedule clock has been reset before, which can re-serve a question the
        // user already answered as a QOTD on an earlier day — without this date check
        // that stale attempt wrongly flips today's card to "Answer recorded."
        qotdAttempt:
          qotdAttemptData?.created_at &&
          getTodayDateString(new Date(qotdAttemptData.created_at)) === getTodayDateString()
            ? qotdAttemptData
            : null,
        userStreak: mergedStreak,
        userBadges,
      };
    },
    staleTime: 60000, // Data is fresh for 60 seconds
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return { 
    data: query.data, 
    loading: query.isLoading, 
    error: query.error, 
    refetch 
  };
}
