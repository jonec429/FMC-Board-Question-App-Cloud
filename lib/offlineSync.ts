// FMC Board Review App — Offline Persistence and Submission Synchronization Engine
import { flushPendingFlags } from './flaggedQuestions';

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
  resultSynced?: boolean;
  attemptsSynced?: boolean;
  qotdSynced?: boolean;
}

const SESSION_KEY_PREFIX = 'fmc_offline_session_';
const PENDING_SUBMISSIONS_KEY = 'fmc_pending_submissions';

// Concurrency mutex lock to prevent concurrent flushes from inserting duplicate rows
let isFlushing = false;

/**
 * Safely writes to localStorage with automatic cleanup if quota is exceeded
 */
function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err: unknown) {
    // If QuotaExceededError, attempt to prune old session keys
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        const keysToPrune: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(SESSION_KEY_PREFIX) && k !== key) {
            keysToPrune.push(k);
          }
        }
        keysToPrune.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, value);
      } catch (pruneErr) {
        console.error('[OfflineSync] Storage quota exceeded and cleanup failed:', pruneErr);
      }
    } else {
      console.warn('[OfflineSync] LocalStorage write error:', err);
    }
  }
}

/**
 * Save active quiz state to localStorage immediately (offline backup buffer)
 */
export function saveOfflineSession(sessionIdOrTopic: string, data: OfflineSessionData): void {
  if (typeof window === 'undefined' || !sessionIdOrTopic) return;
  safeSetLocalStorage(`${SESSION_KEY_PREFIX}${sessionIdOrTopic}`, JSON.stringify(data));
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
 * Queue a completed quiz submission when offline or if cloud write fails.
 * Guarantees a deterministic ID on the submission and the embedded result to prevent duplicate rows.
 */
export function queuePendingSubmission(submission: PendingSubmission): void {
  if (typeof window === 'undefined') return;
  try {
    // Ensure the submission and its inner result share an immutable ID
    if (!submission.id) {
      submission.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${submission.userId}_${Date.now()}`;
    }
    if (submission.result && !submission.result.id) {
      submission.result.id = submission.id;
    }

    const existing = getPendingSubmissions();
    // Avoid duplicate queue entries for the same submission ID
    const filtered = existing.filter((item) => item.id !== submission.id);
    filtered.push(submission);
    safeSetLocalStorage(PENDING_SUBMISSIONS_KEY, JSON.stringify(filtered));
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
 * Flush all queued pending submissions to Supabase when reconnected.
 * Protected by an in-memory mutex to prevent double-flushes and duplicate rows.
 */
export async function flushPendingSubmissions(supabase: any): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  if (isFlushing) {
    console.log('[OfflineSync] Flush already in progress, skipping concurrent trigger.');
    return { synced: 0, failed: 0 };
  }

  isFlushing = true;
  try {
    // Flush any queued offline question flag/unflag operations first
    await flushPendingFlags(supabase).catch((err) => {
      console.warn('[OfflineSync] Flag sync warning:', err);
    });

    const pending = getPendingSubmissions();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    console.log(`[OfflineSync] Attempting to flush ${pending.length} pending submission(s)...`);
    let synced = 0;
    let failed = 0;
    const remaining: PendingSubmission[] = [];

    const isRetryableNetworkError = (err: any): boolean => {
      const msg = String(err?.message || err || '').toLowerCase();
      return (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('econnreset')
      );
    };

    for (const sub of pending) {
      try {
        if (!sub.isQotd && sub.result) {
          // Ensure deterministic UUID to make insert/upsert idempotent
          if (!sub.result.id) {
            sub.result.id = sub.id;
          }

          if (!sub.resultSynced) {
            const { error: resErr } = await supabase.from('results').upsert(sub.result, { onConflict: 'id' });
            if (resErr) throw resErr;
            sub.resultSynced = true;
          }

          // Insert question attempts idempotently (skip if already synced on prior attempt)
          if (sub.attempts && sub.attempts.length > 0 && !sub.attemptsSynced) {
            const { error: attErr } = await supabase.from('question_attempts').insert(sub.attempts);
            if (attErr) {
              if (attErr.code === '23505') {
                sub.attemptsSynced = true;
              } else if (isRetryableNetworkError(attErr)) {
                throw attErr;
              } else {
                console.warn('[OfflineSync] Attempt insert warning:', attErr);
                sub.attemptsSynced = true;
              }
            } else {
              sub.attemptsSynced = true;
            }
          }
        } else if (sub.isQotd && sub.qotdAttempt && !sub.qotdSynced) {
          // Insert QOTD attempt
          const { error: qotdErr } = await supabase.from('question_attempts').insert(sub.qotdAttempt);
          if (qotdErr) {
            if (qotdErr.code === '23505') {
              sub.qotdSynced = true;
            } else {
              throw qotdErr;
            }
          } else {
            sub.qotdSynced = true;
          }
        }

        // Mark cloud session as completed if sessionId exists
        if (sub.sessionId) {
          const { error: sessErr } = await supabase
            .from('quiz_sessions')
            .update({ is_completed: true, questions: [] })
            .eq('id', sub.sessionId);
          if (sessErr && isRetryableNetworkError(sessErr)) {
            throw sessErr;
          }
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
        remaining.push(sub); // Preserves resultSynced / attemptsSynced flags for next retry
      }
    }

    safeSetLocalStorage(PENDING_SUBMISSIONS_KEY, JSON.stringify(remaining));
    return { synced, failed };
  } finally {
    isFlushing = false;
  }
}
