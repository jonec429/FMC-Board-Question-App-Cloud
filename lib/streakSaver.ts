import { supabase } from './supabase';
import { getCurrentAcademicYear, formatAcademicYear } from './academicYear';
import { getTodayDateString } from './qotd';
import { Question } from './types';

export interface StreakSaverStatus {
  currentAcademicYear: number;
  academicYearLabel: string;
  savesUsedThisYear: number;
  maxSavesPerYear: number;
  savesRemaining: number;
  nextSaveQuestionCount: number;
  isStreakBroken: boolean;
  brokenStreakLength: number;
  missedDate: string | null;
  canSaveStreak: boolean;
  mostRecentYear: string;
}

/** Day-of-week for an EST date string (0 = Sun, 6 = Sat). */
function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekend(dateStr: string): boolean {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

/** The previous weekday (skips Sat/Sun) as an EST 'YYYY-MM-DD' string. */
function prevWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  do {
    dt.setDate(dt.getDate() - 1);
  } while (dt.getDay() === 0 || dt.getDay() === 6);
  return (
    dt.getFullYear() +
    '-' +
    String(dt.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(dt.getDate()).padStart(2, '0')
  );
}

/**
 * Finds the most recent ITE exam year in the questions bank (e.g. '2025', '2026').
 * Automatically rolls over as new ITE years are added.
 */
export async function getMostRecentITEYear(): Promise<string> {
  try {
    const { data } = await supabase
      .from('questions')
      .select('year')
      .neq('year', 'Demo')
      .not('year', 'is', null)
      .order('year', { ascending: false })
      .limit(1);

    return data?.[0]?.year || '2025';
  } catch {
    return '2025';
  }
}

/**
 * Detects if a user had an active streak that was severed by missing a recent weekday.
 */
export function detectBrokenStreak(
  answeredEstDates: string[],
  todayStr: string = getTodayDateString()
): {
  currentStreak: number;
  isBroken: boolean;
  brokenStreakLength: number;
  missedDate: string | null;
} {
  const answered = new Set(answeredEstDates);

  // Check current active streak
  let cursor = todayStr;
  let todayAnswered = false;
  if (isWeekend(cursor)) {
    cursor = prevWeekday(cursor);
  } else if (!answered.has(cursor)) {
    cursor = prevWeekday(cursor);
  } else {
    todayAnswered = true;
  }

  let currentStreak = 0;
  while (!isWeekend(cursor) && answered.has(cursor)) {
    currentStreak++;
    cursor = prevWeekday(cursor);
  }

  // 'cursor' right now is the first missed weekday going backwards from today
  const firstMissedWeekday = cursor;

  // Count the streak that existed immediately BEFORE this missed weekday
  let checkCursor = prevWeekday(firstMissedWeekday);
  let priorStreak = 0;
  while (!isWeekend(checkCursor) && answered.has(checkCursor)) {
    priorStreak++;
    checkCursor = prevWeekday(checkCursor);
  }

  // A streak is broken if they had a prior streak of >= 1 day and missed firstMissedWeekday
  const isBroken = priorStreak > 0 && (!todayAnswered || currentStreak === 1);
  const brokenStreakLength = priorStreak + (todayAnswered ? 1 : 0);

  return {
    currentStreak,
    isBroken,
    brokenStreakLength,
    missedDate: isBroken ? firstMissedWeekday : null,
  };
}

/**
 * Retrieves the full streak saver status for a user, including used saves for current AY,
 * next required question count (5, 10, 15), and whether a streak can currently be saved.
 */
export async function getStreakSaverStatus(
  userId: string,
  answeredEstDates: string[],
  userStreak?: any
): Promise<StreakSaverStatus> {
  const currentAY = getCurrentAcademicYear();
  const ayLabel = formatAcademicYear(currentAY);
  const mostRecentYear = await getMostRecentITEYear();

  // Query successful saves in current academic year
  let savesUsedThisYear = 0;
  try {
    const { data: saves } = await supabase
      .from('results')
      .select('id, percentage')
      .eq('user_id', userId)
      .eq('topic', 'Streak Saver')
      .eq('academic_year', currentAY)
      .gte('percentage', 65);

    savesUsedThisYear = saves?.length || 0;
  } catch (err) {
    console.warn('Error fetching streak saves count:', err);
  }

  const maxSavesPerYear = 3;
  const savesRemaining = Math.max(0, maxSavesPerYear - savesUsedThisYear);

  // Question count scaling: 1st save = 5, 2nd save = 10, 3rd save = 15
  const nextSaveQuestionCount = Math.min(15, (savesUsedThisYear + 1) * 5);

  const brokenDetection = detectBrokenStreak(answeredEstDates);
  let isStreakBroken = brokenDetection.isBroken;
  let brokenStreakLength = brokenDetection.brokenStreakLength;
  let missedDate = brokenDetection.missedDate;

  // Fallback: If user_streaks has max_qotd_streak > 0 and current_qotd_streak === 0,
  // allow streak saver even if dates array was partial
  if (!isStreakBroken && userStreak && (userStreak.current_qotd_streak === 0 || !userStreak.current_qotd_streak)) {
    if (userStreak.max_qotd_streak && userStreak.max_qotd_streak > 0) {
      isStreakBroken = true;
      brokenStreakLength = userStreak.max_qotd_streak;
      missedDate = missedDate || prevWeekday(getTodayDateString());
    }
  }

  const canSaveStreak = isStreakBroken && savesRemaining > 0 && brokenStreakLength > 0;

  return {
    currentAcademicYear: currentAY,
    academicYearLabel: ayLabel,
    savesUsedThisYear,
    maxSavesPerYear,
    savesRemaining,
    nextSaveQuestionCount,
    isStreakBroken,
    brokenStreakLength,
    missedDate,
    canSaveStreak,
    mostRecentYear,
  };
}

/**
 * Fetches random questions from the most recent ITE for a Streak Saver challenge.
 */
export async function getStreakSaverQuestions(
  count: number,
  mostRecentYear: string
): Promise<Question[]> {
  try {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('year', mostRecentYear)
      .neq('category', 'Demo');

    if (!data || data.length === 0) {
      // Fallback: fetch any non-demo questions
      const { data: fallback } = await supabase
        .from('questions')
        .select('*')
        .neq('category', 'Demo')
        .limit(100);
      const shuffled = (fallback || []).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count) as Question[];
    }

    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count) as Question[];
  } catch (err) {
    console.error('Error fetching streak saver questions:', err);
    return [];
  }
}

