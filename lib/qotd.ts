import { supabase } from './supabase';
import { withTimeout } from './utils';

/**
 * Helper to get the current date explicitly in EST
 */
export function getESTDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Returns true if the current time is past 12:30 PM Eastern Time — the QOTD unlock
 * time (correct answer, explanation, and cohort stats become visible).
 */
export function isPastNoon(date: Date = new Date()): boolean {
  // Get time in Eastern Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour')?.value;
  const minutePart = parts.find(p => p.type === 'minute')?.value;
  
  const currentHour = parseInt(hourPart || '0', 10);
  const currentMinute = parseInt(minutePart || '0', 10);
  
  if (currentHour > 12) return true;
  if (currentHour === 12 && currentMinute >= 30) return true;
  return false;
}

/**
 * Helper to get today's date string (YYYY-MM-DD) in local time (EST)
 */
export function getTodayDateString(date: Date = new Date()): string {
  const estDate = getESTDate(date);
  return `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}-${String(estDate.getDate()).padStart(2, '0')}`;
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
  question: any;
  date: string;       // YYYY-MM-DD
  displayDate: string; // "Mon, May 19"
  index: number;       // For UI numbering if needed
  stats: { correct: number; incorrect: number; total: number } | null;
  reactions: Record<string, number>;
}

/**
 * Fetches past QOTD questions with stats and reactions.
 * Returns `pageSize` items starting from offset, going backwards from yesterday.
 */
export async function getQotdHistory(
  offset: number = 0,
  pageSize: number = 20
): Promise<{ items: QotdHistoryItem[]; hasMore: boolean }> {
  const todayStr = getTodayDateString();

  // Fetch the schedule history backwards from yesterday
  const { data: scheduleData, error } = await withTimeout(supabase
    .from('qotd_schedule')
    .select('schedule_date, question:questions(*)')
    .lt('schedule_date', todayStr)
    .order('schedule_date', { ascending: false })
    .range(offset, offset + pageSize), 10000).catch((e: any) => ({ data: null, error: e })) as any;

  if (error || !scheduleData || scheduleData.length === 0) {
    return { items: [], hasMore: false };
  }

  const hasMore = scheduleData.length > pageSize;
  const pageData = scheduleData.slice(0, pageSize);

  const questionIds: string[] = [];
  const items: QotdHistoryItem[] = [];

  pageData.forEach((row: any, idx: number) => {
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
    });
    questionIds.push(row.question.id);
  });

  if (questionIds.length === 0) {
    return { items: [], hasMore: hasMore };
  }

  // Batch-fetch stats from question_attempts (is_qotd = true)
  const [attemptsResult, reactionsResult] = await Promise.all([
    withTimeout(supabase
      .from('question_attempts')
      .select('question_id, is_correct')
      .in('question_id', questionIds)
      .eq('is_qotd', true), 10000).catch(() => ({ data: null })) as any,
    withTimeout(supabase
      .from('qotd_reactions')
      .select('question_id, reaction')
      .in('question_id', questionIds), 10000).catch(() => ({ data: null })) as any,
  ]);

  // Build stats map
  const statsMap = new Map<string, { correct: number; incorrect: number }>();
  if (attemptsResult.data) {
    for (const a of attemptsResult.data) {
      if (!statsMap.has(a.question_id)) {
        statsMap.set(a.question_id, { correct: 0, incorrect: 0 });
      }
      const entry = statsMap.get(a.question_id)!;
      if (a.is_correct) entry.correct++;
      else entry.incorrect++;
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

  // Merge stats and reactions into items
  for (const item of items) {
    const qid = item.question.id;
    const stats = statsMap.get(qid);
    if (stats) {
      item.stats = { correct: stats.correct, incorrect: stats.incorrect, total: stats.correct + stats.incorrect };
    }
    item.reactions = reactionsMap.get(qid) || {};
  }

  return { items, hasMore };
}
