import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/supabasePagination';

export interface QuestionStat {
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number; // 0 - 100
  difficulty: 'hard' | 'moderate' | 'high_yield' | 'untested';
}

let cachedStats: Record<string, QuestionStat> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches and aggregates program-wide question accuracy from question_attempts.
 */
export async function getQuestionPerformanceStats(): Promise<Record<string, QuestionStat>> {
  const now = Date.now();
  if (cachedStats && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedStats;
  }

  try {
    const allAttempts = await fetchAllPages<{ question_id: string; is_correct: boolean | null }>(
      (from, to) =>
        supabase
          .from('question_attempts')
          .select('question_id, is_correct')
          .order('id', { ascending: true })
          .range(from, to)
    );

    const map: Record<string, { total: number; correct: number }> = {};

    for (const a of allAttempts) {
      if (!a.question_id) continue;
      if (!map[a.question_id]) {
        map[a.question_id] = { total: 0, correct: 0 };
      }
      map[a.question_id].total++;
      if (a.is_correct) {
        map[a.question_id].correct++;
      }
    }

    const result: Record<string, QuestionStat> = {};

    for (const [qId, s] of Object.entries(map)) {
      const rate = Math.round((s.correct / s.total) * 100);
      let difficulty: QuestionStat['difficulty'] = 'untested';
      if (s.total >= 3) {
        if (rate < 50) difficulty = 'hard';
        else if (rate <= 75) difficulty = 'moderate';
        else difficulty = 'high_yield';
      }

      result[qId] = {
        totalAttempts: s.total,
        correctAttempts: s.correct,
        accuracyRate: rate,
        difficulty,
      };
    }

    cachedStats = result;
    lastFetchTime = now;
    return result;
  } catch (err) {
    console.warn('Failed to aggregate question performance stats:', err);
    return cachedStats || {};
  }
}
