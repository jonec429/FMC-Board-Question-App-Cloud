export type LeitnerBox = 1 | 2 | 3; // 1 = Learning, 2 = Review, 3 = Mastered

export interface FlashcardItemProgress {
  box: LeitnerBox;
  lastReviewed: string; // ISO string
  reviewCount: number;
}

export type FlashcardProgressMap = Record<string, FlashcardItemProgress>;

const STORAGE_PREFIX = 'fmc_flashcard_progress_';

export function getFlashcardProgress(userId?: string): FlashcardProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const key = `${STORAGE_PREFIX}${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.warn('[flashcards] Failed to parse progress from localStorage:', err);
    return {};
  }
}

export function saveFlashcardProgress(userId: string | undefined, progress: FlashcardProgressMap): void {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_PREFIX}${userId || 'guest'}`;
  const serialized = JSON.stringify(progress);
  try {
    localStorage.setItem(key, serialized);
  } catch (err: unknown) {
    // Prune stale offline quiz session buffers if localStorage quota is full so Leitner progress never gets dropped
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('fmc_offline_session_')) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(key, serialized);
      } catch (retryErr) {
        console.warn('[flashcards] Failed to save progress after storage cleanup:', retryErr);
      }
    } else {
      console.warn('[flashcards] Failed to save progress to localStorage:', err);
    }
  }
}

export function setQuestionBox(
  userId: string | undefined,
  questionId: string,
  box: LeitnerBox
): FlashcardProgressMap {
  const current = getFlashcardProgress(userId);
  const existing = current[questionId];
  const updated: FlashcardItemProgress = {
    box,
    lastReviewed: new Date().toISOString(),
    reviewCount: (existing?.reviewCount || 0) + 1,
  };
  const next = { ...current, [questionId]: updated };
  saveFlashcardProgress(userId, next);
  return next;
}

export function resetAllFlashcardProgress(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_PREFIX}${userId || 'guest'}`;
    localStorage.removeItem(key);
  } catch {}
}

export function getBoxCounts(
  progress: FlashcardProgressMap,
  questionIds: string[]
): { box1: number; box2: number; box3: number; total: number } {
  let box1 = 0;
  let box2 = 0;
  let box3 = 0;

  for (const id of questionIds) {
    const item = progress[id];
    if (!item || item.box === 1) {
      box1++;
    } else if (item.box === 2) {
      box2++;
    } else if (item.box === 3) {
      box3++;
    }
  }

  return { box1, box2, box3, total: questionIds.length };
}
