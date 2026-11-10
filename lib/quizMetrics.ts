import { Result } from './types';

export interface WeightedAccuracyResult {
  /** Question-weighted accuracy percentage (0–100), or null if no valid graded questions */
  accuracy: number | null;
  /** Total questions answered correctly across all included quizzes */
  totalCorrect: number;
  /** Total questions attempted across all included quizzes */
  totalQuestions: number;
  /** Number of graded quiz sessions included */
  quizCount: number;
}

export interface TopicAccuracyStat {
  topic: string;
  avg: number;
  attempts: number;
  correct: number;
  qs: number;
}

/**
 * Checks whether a Result record represents a graded quiz (as opposed to
 * conference attendance logs or manual point adjustments).
 */
export function isGradedQuizResult(
  r: Partial<Result> | null | undefined,
  options?: { excludeQotd?: boolean; excludeDemo?: boolean }
): boolean {
  if (!r) return false;
  if (r.percentage == null && r.score == null) return false;
  if ((r.total || 0) <= 0) return false;

  if (r.topic) {
    if (/\[attendance\]|\[manual\]/i.test(r.topic)) return false;
    const lower = r.topic.toLowerCase();
    if (options?.excludeQotd && lower.includes('question of the day')) return false;
    if (options?.excludeDemo && lower.includes('demo')) return false;
  }

  return true;
}

/**
 * Extracts the exact number of correct answers and total questions for a quiz result.
 * Uses `r.score` directly when present, or reconstructs from `r.percentage * r.total / 100`
 * for any legacy record missing `score`.
 */
export function extractQuizCorrectAndTotal(
  r: Partial<Result>
): { correct: number; total: number } | null {
  const total = r.total || 0;
  if (total <= 0) return null;

  let correct: number;
  if (typeof r.score === 'number' && !Number.isNaN(r.score)) {
    correct = r.score;
  } else if (typeof r.percentage === 'number' && !Number.isNaN(r.percentage)) {
    correct = Math.round((r.percentage / 100) * total);
  } else {
    return null;
  }

  // Clamp to valid bounds [0, total]
  correct = Math.max(0, Math.min(total, correct));
  return { correct, total };
}

/**
 * Computes true question-weighted accuracy (micro-average) across a list of quiz results:
 *   (sum of correct answers / sum of total questions) * 100
 *
 * Example:
 * - Quiz 1: 100% on 10 questions (10 / 10)
 * - Quiz 2: 50% on 40 questions (20 / 40)
 * -> Total: 30 / 50 = 60.0% (instead of unweighted 75.0%)
 */
export function computeWeightedAccuracy(
  results: Array<Partial<Result>> | null | undefined,
  options?: { excludeQotd?: boolean; excludeDemo?: boolean }
): WeightedAccuracyResult {
  if (!results || results.length === 0) {
    return { accuracy: null, totalCorrect: 0, totalQuestions: 0, quizCount: 0 };
  }

  let totalCorrect = 0;
  let totalQuestions = 0;
  let quizCount = 0;

  // Fallback accumulators in case legacy records have percentage but total === 0
  let fallbackPctSum = 0;
  let fallbackCount = 0;

  for (const r of results) {
    if (!r) continue;
    if (r.topic) {
      if (/\[attendance\]|\[manual\]/i.test(r.topic)) continue;
      const lower = r.topic.toLowerCase();
      if (options?.excludeQotd && lower.includes('question of the day')) continue;
      if (options?.excludeDemo && lower.includes('demo')) continue;
    }

    const extracted = extractQuizCorrectAndTotal(r);
    if (extracted) {
      totalCorrect += extracted.correct;
      totalQuestions += extracted.total;
      quizCount += 1;
    } else if (typeof r.percentage === 'number' && !Number.isNaN(r.percentage)) {
      fallbackPctSum += r.percentage;
      fallbackCount += 1;
    }
  }

  if (totalQuestions > 0) {
    return {
      accuracy: (totalCorrect / totalQuestions) * 100,
      totalCorrect,
      totalQuestions,
      quizCount,
    };
  }

  if (fallbackCount > 0) {
    return {
      accuracy: fallbackPctSum / fallbackCount,
      totalCorrect: 0,
      totalQuestions: 0,
      quizCount: fallbackCount,
    };
  }

  return { accuracy: null, totalCorrect: 0, totalQuestions: 0, quizCount: 0 };
}

/**
 * Groups quiz results by topic and computes question-weighted accuracy for each topic.
 */
export function computeTopicBreakdown(
  results: Array<Partial<Result>> | null | undefined
): TopicAccuracyStat[] {
  if (!results || results.length === 0) return [];

  const topicStats = new Map<
    string,
    { correct: number; qs: number; pctSum: number; count: number }
  >();

  for (const r of results) {
    if (!r || !r.topic) continue;
    const t = r.topic.toLowerCase();
    if (
      t.includes('question of the day') ||
      t.includes('[attendance]') ||
      t.includes('[manual]')
    ) {
      continue;
    }

    if (!topicStats.has(r.topic)) {
      topicStats.set(r.topic, { correct: 0, qs: 0, pctSum: 0, count: 0 });
    }
    const entry = topicStats.get(r.topic)!;
    const extracted = extractQuizCorrectAndTotal(r);
    if (extracted) {
      entry.correct += extracted.correct;
      entry.qs += extracted.total;
    }
    entry.pctSum += r.percentage || 0;
    entry.count += 1;
  }

  return Array.from(topicStats.entries())
    .map(([topic, { correct, qs, pctSum, count }]) => ({
      topic,
      avg: qs > 0 ? (correct / qs) * 100 : count > 0 ? pctSum / count : 0,
      attempts: count,
      correct,
      qs,
    }))
    .sort((a, b) => b.avg - a.avg);
}
