import { supabase } from './supabase';

const STORAGE_PREFIX = 'fmc_flagged_q_';

export interface FlaggedQuestionRecord {
  questionId: string;
  notes?: string;
  flaggedAt: string;
}

/**
 * Retrieve the list of flagged question IDs for a given user.
 * Reads from Supabase and syncs with localStorage for offline resilience.
 */
export async function getFlaggedQuestionIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  // 1. Read local storage first for instant rendering
  let localIds: string[] = [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localIds = parsed;
    }
  } catch (err) {
    console.warn('[flaggedQuestions] Failed to parse local storage flags:', err);
  }

  // 2. Fetch latest from Supabase if online
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('user_flagged_questions')
        .select('question_id')
        .eq('user_id', userId);

      if (!error && data) {
        const remoteIds = data.map((row: { question_id: string }) => row.question_id);
        // Union remote and local IDs to never lose offline flags
        const merged = Array.from(new Set([...remoteIds, ...localIds]));
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(merged));
        } catch {}
        return merged;
      }
    } catch {
      // Offline or table not yet applied in Supabase: fall back smoothly to local
    }
  }

  return localIds;
}

/**
 * Toggle the flagged status of a question.
 * Returns the new flag status (true if now flagged, false if unflagged).
 */
export async function toggleFlaggedQuestion(
  userId: string,
  questionId: string,
  notes?: string
): Promise<boolean> {
  if (!userId || !questionId) return false;

  // 1. Read current local state
  let localIds: string[] = [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) localIds = JSON.parse(raw);
  } catch {}

  const isCurrentlyFlagged = localIds.includes(questionId);
  const nextIsFlagged = !isCurrentlyFlagged;

  if (nextIsFlagged) {
    localIds = Array.from(new Set([...localIds, questionId]));
  } else {
    localIds = localIds.filter(id => id !== questionId);
  }

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(localIds));
  } catch {}

  // 2. Persist to Supabase in background
  if (navigator.onLine) {
    try {
      if (nextIsFlagged) {
        await supabase
          .from('user_flagged_questions')
          .upsert({
            user_id: userId,
            question_id: questionId,
            notes: notes || null,
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id,question_id' });
      } else {
        await supabase
          .from('user_flagged_questions')
          .delete()
          .eq('user_id', userId)
          .eq('question_id', questionId);
      }
    } catch (err) {
      console.warn('[flaggedQuestions] Supabase sync failed, retained in localStorage:', err);
    }
  }

  return nextIsFlagged;
}
