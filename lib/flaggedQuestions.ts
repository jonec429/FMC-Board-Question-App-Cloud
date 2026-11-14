import { supabase } from './supabase';
import { fetchAllPages } from './supabasePagination';

const STORAGE_PREFIX = 'fmc_flagged_q_';
const PENDING_OPS_PREFIX = 'fmc_flagged_pending_';

export interface FlaggedQuestionRecord {
  questionId: string;
  notes?: string;
  flaggedAt: string;
}

interface PendingFlagOp {
  flagged: boolean;
  notes?: string;
  updatedAt: string;
}

type PendingFlagMap = Record<string, PendingFlagOp>;

let flaggedTableMissing = false;

function isMissingTableError(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
}

function readLocalIds(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (err) {
    console.warn('[flaggedQuestions] Failed to parse local storage flags:', err);
    return [];
  }
}

function writeLocalIds(userId: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(ids));
  } catch (err) {
    console.warn('[flaggedQuestions] Failed to persist local flags:', err);
  }
}

function readPendingOps(userId: string): PendingFlagMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${PENDING_OPS_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingOps(userId: string, ops: PendingFlagMap): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(ops).length === 0) {
      localStorage.removeItem(`${PENDING_OPS_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${PENDING_OPS_PREFIX}${userId}`, JSON.stringify(ops));
    }
  } catch (err) {
    console.warn('[flaggedQuestions] Failed to persist pending flag ops:', err);
  }
}

async function pushFlagOp(
  client: any,
  userId: string,
  questionId: string,
  op: PendingFlagOp
): Promise<{ synced: boolean; tableMissing: boolean }> {
  if (flaggedTableMissing) {
    return { synced: false, tableMissing: true };
  }
  try {
    if (op.flagged) {
      const { error } = await client
        .from('user_flagged_questions')
        .upsert(
          {
            user_id: userId,
            question_id: questionId,
            notes: op.notes || null,
            created_at: op.updatedAt,
          },
          { onConflict: 'user_id,question_id' }
        );
      if (error) {
        const missing = isMissingTableError(error);
        if (missing) flaggedTableMissing = true;
        return { synced: false, tableMissing: missing };
      }
    } else {
      const { error } = await client
        .from('user_flagged_questions')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);
      if (error) {
        const missing = isMissingTableError(error);
        if (missing) flaggedTableMissing = true;
        return { synced: false, tableMissing: missing };
      }
    }
    return { synced: true, tableMissing: false };
  } catch (err) {
    const missing = isMissingTableError(err);
    if (missing) flaggedTableMissing = true;
    return { synced: false, tableMissing: missing };
  }
}

/**
 * Flush any offline-queued flag/unflag operations to Supabase across one or all users.
 */
export async function flushPendingFlags(
  client: any = supabase,
  targetUserId?: string
): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) return { synced: 0, failed: 0 };

  const userIds: string[] = [];
  if (targetUserId) {
    userIds.push(targetUserId);
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PENDING_OPS_PREFIX)) {
        userIds.push(key.slice(PENDING_OPS_PREFIX.length));
      }
    }
  }

  let synced = 0;
  let failed = 0;

  for (const uid of userIds) {
    const ops = readPendingOps(uid);
    const entries = Object.entries(ops);
    if (entries.length === 0) continue;

    const remaining: PendingFlagMap = {};
    for (const [qId, op] of entries) {
      const res = await pushFlagOp(client, uid, qId, op);
      if (res.synced) {
        synced++;
      } else if (res.tableMissing) {
        // Table not deployed in this environment yet — localStorage remains authoritative without retry loops
        continue;
      } else {
        remaining[qId] = op;
        failed++;
      }
    }
    writePendingOps(uid, remaining);
  }

  return { synced, failed };
}

/**
 * Retrieve the list of flagged question IDs for a given user.
 * Reads from Supabase and reconciles with offline pending flag/unflag operations.
 */
export async function getFlaggedQuestionIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const localIds = readLocalIds(userId);
  const pendingOps = readPendingOps(userId);

  if (typeof navigator !== 'undefined' && navigator.onLine && !flaggedTableMissing) {
    try {
      // Push any pending offline flag/unflag ops before merging remote state
      if (Object.keys(pendingOps).length > 0) {
        await flushPendingFlags(supabase, userId);
      }

      if (flaggedTableMissing) {
        return localIds;
      }

      const remoteRows = await fetchAllPages<{ question_id: string }>((from, to) =>
        supabase
          .from('user_flagged_questions')
          .select('question_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('question_id', { ascending: true })
          .range(from, to)
      );

      const mergedSet = new Set<string>([
        ...remoteRows.map((row) => row.question_id),
        ...localIds,
      ]);

      // Honor any still-pending local flag/unflag ops so an offline unflag isn't resurrected by stale remote rows
      const latestPending = readPendingOps(userId);
      Object.entries(latestPending).forEach(([qId, op]) => {
        if (op.flagged) mergedSet.add(qId);
        else mergedSet.delete(qId);
      });

      const merged = Array.from(mergedSet);
      writeLocalIds(userId, merged);
      return merged;
    } catch (err) {
      if (isMissingTableError(err)) {
        flaggedTableMissing = true;
      }
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

  const localIds = readLocalIds(userId);
  const isCurrentlyFlagged = localIds.includes(questionId);
  const nextIsFlagged = !isCurrentlyFlagged;

  const updatedIds = nextIsFlagged
    ? Array.from(new Set([...localIds, questionId]))
    : localIds.filter((id) => id !== questionId);

  writeLocalIds(userId, updatedIds);

  const op: PendingFlagOp = {
    flagged: nextIsFlagged,
    notes,
    updatedAt: new Date().toISOString(),
  };

  // Record in pending ops first so offline/mid-toggle reloads never lose the change
  const ops = readPendingOps(userId);
  ops[questionId] = op;
  writePendingOps(userId, ops);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const res = await pushFlagOp(supabase, userId, questionId, op);
    if (res.synced || res.tableMissing) {
      const latestOps = readPendingOps(userId);
      delete latestOps[questionId];
      writePendingOps(userId, latestOps);
    } else {
      console.warn('[flaggedQuestions] Supabase sync queued for retry when connection stabilizes.');
    }
  }

  return nextIsFlagged;
}
