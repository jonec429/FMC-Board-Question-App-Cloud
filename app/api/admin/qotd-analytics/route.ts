import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';
import { getCurrentAcademicYear, derivePGY, deriveLabel, isActiveResident } from '@/lib/academicYear';
import {
  QotdAnalyticsResponse,
  QotdDailyStatItem,
  QotdResidentStatItem,
  QotdCategoryStatItem,
  QotdPgyStatItem,
  QotdOptionDistribution,
  ResidentQotdHistoryItem,
} from '@/lib/types';
import { getTodayDateString } from '@/lib/qotd';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
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
    const isFaculty = profile?.role === 'faculty' || profile?.pgy === 'Faculty';

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
    let residentUserId = searchParams.get('residentUserId');
    const residentEmail = searchParams.get('residentEmail');
    const todayStr = getTodayDateString();
    const academicYear = getCurrentAcademicYear();

    if (!residentUserId && residentEmail) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', residentEmail.trim())
        .maybeSingle();
      if (prof?.id) {
        residentUserId = prof.id;
      }
    }

    // --------------------------------------------------------------------------
    // CASE 1: Fetch individual resident's detailed QOTD history
    // --------------------------------------------------------------------------
    if (residentUserId) {
      // 1. Fetch this resident's QOTD attempts & streak in parallel
      const [residentAttemptsRes, streakRes] = await Promise.all([
        supabaseAdmin
          .from('question_attempts')
          .select('id, question_id, is_correct, selected_index, created_at')
          .eq('user_id', residentUserId)
          .eq('is_qotd', true)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('user_streaks')
          .select('current_qotd_streak, max_qotd_streak, last_qotd_date')
          .eq('user_id', residentUserId)
          .maybeSingle(),
      ]);

      if (residentAttemptsRes.error) throw residentAttemptsRes.error;
      const residentAttempts = residentAttemptsRes.data || [];
      const streakData = streakRes.data;

      if (residentAttempts.length === 0) {
        return NextResponse.json({
          history: [],
          streak: {
            current: streakData?.current_qotd_streak || 0,
            max: streakData?.max_qotd_streak || 0,
            lastDate: streakData?.last_qotd_date || null,
          },
          stats: {
            totalAnswered: 0,
            totalCorrect: 0,
            accuracy: 0,
          },
        });
      }

      const questionIds = Array.from(new Set(residentAttempts.map((a) => a.question_id)));

      // 2. Fetch question details & schedule dates
      const [questionsRes, scheduleRes, allAttemptsForQuestionsRes] = await Promise.all([
        supabaseAdmin
          .from('questions')
          .select('id, question_text, category, year, options, correct_index, explanation')
          .in('id', questionIds),
        supabaseAdmin
          .from('qotd_schedule')
          .select('schedule_date, question_id')
          .in('question_id', questionIds),
        supabaseAdmin
          .from('question_attempts')
          .select('question_id, is_correct, selected_index')
          .in('question_id', questionIds)
          .eq('is_qotd', true),
      ]);

      const questionMap = new Map((questionsRes.data || []).map((q) => [q.id, q]));
      const scheduleMap = new Map((scheduleRes.data || []).map((s) => [s.question_id, s.schedule_date]));

      // Aggregate peer statistics for each question
      const peerStatsMap = new Map<
        string,
        { total: number; correct: number; optionCounts: Record<number, number> }
      >();

      (allAttemptsForQuestionsRes.data || []).forEach((a) => {
        const current = peerStatsMap.get(a.question_id) || { total: 0, correct: 0, optionCounts: {} };
        current.total += 1;
        if (a.is_correct) current.correct += 1;
        if (a.selected_index != null) {
          current.optionCounts[a.selected_index] = (current.optionCounts[a.selected_index] || 0) + 1;
        }
        peerStatsMap.set(a.question_id, current);
      });

      const history: ResidentQotdHistoryItem[] = residentAttempts.map((a) => {
        const q = questionMap.get(a.question_id);
        const schedDate = scheduleMap.get(a.question_id) || (a.created_at ? a.created_at.split('T')[0] : '—');
        const peer = peerStatsMap.get(a.question_id) || { total: 0, correct: 0, optionCounts: {} };

        const peerAccuracyPct = peer.total > 0 ? Math.round((peer.correct / peer.total) * 100) : 0;
        const selectedAgreementCount = a.selected_index != null ? (peer.optionCounts[a.selected_index] || 0) : 0;
        const peerOptionAgreementPct = peer.total > 0 ? Math.round((selectedAgreementCount / peer.total) * 100) : 0;

        return {
          id: a.id,
          date: schedDate,
          questionId: a.question_id,
          questionText: q?.question_text || 'Question text unavailable',
          category: q?.category || 'General',
          year: q?.year || '',
          options: (q?.options as string[]) || [],
          correctIndex: q?.correct_index ?? 0,
          explanation: q?.explanation || '',
          selectedIndex: a.selected_index,
          isCorrect: a.is_correct,
          answeredAt: a.created_at || '',
          peerAccuracyPct,
          peerTotalCount: peer.total,
          peerOptionAgreementPct,
          peerOptionAgreementCount: selectedAgreementCount,
        };
      });

      const totalAnswered = history.length;
      const totalCorrect = history.filter((h) => h.isCorrect).length;
      const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

      return NextResponse.json({
        history,
        streak: {
          current: streakData?.current_qotd_streak || 0,
          max: streakData?.max_qotd_streak || 0,
          lastDate: streakData?.last_qotd_date || null,
        },
        stats: {
          totalAnswered,
          totalCorrect,
          accuracy,
        },
      });
    }

    // --------------------------------------------------------------------------
    // CASE 2: Full Program-Wide QOTD Analytics Suite
    // --------------------------------------------------------------------------
    const [
      attemptsRes,
      scheduleRes,
      profilesRes,
      rosterRes,
      streaksRes,
      reactionsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('question_attempts')
        .select('id, user_id, question_id, is_correct, selected_index, created_at')
        .eq('is_qotd', true),
      supabaseAdmin
        .from('qotd_schedule')
        .select('schedule_date, question:questions(id, question_text, category, year, options, correct_index, explanation)')
        .order('schedule_date', { ascending: false }),
      supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, first_name, last_name, role, pgy'),
      supabaseAdmin
        .from('authorized_roster')
        .select('email, name, first_name, last_name, cohort_year, track, pgy_override, status, advisor'),
      supabaseAdmin
        .from('user_streaks')
        .select('user_id, current_qotd_streak, max_qotd_streak, last_qotd_date'),
      supabaseAdmin
        .from('qotd_reactions')
        .select('question_id, reaction'),
    ]);

    const attempts = attemptsRes.data || [];
    const scheduleData = (scheduleRes.data || []).filter((s: any) => s.question != null);
    const profiles = profilesRes.data || [];
    const roster = rosterRes.data || [];
    const streaks = streaksRes.data || [];
    const reactions = reactionsRes.data || [];

    // Build helper maps
    const profileByUserId = new Map(profiles.map((p) => [p.id, p]));
    const profileByEmail = new Map(profiles.map((p) => [(p.email || '').toLowerCase(), p]));
    const rosterByEmail = new Map(roster.map((r) => [(r.email || '').toLowerCase(), r]));
    const streakByUserId = new Map(streaks.map((s) => [s.user_id, s]));

    // Reaction counts by question_id
    const reactionsByQuestion = new Map<string, Record<string, number>>();
    reactions.forEach((r) => {
      if (!reactionsByQuestion.has(r.question_id)) {
        reactionsByQuestion.set(r.question_id, {});
      }
      const map = reactionsByQuestion.get(r.question_id)!;
      map[r.reaction] = (map[r.reaction] || 0) + 1;
    });

    // Active FM residents list
    const activeRosterEntries = roster.filter(isActiveResident);
    const activeEmailsSet = new Set(activeRosterEntries.map((r) => (r.email || '').toLowerCase()));
    const activeResidentCount = activeRosterEntries.length || 1;

    // Filter scheduled questions up to today
    const pastAndTodaySchedule = scheduleData.filter((s: any) => s.schedule_date <= todayStr);
    const totalQuestionsServed = pastAndTodaySchedule.length;

    // Group attempts by question_id
    const attemptsByQuestion = new Map<string, any[]>();
    attempts.forEach((a) => {
      if (!attemptsByQuestion.has(a.question_id)) {
        attemptsByQuestion.set(a.question_id, []);
      }
      attemptsByQuestion.get(a.question_id)!.push(a);
    });

    // Group attempts by user_id
    const attemptsByUserId = new Map<string, any[]>();
    attempts.forEach((a) => {
      if (a.user_id) {
        if (!attemptsByUserId.has(a.user_id)) {
          attemptsByUserId.set(a.user_id, []);
        }
        attemptsByUserId.get(a.user_id)!.push(a);
      }
    });

    // 1. Executive Overview KPIs
    const totalAttempts = attempts.length;
    const totalCorrect = attempts.filter((a) => a.is_correct).length;
    const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const distinctParticipants = new Set(attempts.map((a) => a.user_id)).size;

    // Average daily participation rate across past scheduled weekdays
    let sumDailyParticipationPct = 0;
    let daysWithStats = 0;
    pastAndTodaySchedule.forEach((s: any) => {
      const qAtts = attemptsByQuestion.get(s.question.id) || [];
      const pct = (qAtts.length / activeResidentCount) * 100;
      sumDailyParticipationPct += Math.min(pct, 100);
      daysWithStats++;
    });
    const averageDailyParticipationRate = daysWithStats > 0
      ? Math.round(sumDailyParticipationPct / daysWithStats)
      : 0;

    // Active Month Reach: distinct active residents answering in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    const recentActiveUserIds = new Set(
      attempts
        .filter((a) => a.created_at && a.created_at >= thirtyDaysAgoIso)
        .map((a) => a.user_id)
    );
    const activeMonthReachCount = Array.from(recentActiveUserIds).filter((uid) => {
      const p = profileByUserId.get(uid);
      return p?.email && activeEmailsSet.has(p.email.toLowerCase());
    }).length;
    const activeMonthReachPct = Math.round((activeMonthReachCount / activeResidentCount) * 100);

    // 2. Daily Schedule Timeline
    const dailySchedule: QotdDailyStatItem[] = pastAndTodaySchedule.map((s: any) => {
      const q = s.question;
      const qAttempts = attemptsByQuestion.get(q.id) || [];
      const attemptsCount = qAttempts.length;
      const correctCount = qAttempts.filter((a) => a.is_correct).length;
      const accuracy = attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0;

      // Option distribution
      const rawCounts: Record<number, number> = {};
      qAttempts.forEach((a) => {
        if (a.selected_index != null) {
          rawCounts[a.selected_index] = (rawCounts[a.selected_index] || 0) + 1;
        }
      });
      const optionCounts: Record<number, QotdOptionDistribution> = {};
      const numOptions = Array.isArray(q.options) ? q.options.length : 5;
      for (let i = 0; i < numOptions; i++) {
        const count = rawCounts[i] || 0;
        optionCounts[i] = {
          count,
          pct: attemptsCount > 0 ? Math.round((count / attemptsCount) * 100) : 0,
        };
      }

      // Respondents list
      const respondentUserIds = new Set<string>();
      const respondents = qAttempts.map((a) => {
        respondentUserIds.add(a.user_id);
        const p = profileByUserId.get(a.user_id);
        const r = p?.email ? rosterByEmail.get(p.email.toLowerCase()) : null;
        const pgy = r ? deriveLabel(r, academicYear) : (p?.pgy || 'Other');
        const name = p?.full_name || r?.name || 'Anonymous Resident';

        return {
          userId: a.user_id,
          name,
          email: p?.email || '',
          pgy: pgy || 'Other',
          isCorrect: a.is_correct,
          selectedIndex: a.selected_index,
          answeredAt: a.created_at || '',
        };
      });

      // Pending residents (active residents who have NOT answered this question)
      const pendingResidents: Array<{ name: string; email: string; pgy: string }> = [];
      activeRosterEntries.forEach((r) => {
        const email = (r.email || '').toLowerCase();
        const p = profileByEmail.get(email);
        const uid = p?.id;
        if (!uid || !respondentUserIds.has(uid)) {
          pendingResidents.push({
            name: r.name || email,
            email: r.email || '',
            pgy: deriveLabel(r, academicYear) || 'Other',
          });
        }
      });

      return {
        date: s.schedule_date,
        questionId: q.id,
        questionText: q.question_text || '',
        category: q.category || 'General',
        year: q.year || '',
        options: (q.options as string[]) || [],
        correctIndex: q.correct_index ?? 0,
        explanation: q.explanation || '',
        attemptsCount,
        correctCount,
        accuracy,
        optionCounts,
        reactions: reactionsByQuestion.get(q.id) || {},
        respondents,
        pendingResidents,
      };
    });

    // 3. Resident Participation Roster
    const residentStats: QotdResidentStatItem[] = activeRosterEntries.map((r) => {
      const email = (r.email || '').toLowerCase();
      const p = profileByEmail.get(email);
      const uid = p?.id || null;
      const userAtts = uid ? (attemptsByUserId.get(uid) || []) : [];
      const userStreak = uid ? streakByUserId.get(uid) : null;

      const attemptsCount = userAtts.length;
      const correctCount = userAtts.filter((a) => a.is_correct).length;
      const accuracy = attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0;
      const participationRate = totalQuestionsServed > 0
        ? Math.round((attemptsCount / totalQuestionsServed) * 100)
        : 0;

      return {
        userId: uid,
        email: r.email || '',
        name: r.name || (p?.full_name ?? 'Resident'),
        pgy: deriveLabel(r, academicYear) || 'Other',
        advisor: r.advisor || 'Unassigned',
        attemptsCount,
        correctCount,
        accuracy,
        participationRate,
        currentStreak: userStreak?.current_qotd_streak || 0,
        maxStreak: userStreak?.max_qotd_streak || 0,
        lastAnsweredDate: userStreak?.last_qotd_date || (userAtts[0]?.created_at?.split('T')[0] ?? null),
      };
    });

    // 4. PGY Cohorts Breakdown
    const pgyGroups = ['PGY-1', 'PGY-2', 'PGY-3'];
    const pgyCohorts: QotdPgyStatItem[] = pgyGroups.map((pgy) => {
      const residentsInPgy = residentStats.filter((r) => r.pgy === pgy);
      const totalResidents = residentsInPgy.length;
      const totalAttempts = residentsInPgy.reduce((acc, r) => acc + r.attemptsCount, 0);
      const totalCorrect = residentsInPgy.reduce((acc, r) => acc + r.correctCount, 0);

      const averageAttemptsPerResident = totalResidents > 0 ? Math.round(totalAttempts / totalResidents) : 0;
      const accuracyRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
      const avgParticipation = totalResidents > 0
        ? Math.round(residentsInPgy.reduce((acc, r) => acc + r.participationRate, 0) / totalResidents)
        : 0;

      return {
        pgy,
        totalResidents,
        totalAttempts,
        averageAttemptsPerResident,
        accuracyRate,
        participationRate: avgParticipation,
      };
    });

    // 5. Medical Category Breakdown
    const categoryStatsMap = new Map<string, { totalQuestions: Set<string>; totalAttempts: number; correctCount: number }>();
    pastAndTodaySchedule.forEach((s: any) => {
      const q = s.question;
      const cat = q.category || 'General';
      if (!categoryStatsMap.has(cat)) {
        categoryStatsMap.set(cat, { totalQuestions: new Set(), totalAttempts: 0, correctCount: 0 });
      }
      const entry = categoryStatsMap.get(cat)!;
      entry.totalQuestions.add(q.id);

      const qAtts = attemptsByQuestion.get(q.id) || [];
      entry.totalAttempts += qAtts.length;
      entry.correctCount += qAtts.filter((a) => a.is_correct).length;
    });

    const categories: QotdCategoryStatItem[] = Array.from(categoryStatsMap.entries())
      .map(([category, data]) => ({
        category,
        totalQuestions: data.totalQuestions.size,
        totalAttempts: data.totalAttempts,
        correctCount: data.correctCount,
        accuracy: data.totalAttempts > 0 ? Math.round((data.correctCount / data.totalAttempts) * 100) : 0,
      }))
      .sort((a, b) => b.totalAttempts - a.totalAttempts);

    const response: QotdAnalyticsResponse = {
      kpis: {
        totalAttempts,
        totalQuestionsServed,
        overallAccuracy,
        distinctParticipants,
        activeResidentCount,
        averageDailyParticipationRate,
        activeMonthReachPct,
        activeMonthReachCount,
      },
      pgyCohorts,
      categories,
      dailySchedule,
      residentStats,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error computing QOTD analytics:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
