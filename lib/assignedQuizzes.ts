import { supabase } from '@/lib/supabase';

export interface AssignedQuizRecord {
  id: string;
  created_at: string;
  assigned_by: string;
  assigned_to: string;
  title: string;
  question_ids: string[];
  is_completed: boolean;
  completed_at?: string | null;
  due_date?: string | null;
  score?: number | null;
  // Hydrated helper fields
  resident_name?: string;
  resident_email?: string;
  resident_pgy?: string;
  assigned_by_name?: string;
}

/**
 * Creates assigned quiz records for selected residents.
 * Gracefully tries `assigned_quizzes` table first, and falls back to `quizzes` table with JSON metadata in `description`.
 */
export async function createAssignedQuizzes({
  assignedByUserId,
  assignedToUserIds,
  title,
  questionIds,
  dueDate,
}: {
  assignedByUserId: string;
  assignedToUserIds: string[];
  title: string;
  questionIds: string[];
  dueDate?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Try inserting into assigned_quizzes
    const standardInserts = assignedToUserIds.map(targetId => ({
      assigned_by: assignedByUserId,
      assigned_to: targetId,
      title: title.trim(),
      question_ids: questionIds,
      due_date: dueDate || null,
      is_completed: false,
    }));

    const { error: directError } = await supabase.from('assigned_quizzes' as any).insert(standardInserts);

    if (!directError) {
      return { success: true };
    }

    // 2. If table doesn't exist (PGRST205) or column due_date is missing, try fallback to quizzes table
    const fallbackInserts = assignedToUserIds.map(targetId => ({
      title: title.trim(),
      description: JSON.stringify({
        assigned_by: assignedByUserId,
        assigned_to: targetId,
        due_date: dueDate || null,
        is_completed: false,
        completed_at: null,
        score: null,
      }),
      question_ids: questionIds,
    }));

    const { error: quizError } = await supabase.from('quizzes').insert(fallbackInserts);
    if (quizError) {
      return { success: false, error: quizError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create assigned quizzes.' };
  }
}

/**
 * Fetches all assigned quizzes for faculty tracking.
 */
export async function getFacultyAssignedQuizzes(): Promise<AssignedQuizRecord[]> {
  try {
    // 1. Try assigned_quizzes
    const { data: directData, error: directErr } = await supabase
      .from('assigned_quizzes' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (!directErr && directData && directData.length > 0) {
      return directData.map((d: any) => ({
        id: d.id,
        created_at: d.created_at || new Date().toISOString(),
        assigned_by: d.assigned_by,
        assigned_to: d.assigned_to,
        title: d.title,
        question_ids: Array.isArray(d.question_ids) ? d.question_ids : [],
        is_completed: !!d.is_completed,
        completed_at: d.completed_at,
        due_date: d.due_date,
        score: d.score,
      }));
    }

    // 2. Try quizzes fallback
    const { data: quizData, error: quizErr } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!quizErr && quizData) {
      const records: AssignedQuizRecord[] = [];
      for (const q of quizData) {
        if (!q.description) continue;
        try {
          const meta = JSON.parse(q.description);
          if (meta.assigned_to) {
            records.push({
              id: q.id,
              created_at: q.created_at || new Date().toISOString(),
              assigned_by: meta.assigned_by,
              assigned_to: meta.assigned_to,
              title: q.title,
              question_ids: Array.isArray(q.question_ids) ? q.question_ids : [],
              is_completed: !!meta.is_completed,
              completed_at: meta.completed_at,
              due_date: meta.due_date,
              score: meta.score,
            });
          }
        } catch {}
      }
      return records;
    }

    return [];
  } catch (err) {
    console.error('Error fetching faculty assigned quizzes:', err);
    return [];
  }
}

/**
 * Deletes or cancels an assigned quiz.
 */
export async function deleteAssignedQuiz(id: string): Promise<boolean> {
  try {
    const { error: err1 } = await supabase.from('assigned_quizzes' as any).delete().eq('id', id);
    if (!err1) return true;

    const { error: err2 } = await supabase.from('quizzes').delete().eq('id', id);
    return !err2;
  } catch {
    return false;
  }
}
