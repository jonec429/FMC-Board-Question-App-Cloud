import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';
import { isActiveResident, residentMatchesCohort, getCurrentAcademicYear } from '@/lib/academicYear';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  let isAuthorized = false;

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const callerEmail = (user.email || '').toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, pgy')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin = SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(callerEmail);
    const isAdmin = isSuperAdmin || profile?.role === 'admin';
    const isFaculty = profile?.role === 'faculty' || profile?.pgy === 'Faculty' || profile?.role === 'gme_staff';

    if (isAdmin || isFaculty) {
      isAuthorized = true;
    }
  } catch (err) {
    return NextResponse.json({ error: 'Auth validation error' }, { status: 401 });
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden: Admin or Faculty access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'all' | 'blocks' | 'qotd'
    const pgyParam = searchParams.get('pgy') || 'all'; // 'all' | '1' | '2' | '3' | 'PGY-1' ...
    const academicYear = getCurrentAcademicYear();

    // 1. Fetch active residents from roster and profiles
    const [rosterRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from('authorized_roster')
        .select('email, name, cohort_year, track, pgy_override, status, pgy, advisor'),
      supabaseAdmin
        .from('profiles')
        .select('id, email'),
    ]);

    if (rosterRes.error) throw rosterRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const roster = rosterRes.data || [];
    const profiles = profilesRes.data || [];

    // Filter roster to active residents and apply PGY filter if requested
    const filteredRoster = roster
      .filter(isActiveResident)
      .filter((r) => residentMatchesCohort(r, pgyParam, academicYear));

    const activeEmails = new Set(filteredRoster.map((r) => r.email?.toLowerCase()));
    const activeUserIds = new Set(
      profiles
        .filter((p) => activeEmails.has((p.email || '')?.toLowerCase()))
        .map((p) => p.id)
    );

    if (activeUserIds.size === 0) {
      return NextResponse.json({
        questions: [],
        categories: [],
        availableCategories: [],
        summary: {
          totalAttempts: 0,
          totalQuestionsAttempted: 0,
          qualifiedQuestionsCount: 0,
          activeResidentCount: 0,
          minQuestionAttemptsRequired: 3,
        },
      });
    }

    // 2. Fetch attempts for the targeted residents
    let query = supabaseAdmin
      .from('question_attempts')
      .select('user_id, question_id, is_correct, selected_index, is_qotd, created_at')
      .in('user_id', Array.from(activeUserIds))
      .limit(50000);

    if (type === 'blocks') {
      query = query.or('is_qotd.is.null,is_qotd.eq.false');
    } else if (type === 'qotd') {
      query = query.eq('is_qotd', true);
    }

    const { data: attemptsData, error: attemptsError } = await query;
    if (attemptsError) throw attemptsError;

    const attempts = attemptsData || [];

    if (attempts.length === 0) {
      return NextResponse.json({
        questions: [],
        categories: [],
        availableCategories: [],
        summary: {
          totalAttempts: 0,
          totalQuestionsAttempted: 0,
          qualifiedQuestionsCount: 0,
          activeResidentCount: activeUserIds.size,
          minQuestionAttemptsRequired: 3,
        },
      });
    }

    // 3. Aggregate statistics per question
    const questionStats = new Map<string, { total: number; wrong: number; optionCounts: Record<number, number> }>();
    attempts.forEach((a) => {
      const current = questionStats.get(a.question_id) || { total: 0, wrong: 0, optionCounts: {} };
      current.total += 1;
      if (!a.is_correct) current.wrong += 1;
      if (a.selected_index != null) {
        current.optionCounts[a.selected_index] = (current.optionCounts[a.selected_index] || 0) + 1;
      }
      questionStats.set(a.question_id, current);
    });

    // 4. Fetch question metadata (including explanation & resource_link) in batches
    const questionIds = Array.from(questionStats.keys());
    const questionMap = new Map<string, any>();
    const batchSize = 100;

    for (let i = 0; i < questionIds.length; i += batchSize) {
      const batch = questionIds.slice(i, i + batchSize);
      const { data: qData, error: qErr } = await supabaseAdmin
        .from('questions')
        .select('id, question_text, category, options, correct_index, explanation, resource_link')
        .in('id', batch);

      if (qErr) {
        console.error('Error fetching questions batch for analytics:', qErr);
        continue;
      }
      (qData || []).forEach((q) => questionMap.set(q.id, q));
    }

    // 5. Enrich questions
    const enrichedQuestions = Array.from(questionStats.entries()).map(([id, stats]) => {
      const q = questionMap.get(id);
      const wrongPct = stats.total > 0 ? (stats.wrong / stats.total) * 100 : 0;
      return {
        id,
        text: q?.question_text || 'Unknown Question',
        category: q?.category || 'Unknown Category',
        total: stats.total,
        wrong: stats.wrong,
        wrongPct,
        options: (q?.options as string[]) || [],
        correct_index: q?.correct_index ?? -1,
        optionCounts: stats.optionCounts,
        explanation: q?.explanation || '',
        resource_link: q?.resource_link || '',
      };
    });

    // Filter questions: require >= 3 attempts for statistical reliability, sorted by failure rate
    const questionsFiltered = enrichedQuestions
      .filter((q) => q.total >= 3)
      .sort((a, b) => b.wrongPct - a.wrongPct)
      .slice(0, 100); // Return up to top 100 for comprehensive search and category filtering on frontend

    // 6. Aggregate by category across all attempted questions
    const categoryStats = new Map<string, { total: number; wrong: number }>();
    enrichedQuestions.forEach((q) => {
      const current = categoryStats.get(q.category) || { total: 0, wrong: 0 };
      current.total += q.total;
      current.wrong += q.wrong;
      categoryStats.set(q.category, current);
    });

    const categoryData = Array.from(categoryStats.entries())
      .map(([name, stats]) => ({
        name,
        wrongPct: stats.total > 0 ? (stats.wrong / stats.total) * 100 : 0,
        total: stats.total,
      }))
      .filter((c) => c.total >= 5 && c.name !== 'Unknown Category') // At least 5 attempts in category
      .sort((a, b) => b.wrongPct - a.wrongPct)
      .slice(0, 10);

    const availableCategories = Array.from(
      new Set(enrichedQuestions.map((q) => q.category).filter((c) => c && c !== 'Unknown Category'))
    ).sort();

    return NextResponse.json({
      questions: questionsFiltered,
      categories: categoryData,
      availableCategories,
      summary: {
        totalAttempts: attempts.length,
        totalQuestionsAttempted: questionStats.size,
        qualifiedQuestionsCount: questionsFiltered.length,
        activeResidentCount: activeUserIds.size,
        minQuestionAttemptsRequired: 3,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/admin/question-analytics:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
