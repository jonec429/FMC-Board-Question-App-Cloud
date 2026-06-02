import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getQotdQuestion } from '@/lib/qotd';
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
  if (block.sort_order != null) return block.sort_order;
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
        { data: qotdAttemptData, error: qotdAttemptErr }
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
        selectedYear === 0
          ? supabase.from('results').select('legacy_email, topic, total, academic_points').abortSignal(signal)
          : supabase.from('results').select('legacy_email, topic, total, academic_points').eq('academic_year', selectedYear).abortSignal(signal),
        supabase.from('authorized_roster').select('name, email, pgy').neq('pgy', 'Faculty').abortSignal(signal),
        qotd 
          ? supabase
              .from('question_attempts')
              .select('*')
              .eq('user_id', userId)
              .eq('question_id', qotd.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .abortSignal(signal)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
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

        const byEmail = new Map<string, { topicBest: Map<string, number>; qs: number }>();
        allResults.forEach((r: any) => {
          if (r.topic?.toLowerCase().includes('demo')) return;
          const email = r.legacy_email?.toLowerCase();
          if (!email) return;
          if (!byEmail.has(email)) byEmail.set(email, { topicBest: new Map(), qs: 0 });
          const entry = byEmail.get(email)!;
          const cur = entry.topicBest.get(r.topic) || 0;
          entry.topicBest.set(r.topic, Math.max(cur, r.academic_points || 0));
          entry.qs += r.total || 0;
        });

        rosterByEmail.forEach(({ name, pgy }, email) => {
          const entry = byEmail.get(email);
          const totalPoints = entry ? Array.from(entry.topicBest.values()).reduce((a, b) => a + b, 0) : 0;
          const totalQs = entry?.qs || 0;
          leaderboard.push({ email, name, pgy, totalPoints, totalQs });
        });
        leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
      }

      return {
        blocks: sortedBlocks,
        myResults,
        activeSession: sessionData || null,
        leaderboard,
        hasTakenDemo,
        qotdQuestion: qotd || null,
        qotdAttempt: qotdAttemptData || null,
        userStreak: streakData || null,
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
