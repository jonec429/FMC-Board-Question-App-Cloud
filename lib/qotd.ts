import { supabase } from './supabase';
import { getCurrentAcademicYear } from './academicYear';
import { withTimeout } from './utils';

/**
 * Helper to get the current date explicitly in EST
 */
export function getESTDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Calculates the deterministic index of the QOTD based on the number of weekdays
 * since July 1st of the current academic year.
 */
export function getQotdIndex(date: Date = new Date()): number | null {
  const estDate = getESTDate(date);
  const dayOfWeek = estDate.getDay();
  // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return null; // No QOTD on weekends
  }

  const academicYear = getCurrentAcademicYear();
  
  // Base start date is July 1st of the starting year of the academic year
  // (e.g., if academicYear is 2026, the year started July 1, 2025)
  let startDate = new Date(academicYear - 1, 6, 1); // Month is 0-indexed (6 = July)
  
  // QOTD feature was launched on May 21, 2026. For the 2026 academic year,
  // we start the clock here so we don't "burn" questions prior to the app's release.
  if (academicYear === 2026) {
    startDate = new Date(2026, 4, 21); // Month 4 = May
  }
  
  // Strip time for accurate day counting
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const current = new Date(estDate.getFullYear(), estDate.getMonth(), estDate.getDate());

  // If current date is before the start date, the QOTD hasn't started yet
  if (current < start) {
    return null;
  }

  let weekdays = 0;
  const tempDate = new Date(start);

  while (tempDate <= current) {
    const day = tempDate.getDay();
    if (day !== 0 && day !== 6) {
      weekdays++;
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Returns 0-indexed offset (e.g. 1st weekday = 0)
  return Math.max(0, weekdays - 1);
}

/**
 * Fetches the specific question for the day directly from Supabase.
 */
export async function getQotdQuestion(signal?: AbortSignal) {
  const index = getQotdIndex();
  if (index === null) return null; // Weekend

  // Fetch the Nth question, ordered by year DESC and id ASC
  // Excluding Demo questions
  let query = supabase
    .from('questions')
    .select('*')
    .neq('year', 'Demo')
    .neq('category', 'Demo')
    .not('id', 'in', '("00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003")')
    .order('year', { ascending: false })
    .order('id', { ascending: true })
    .range(index, index);

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query.single();

  if (error || !data) {
    console.error('Error fetching QOTD:', error);
    return null;
  }

  return data;
}

/**
 * Returns true if the current time is past 12:25 PM Eastern Time.
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
  if (currentHour === 12 && currentMinute >= 25) return true;
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
 * Reverse-computes the calendar date for a given QOTD weekday index.
 * Starting from July 1 of (academicYear-1), counts forward `targetIndex` weekdays.
 */
export function getDateForQotdIndex(targetIndex: number, academicYear?: number): Date {
  const year = academicYear ?? getCurrentAcademicYear();
  let startDate = new Date(year - 1, 6, 1); // July 1
  
  if (year === 2026) {
    startDate = new Date(2026, 4, 21); // May 21
  }

  const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  let weekdays = 0;
  while (weekdays <= targetIndex) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      if (weekdays === targetIndex) return new Date(d);
      weekdays++;
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export interface QotdHistoryItem {
  question: any;
  date: string;       // YYYY-MM-DD
  displayDate: string; // "Mon, May 19"
  index: number;       // QOTD index
  stats: { correct: number; incorrect: number; total: number } | null;
  reactions: Record<string, number>;
}

/**
 * Fetches past QOTD questions with stats and reactions.
 * Returns `pageSize` items starting from offset, going backwards from yesterday.
 * Limits to approximately 3 months (~65 weekdays).
 */
export async function getQotdHistory(
  offset: number = 0,
  pageSize: number = 20
): Promise<{ items: QotdHistoryItem[]; hasMore: boolean }> {
  const todayIndex = getQotdIndex();
  if (todayIndex === null || todayIndex <= 0) {
    return { items: [], hasMore: false };
  }

  // Cap at ~3 months of weekdays (~65 weekdays)
  const maxLookback = Math.min(todayIndex, 65);

  // Calculate the range of indices to fetch (going backwards from yesterday)
  const startIdx = todayIndex - 1 - offset; // yesterday = todayIndex - 1
  const endIdx = Math.max(todayIndex - maxLookback, startIdx - pageSize + 1);

  if (startIdx < (todayIndex - maxLookback) || startIdx < 0) {
    return { items: [], hasMore: false };
  }

  // Fetch questions for the range using the same deterministic ordering
  const indices = [];
  for (let i = startIdx; i >= endIdx && i >= 0; i--) {
    indices.push(i);
  }

  if (indices.length === 0) {
    return { items: [], hasMore: false };
  }

  // Fetch all questions using the same sort order as getQotdQuestion
  // We need to get questions at specific positions in the ordered list
  const firstIdx = Math.min(...indices);
  const lastIdx = Math.max(...indices);

  const { data: questionsData, error } = await withTimeout(supabase
    .from('questions')
    .select('*')
    .neq('year', 'Demo')
    .neq('category', 'Demo')
    .not('id', 'in', '("00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003")')
    .order('year', { ascending: false })
    .order('id', { ascending: true })
    .range(firstIdx, lastIdx), 10000).catch((e: any) => ({ data: null, error: e })) as any;

  if (error || !questionsData || questionsData.length === 0) {
    console.error('Error fetching QOTD history:', error);
    return { items: [], hasMore: false };
  }

  // Map each index to its question
  const items: QotdHistoryItem[] = [];
  const questionIds: string[] = [];
  const academicYear = getCurrentAcademicYear();

  for (const idx of indices) {
    const arrayPos = idx - firstIdx;
    const question = questionsData[arrayPos];
    if (!question) continue;

    const date = getDateForQotdIndex(idx, academicYear);
    const displayDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    });
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    items.push({
      question,
      date: dateStr,
      displayDate,
      index: idx,
      stats: null,
      reactions: {},
    });
    questionIds.push(question.id);
  }

  if (questionIds.length === 0) {
    return { items: [], hasMore: false };
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

  const hasMore = endIdx > (todayIndex - maxLookback) && endIdx > 0;
  return { items, hasMore };
}

