import { supabase } from './supabase';
import { withTimeout } from './utils';
import { Question } from '@/lib/types';
import {
  getEasternDateString,
  getESTDate,
  isPastNoonEastern
} from './timezone';

// Re-export timezone helpers so existing imports stay intact
export { getEasternDateString, getESTDate };

/**
 * Returns true if the current time is past 12:30 PM Eastern Time — the QOTD unlock
 * time (correct answer, explanation, and cohort stats become visible).
 * Uses robust hourCycle: 'h23' check in lib/timezone to prevent midnight glitches.
 */
export function isPastNoon(date: Date = new Date()): boolean {
  return isPastNoonEastern(date);
}

/**
 * Helper to get today's date string (YYYY-MM-DD) in Eastern Time (America/New_York).
 */
export function getTodayDateString(date: Date = new Date()): string {
  return getEasternDateString(date);
}

/**
 * Fetches the specific question for the day directly from the qotd_schedule table.
 */
export async function getQotdQuestion(signal?: AbortSignal) {
  const todayStr = getTodayDateString();

  let query = supabase
    .from('qotd_schedule')
    .select('question:questions(*)')
    .eq('schedule_date', todayStr);

  if (signal) query = query.abortSignal(signal);

  // .maybeSingle() must be the terminal call: it returns a builder that no longer
  // exposes .abortSignal(), so the abort signal has to be attached before it.
  const { data, error } = await query.maybeSingle();

  if (error || !data || !data.question) {
    // Graceful fallback for weekends or if the schedule table hasn't been populated
    return null;
  }

  return data.question;
}

export interface QotdHistoryItem {
  question: Question;
  date: string;       // YYYY-MM-DD
  displayDate: string; // "Mon, May 19"
  index: number;       // For UI numbering if needed
  stats: { correct: number; incorrect: number; total: number } | null;
  reactions: Record<string, number>;
  userAttempt?: {
    isCorrect: boolean;
    selectedIndex: number | null;
    answeredAt: string;
  } | null;
}

/**
 * Fetches past QOTD questions with stats, reactions, and the user's attempt status (if userId provided).
 * Returns `pageSize` items starting from offset, going backwards from yesterday.
 */
export async function getQotdHistory(
  offset: number = 0,
  pageSize: number = 20,
  userId?: string
): Promise<{ items: QotdHistoryItem[]; hasMore: boolean }> {
  const todayStr = getTodayDateString();

  // Fetch the schedule history backwards from yesterday
  const { data: scheduleData, error } = await withTimeout(supabase
    .from('qotd_schedule')
    .select('schedule_date, question:questions(*)')
    .lt('schedule_date', todayStr)
    .order('schedule_date', { ascending: false })
    .range(offset, offset + pageSize), 10000).catch((e: unknown) => ({ data: null, error: e }));

  if (error || !scheduleData || scheduleData.length === 0) {
    return { items: [], hasMore: false };
  }

  const hasMore = scheduleData.length > pageSize;
  const pageData = scheduleData.slice(0, pageSize);

  const questionIds: string[] = [];
  const items: QotdHistoryItem[] = [];

  pageData.forEach((row: { schedule_date: string; question: Question }, idx: number) => {
    if (!row.question) return;
    
    // Create display date
    // Make sure we parse the date string assuming it's EST so it doesn't shift
    const [year, month, day] = row.schedule_date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    const displayDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    items.push({
      question: row.question,
      date: row.schedule_date,
      displayDate,
      index: offset + idx,
      stats: null,
      reactions: {},
      userAttempt: null,
    });
    questionIds.push(row.question.id);
  });

  if (questionIds.length === 0) {
    return { items: [], hasMore: hasMore };
  }

  // Batch-fetch stats via RPC, reactions via table read, and user attempts if userId is given
  const [attemptsResult, reactionsResult, userAttemptsResult] = await Promise.all([
    withTimeout(
      supabase.rpc('get_qotd_cohort_stats', { p_question_ids: questionIds }),
      10000
    ).catch(() => ({ data: null })) as any,
    withTimeout(supabase
      .from('qotd_reactions')
      .select('question_id, reaction')
      .in('question_id', questionIds), 10000).catch(() => ({ data: null })) as any,
    userId
      ? withTimeout(supabase
          .from('question_attempts')
          .select('question_id, is_correct, selected_index, created_at')
          .eq('user_id', userId)
          .eq('is_qotd', true)
          .in('question_id', questionIds)
          .order('created_at', { ascending: false }), 10000).catch(() => ({ data: null })) as any
      : Promise.resolve({ data: null }),
  ]);

  // Build stats map
  const statsMap = new Map<string, { correct: number; incorrect: number }>();
  if (attemptsResult.data) {
    for (const a of attemptsResult.data) {
      statsMap.set(a.question_id, {
        correct: Number(a.correct) || 0,
        incorrect: Number(a.incorrect) || 0
      });
    }
  }

  // Build reactions map
  const reactionsMap = new Map<string, Record<string, number>>();
  if (reactionsResult.data) {
    for (const r of reactionsResult.data) {
      if (!reactionsMap.has(r.question_id)) {
        reactionsMap.set(r.question_id, {});
      }
      const entry = reactionsMap.get(r.question_id)!;
      entry[r.reaction] = (entry[r.reaction] || 0) + 1;
    }
  }

  // Build user attempts map
  const userAttemptsMap = new Map<string, { isCorrect: boolean; selectedIndex: number | null; answeredAt: string }>();
  if (userAttemptsResult?.data) {
    for (const ua of userAttemptsResult.data) {
      if (!userAttemptsMap.has(ua.question_id)) {
        userAttemptsMap.set(ua.question_id, {
          isCorrect: ua.is_correct,
          selectedIndex: ua.selected_index,
          answeredAt: ua.created_at
        });
      }
    }
  }

  // Merge stats, reactions, and user attempt into items
  for (const item of items) {
    const qid = item.question.id;
    const stats = statsMap.get(qid);
    if (stats) {
      item.stats = { correct: stats.correct, incorrect: stats.incorrect, total: stats.correct + stats.incorrect };
    }
    item.reactions = reactionsMap.get(qid) || {};
    item.userAttempt = userAttemptsMap.get(qid) || null;
  }

  return { items, hasMore };
}