/**
 * Records a successful streak save:
 * 1. Inserts record into `results` table.
 * 2. Bridges the missed date in `question_attempts` with `is_qotd: true`.
 * 3. Updates `user_streaks` with the restored streak length.
 */
export async function applyStreakSaveSuccess({
  userId,
  missedDate,
  score,
  total,
  percentage,
  restoredStreak,
  academicYear,
  reviewData,
}: {
  userId: string;
  missedDate: string | null;
  score: number;
  total: number;
  percentage: number;
  restoredStreak: number;
  academicYear: number;
  reviewData?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insert into results
    const { error: resultErr } = await supabase.from('results').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      topic: 'Streak Saver',
      academic_year: academicYear,
      score,
      total,
      percentage,
      academic_points: 0,
      timing_status: 'On Time',
      review_data: reviewData || null,
      created_at: new Date().toISOString(),
    });

    if (resultErr) {
      console.warn('Results insert warning on streak save:', resultErr);
    }

    // 2. Bridge the missed date in question_attempts so computeQotdStreak self-heals
    const bridgeDateStr = missedDate || prevWeekday(getTodayDateString());
    // Pick dummy or real question ID
    const dummyQId = '00000000-0000-0000-0000-000000000001';
    await supabase.from('question_attempts').insert({
      user_id: userId,
      question_id: dummyQId,
      is_qotd: true,
      is_correct: true,
      created_at: bridgeDateStr + 'T11:00:00Z',
    });

    // 3. Update user_streaks table
    const { data: existingStreak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const maxStreak = Math.max(existingStreak?.max_qotd_streak || 0, restoredStreak);

    if (existingStreak) {
      await supabase
        .from('user_streaks')
        .update({
          current_qotd_streak: restoredStreak,
          max_qotd_streak: maxStreak,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('user_streaks').insert({
        user_id: userId,
        current_qotd_streak: restoredStreak,
        max_qotd_streak: maxStreak,
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error applying streak save:', err);
    return { success: false, error: err.message || 'Failed to apply streak save.' };
  }
}
