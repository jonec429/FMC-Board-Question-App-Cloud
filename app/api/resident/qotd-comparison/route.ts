import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { QotdPeerComparisonResponse, QotdOptionDistribution } from '@/lib/types';

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

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    // 1. If questionId is provided, calculate anonymous option breakdown
    let questionStats: QotdPeerComparisonResponse['questionStats'] = null;

    if (questionId) {
      const { data: qAttempts, error: qErr } = await supabaseAdmin
        .from('question_attempts')
        .select('is_correct, selected_index')
        .eq('question_id', questionId)
        .eq('is_qotd', true);

      if (!qErr && qAttempts && qAttempts.length > 0) {
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
        Object.entries(rawOptionCounts).forEach(([idxStr, count]) => {
          const idx = Number(idxStr);
          optionCounts[idx] = {
            count,
            pct: Math.round((count / totalResponders) * 100),
          };
        });

        questionStats = {
          questionId,
          totalResponders,
          correctCount,
          incorrectCount: totalResponders - correctCount,
          accuracyPct: Math.round((correctCount / totalResponders) * 100),
          optionCounts,
        };
      }
    }

    // 2. Program-wide cumulative QOTD aggregates (anonymous benchmark)
    const [attemptsRes, streaksRes] = await Promise.all([
      supabaseAdmin
        .from('question_attempts')
        .select('user_id, is_correct')
        .eq('is_qotd', true),
      supabaseAdmin
        .from('user_streaks')
        .select('user_id, current_qotd_streak, max_qotd_streak'),
    ]);

    const allAttempts = attemptsRes.data || [];
    const allStreaks = streaksRes.data || [];

    const distinctParticipants = new Set(allAttempts.map((a) => a.user_id)).size;
    const totalProgramAttempts = allAttempts.length;
    const totalProgramCorrect = allAttempts.filter((a) => a.is_correct).length;
    const programAccuracyPct = totalProgramAttempts > 0
      ? Math.round((totalProgramCorrect / totalProgramAttempts) * 100)
      : 0;

    // Median streak across participants who have at least 1 streak day
    const activeStreaks = allStreaks
      .map((s) => s.current_qotd_streak || 0)
      .sort((a, b) => a - b);
    let medianStreak = 0;
    if (activeStreaks.length > 0) {
      const mid = Math.floor(activeStreaks.length / 2);
      medianStreak = activeStreaks.length % 2 !== 0
        ? activeStreaks[mid]
        : Math.round((activeStreaks[mid - 1] + activeStreaks[mid]) / 2);
    }

    // 3. Personal Stats for the authenticated user
    const userAttempts = allAttempts.filter((a) => a.user_id === user.id);
    const userStreak = allStreaks.find((s) => s.user_id === user.id);

    const personalCorrect = userAttempts.filter((a) => a.is_correct).length;
    const personalTotal = userAttempts.length;
    const personalAccuracy = personalTotal > 0
      ? Math.round((personalCorrect / personalTotal) * 100)
      : 0;

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
        currentStreak: userStreak?.current_qotd_streak || 0,
        maxStreak: userStreak?.max_qotd_streak || 0,
      },
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error fetching QOTD peer comparison:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
