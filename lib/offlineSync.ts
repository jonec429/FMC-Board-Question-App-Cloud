// FMC Board Review App — Offline Persistence and Submission Synchronization Engine

export interface OfflineSessionData {
  sessionId?: string;
  topic?: string;
  currentIndex: number;
  answers: Record<number, number>;
  timeLeft: number;
  toolHighlights?: Record<number, string[]>;
  toolStrikethroughs?: Record<number, number[]>;
  lastUpdated: string;
}

export interface PendingSubmission {
  id: string;
  userId: string;
  sessionId?: string;
  isQotd: boolean;
  result?: any;
  attempts?: any[];
  qotdAttempt?: any;
  topic?: string;
  submittedAt: string;
}

const SESSION_KEY_PREFIX = 'fmc_offline_session_';
const PENDING_SUBMISSIONS_KEY = 'fmc_pending_submissions';

/**
 * Save active quiz state to localStorage immediately (offline backup buffer)
 */
export function saveOfflineSession(sessionIdOrTopic: string, data: OfflineSessionData): void {
  if (typeof window === 'undefined' || !sessionIdOrTopic) return;
  try {
    localStorage.setItem(`${SESSION_KEY_PREFIX}${sessionIdOrTopic}`, JSON.stringify(data));
  } catch (err) {
    console.warn('[OfflineSync] Failed to save offline session backup:', err);
  }
}

/**
 * Load offline session backup from localStorage
 */
export function loadOfflineSession(sessionIdOrTopic: string): OfflineSessionData | null {
  if (typeof window === 'undefined' || !sessionIdOrTopic) return null;
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${sessionIdOrTopic}`);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSessionData;
  } catch (err) {
    console.warn('[OfflineSync] Failed to load offline session backup:', err);
    return null;
  }
}

/**
 * Clear offline session backup once completed or abandoned
 */
export function clearOfflineSession(sessionIdOrTopic: string): void {
  if (typeof window === 'undefined' || !sessionIdOrTopic) return;
  try {
    localStorage.removeItem(`${SESSION_KEY_PREFIX}${sessionIdOrTopic}`);
  } catch (err) {
    console.warn('[OfflineSync] Failed to clear offline session backup:', err);
  }
}

/**
 * Queue a completed quiz submission when offline or if cloud write fails
 */
export function queuePendingSubmission(submission: PendingSubmission): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getPendingSubmissions();
    // Avoid duplicate queue entries for the same submission ID
    const filtered = existing.filter((item) => item.id !== submission.id);
    filtered.push(submission);
    localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(filtered));
    console.log(`[OfflineSync] Queued submission (${submission.id}) for later sync.`);
  } catch (err) {
    console.error('[OfflineSync] Failed to queue pending submission:', err);
  }
}

/**
 * Get all queued pending submissions
 */
export function getPendingSubmissions(): PendingSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_SUBMISSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingSubmission[];
  } catch (err) {
    console.warn('[OfflineSync] Failed to parse pending submissions:', err);
    return [];
  }
}

/**
 * Flush all queued pending submissions to Supabase when reconnected
 */
export async function flushPendingSubmissions(supabase: any): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = getPendingSubmissions();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  console.log(`[OfflineSync] Attempting to flush ${pending.length} pending submission(s)...`);
  let synced = 0;
  let failed = 0;
  const remaining: PendingSubmission[] = [];

  for (const sub of pending) {
    try {
      if (!sub.isQotd && sub.result) {
        // Insert quiz result
        const { error: resErr } = await supabase.from('results').insert(sub.result);
        if (resErr) throw resErr;

        // Insert question attempts if available
        if (sub.attempts && sub.attempts.length > 0) {
          const { error: attErr } = await supabase.from('question_attempts').insert(sub.attempts);
          if (attErr) console.warn('[OfflineSync] Attempt insert warning:', attErr);
        }
      } else if (sub.isQotd && sub.qotdAttempt) {
        // Insert QOTD attempt
        const { error: qotdErr } = await supabase.from('question_attempts').insert(sub.qotdAttempt);
        if (qotdErr) throw qotdErr;
      }

      // Mark cloud session as completed if sessionId exists
      if (sub.sessionId) {
        await supabase
          .from('quiz_sessions')
          .update({ is_completed: true })
          .eq('id', sub.sessionId);
      }

      // Clean up the offline session backup
      if (sub.sessionId) {
        clearOfflineSession(sub.sessionId);
      }
      if (sub.topic) {
        clearOfflineSession(sub.topic);
      }

      synced++;
      console.log(`[OfflineSync] Successfully synced submission ${sub.id}`);
    } catch (err) {
      console.error(`[OfflineSync] Failed to sync submission ${sub.id}:`, err);
      failed++;
      remaining.push(sub); // Keep for retry next time
    }
  }

  try {
    localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.warn('[OfflineSync] Failed to update pending submissions storage:', e);
  }

  return { synced, failed };
}
