import { NextResponse } from 'next/server';
import { getAdminSupabase, getAuthenticatedUser } from '@/lib/supabaseServer';
import { QotdPeerComparisonResponse, QotdOptionDistribution } from '@/lib/types';
import { getTodayDateString } from '@/lib/qotd';
import { computeQotdStreak, computeMaxQotdStreak } from '@/lib/streaks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STREAK_SAVER_PLACEHOLDER_QID = '00000000-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  const { user, errorResponse } = await getAuthenticatedUser(request);
  if (!user || errorResponse) {
    return errorResponse || NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }

  const supabaseAdmin = getAdminSupabase();

  try {

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    const todayStr = getTodayDateString();

    // 1. If questionId is provided, calculate anonymous option breakdown
    let questionStats: QotdPeerComparisonResponse['questionStats'] = null;

    if (questionId && questionId !== STREAK_SAVER_PLACEHOLDER_QID) {
      const [qDataRes, qAttemptsRes] = await Promise.all([
        supabaseAdmin
          .from('questions')
          .select('options')
          .eq('id', questionId)
          .maybeSingle(),
        supabaseAdmin
          .from('question_attempts')
          .select('is_correct, selected_index')
          .eq('question_id', questionId)
          .eq('is_qotd', true),
      ]);

      const numOptions = Array.isArray(qDataRes.data?.options) ? qDataRes.data.options.length : 5;
      const qAttempts = qAttemptsRes.data || [];
      const totalResponders = qAttempts.length;
      let correctCount = 0;
      const rawOptionCounts: Record<number, number> = {};

      qAttempts.forEach((a) => {
        if (a.is_correct) correctCount++;
        if (a.selected_index != null) {
          rawOptionCounts[a.selected_index] = (rawOptionCounts[a.selected_index] || 0) + 1;
        }
      });

      const optionCounts: Record<number, QotdOptionDistribution> = {};
      for (let i = 0; i < numOptions; i++) {
        const count = rawOptionCounts[i] || 0;
        optionCounts[i] = {
          count,
          pct: totalResponders > 0 ? Math.round((count / totalResponders) * 100) : 0,
        };
      }

      questionStats = {
        questionId,
        totalResponders,
        correctCount,
        incorrectCount: totalResponders - correctCount,
        accuracyPct: totalResponders > 0 ? Math.round((correctCount / totalResponders) * 100) : 0,
        optionCounts,
      };
    }

    // 2. Program-wide cumulative QOTD aggregates (anonymous benchmark)
    // Fetch all QOTD attempts with deterministic pagination to ensure we never get truncated by PostgREST 1000 row cap
    const rawAttempts: any[] = [];
    let attPage = 0;
    const attPageSize = 1000;
    while (true) {
      const { data: pageData, error: pageErr } = await supabaseAdmin
        .from('question_attempts')
        .select('user_id, question_id, is_correct, created_at')
        .eq('is_qotd', true)
        .order('id', { ascending: true })
        .range(attPage * attPageSize, (attPage + 1) * attPageSize - 1);
      if (pageErr) throw pageErr;
      if (!pageData || pageData.length === 0) break;
      rawAttempts.push(...pageData);
      if (pageData.length < attPageSize) break;
      attPage++;
    }

    // Keep streak-saver placeholder dates for streak continuity, but exclude from QOTD accuracy/counts
    const userDatesMap = new Map<string, string[]>();
    rawAttempts.forEach((a) => {
      if (!userDatesMap.has(a.user_id)) {
        userDatesMap.set(a.user_id, []);
      }
      if (a.created_at) {
        userDatesMap.get(a.user_id)!.push(getTodayDateString(new Date(a.created_at)));
      }
    });
    const allAttempts = rawAttempts.filter((a) => a.question_id !== STREAK_SAVER_PLACEHOLDER_QID);

    const { data: streaksData } = await supabaseAdmin
      .from('user_streaks')
      .select('user_id, current_qotd_streak, max_qotd_streak');

    const allStreaks = streaksData || [];

    const distinctParticipants = new Set(allAttempts.map((a) => a.user_id)).size;
    const totalProgramAttempts = allAttempts.length;
    const totalProgramCorrect = allAttempts.filter((a) => a.is_correct).length;
    const programAccuracyPct = totalProgramAttempts > 0
      ? Math.round((totalProgramCorrect / totalProgramAttempts) * 100)
      : 0;

    const activeStreaks: number[] = [];
    userDatesMap.forEach((dates) => {
      const s = computeQotdStreak(dates, todayStr);
      if (s > 0) activeStreaks.push(s);
    });
    activeStreaks.sort((a, b) => a - b);

    let medianStreak = 0;
    if (activeStreaks.length > 0) {
      const mid = Math.floor(activeStreaks.length / 2);
      medianStreak = activeStreaks.length % 2 !== 0
        ? activeStreaks[mid]
        : Math.round((activeStreaks[mid - 1] + activeStreaks[mid]) / 2);
    }

    // 3. Personal Stats for the authenticated user
    const userAttempts = allAttempts.filter((a) => a.user_id === user.id);
    const userDates = userDatesMap.get(user.id) || [];
    const userStreak = allStreaks.find((s) => s.user_id === user.id);

    const personalCorrect = userAttempts.filter((a) => a.is_correct).length;
    const personalTotal = userAttempts.length;
    const personalAccuracy = personalTotal > 0
      ? Math.round((personalCorrect / personalTotal) * 100)
      : 0;

    const currentStreak = computeQotdStreak(userDates, todayStr);
    const maxStreak = Math.max(
      computeMaxQotdStreak(userDates),
      userStreak?.max_qotd_streak || 0,
      currentStreak
    );

    const response: QotdPeerComparisonResponse = {
      questionStats,
      programStats: {
        totalProgramParticipants: distinctParticipants,
        totalAttempts: totalProgramAttempts,
        programAccuracyPct,
        medianStreak,
      },
      personalStats: {
        totalAttempts: personalTotal,
        correctCount: personalCorrect,
        accuracyPct: personalAccuracy,
        currentStreak,
        maxStreak,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err: any) {
    console.error('Error fetching QOTD peer comparison:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
