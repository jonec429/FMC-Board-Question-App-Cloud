import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentAcademicYear, deriveLabel } from '@/lib/academicYear';
import { computeMaxQotdStreak } from '@/lib/streaks';
import { getTodayDateString } from '@/lib/qotd';
import { ChallengeResidentStanding, ChallengeStandingsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearParam = searchParams.get('academicYear');
    const academicYear = academicYearParam ? parseInt(academicYearParam, 10) : getCurrentAcademicYear();

    // Academic year date range (e.g. AY 2027 runs July 1, 2026 -> June 30, 2027)
    const ayStartDate = `${academicYear - 1}-07-01T00:00:00.000Z`;
    const ayEndDate = `${academicYear}-07-01T00:00:00.000Z`;

    // 1. Fetch active curriculum blocks for this academic year (excluding demo)
    const { data: blocksData, error: blocksErr } = await supabaseAdmin
      .from('blocks')
      .select('id, title, block_type, is_archived, academic_year')
      .eq('academic_year', academicYear)
      .eq('is_archived', false);

    if (blocksErr) throw blocksErr;

    const requiredBlocks = (blocksData || []).filter(
      (b) => b.block_type !== 'demo' && !b.title?.toLowerCase().includes('demo')
    );
    const requiredBlockTitles = requiredBlocks.map((b) => b.title);
    const totalRequiredBlocks = requiredBlocks.length;

    // 2. Fetch active roster (excluding faculty)
    const { data: rosterData, error: rosterErr } = await supabaseAdmin
      .from('authorized_roster')
      .select('email, name, pgy, cohort_year, status, pgy_override, track')
      .neq('pgy', 'Faculty');

    if (rosterErr) throw rosterErr;
    const activeRoster = (rosterData || []).filter((r) => r.status !== 'archived' && r.status !== 'inactive');

    // 3. Fetch user profiles
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, pgy');

    const profileByEmail = new Map<string, any>();
    const profileByUserId = new Map<string, any>();
    (profilesData || []).forEach((p) => {
      if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
      if (p.id) profileByUserId.set(p.id, p);
    });

    // 4. Fetch results for this academic year
    const { data: resultsData, error: resultsErr } = await supabaseAdmin
      .from('results')
      .select('user_id, legacy_email, topic, academic_points, timing_status, score, total, percentage, created_at')
      .eq('academic_year', academicYear);

    if (resultsErr) throw resultsErr;

    // 5. Fetch user streaks
    const { data: streaksData } = await supabaseAdmin
      .from('user_streaks')
      .select('user_id, current_qotd_streak, max_qotd_streak, last_qotd_date');

    const streakByUserId = new Map<string, any>();
    (streaksData || []).forEach((s) => {
      if (s.user_id) streakByUserId.set(s.user_id, s);
    });

    // 6. Fetch QOTD attempts for this academic year (paginate if large)
    const qotdAttempts: Array<{ user_id: string; created_at: string }> = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: pageData, error: pageErr } = await supabaseAdmin
        .from('question_attempts')
        .select('user_id, created_at')
        .eq('is_qotd', true)
        .gte('created_at', ayStartDate)
        .lt('created_at', ayEndDate)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageErr) throw pageErr;
      if (!pageData || pageData.length === 0) break;
      qotdAttempts.push(...pageData);
      if (pageData.length < pageSize) break;
      page++;
    }

    const qotdAttemptsByUserId = new Map<string, string[]>();
    qotdAttempts.forEach((qa) => {
      if (!qa.user_id) return;
      const list = qotdAttemptsByUserId.get(qa.user_id) || [];
      if (qa.created_at) list.push(qa.created_at);
      qotdAttemptsByUserId.set(qa.user_id, list);
    });

    // 7. Assemble per-resident stats
    const rawStandings = activeRoster.map((resident) => {
      const email = resident.email?.toLowerCase() || '';
      const prof = profileByEmail.get(email);
      const uid = prof?.id || null;
      const name = prof?.full_name || resident.name || email;
      const pgy = deriveLabel(resident, academicYear) || resident.pgy || 'Resident';

      // Gather this resident's results
      const resList = (resultsData || []).filter(
        (r) => (uid && r.user_id === uid) || (r.legacy_email && r.legacy_email.toLowerCase() === email)
      );

      let attendancePoints = 0;
      let manualPoints = 0;
      const topicBestPts = new Map<string, number>();
      const completedBlockTitles = new Set<string>();

      resList.forEach((r) => {
        const top = r.topic || '';
        if (/\[attendance\]/i.test(top)) {
          attendancePoints += (r.academic_points || 1);
        } else if (/\[manual\]/i.test(top)) {
          manualPoints += (r.academic_points || 0);
        } else {
          const cur = topicBestPts.get(top) || 0;
          if ((r.academic_points || 0) > cur || !topicBestPts.has(top)) {
            topicBestPts.set(top, r.academic_points || 0);
          }

          // Check if this result represents completion of a required curriculum block
          // Note: "even if it was completed late" -> timing_status === 'Late' or score/total exists
          if (r.timing_status != null || (r.academic_points || 0) > 0 || (r.total || 0) > 0) {
            const matched = requiredBlocks.find(
              (b) => b.title === top || top.startsWith(b.title) || b.id === (r as any).quiz_id
            );
            if (matched) {
              completedBlockTitles.add(matched.title);
            }
          }
        }
      });

      const blockPoints = Array.from(topicBestPts.values()).reduce((a, b) => a + b, 0);
      const totalAp = blockPoints + attendancePoints + manualPoints;

      // QOTD and streaks
      const rawUserStreak = uid ? streakByUserId.get(uid) : null;
      const userQotdTimestamps = uid ? (qotdAttemptsByUserId.get(uid) || []) : [];
      const qotdCompletedCount = userQotdTimestamps.length;

      // Calculate max streak in this AY from real attempts timestamps
      const qotdDateStrings = userQotdTimestamps.map((ts) => getTodayDateString(new Date(ts)));
      const derivedMaxStreak = computeMaxQotdStreak(qotdDateStrings);
      const longestStreak = Math.max(rawUserStreak?.max_qotd_streak || 0, derivedMaxStreak);
      const currentStreak = rawUserStreak?.current_qotd_streak || 0;

      const completedTitlesArray = Array.from(completedBlockTitles);
      const completedBlocksCount = completedTitlesArray.length;
      const missingBlockTitles = requiredBlockTitles.filter((t) => !completedBlockTitles.has(t));
      const isEligible = totalRequiredBlocks > 0 && completedBlocksCount >= totalRequiredBlocks;

      // Detailed Block Audit for verifying and spot checking
      const blockAudit = requiredBlocks.map((b) => {
        const res = resList.find(
          (r) => r.topic === b.title || (r.topic && r.topic.startsWith(b.title)) || (b.id && (r as any).quiz_id === b.id)
        );
        const isDone = !!res && (res.timing_status != null || (res.academic_points || 0) > 0 || (res.total || 0) > 0);
        return {
          title: b.title,
          isCompleted: isDone,
          timingStatus: res?.timing_status || (isDone ? 'Completed' : 'Missing'),
          score: res?.score ?? null,
          total: res?.total ?? null,
          percentage: res?.percentage ?? null,
          academicPoints: res?.academic_points ?? 0,
          completedAt: res?.created_at ?? null,
        };
      });

      return {
        userId: uid,
        email,
        name,
        pgy,
        completedBlocksCount,
        totalRequiredBlocks,
        isEligible,
        completedBlockTitles: completedTitlesArray,
        missingBlockTitles,
        blockAudit,
        totalAp,
        blockPoints,
        attendancePoints,
        manualPoints,
        rankAp: 0,
        eligibleRankAp: null as number | null,
        qotdCompletedCount,
        rankQotd: 0,
        eligibleRankQotd: null as number | null,
        longestStreak,
        currentStreak,
        rankStreak: 0,
        eligibleRankStreak: null as number | null,
        potentialWinnings: 0,
        winningCategories: [] as string[],
      };
    });

    // 8. Assign Rankings
    // AP Ranks
    const sortedByAp = [...rawStandings].sort((a, b) => b.totalAp - a.totalAp);
    sortedByAp.forEach((s, idx) => {
      s.rankAp = idx + 1;
    });
    let eligibleApRank = 1;
    sortedByAp.forEach((s) => {
      if (s.isEligible) {
        s.eligibleRankAp = eligibleApRank++;
      }
    });

    // QOTD Ranks
    const sortedByQotd = [...rawStandings].sort((a, b) => b.qotdCompletedCount - a.qotdCompletedCount);
    sortedByQotd.forEach((s, idx) => {
      s.rankQotd = idx + 1;
    });
    let eligibleQotdRank = 1;
    sortedByQotd.forEach((s) => {
      if (s.isEligible) {
        s.eligibleRankQotd = eligibleQotdRank++;
      }
    });

    // Streak Ranks
    const sortedByStreak = [...rawStandings].sort((a, b) => b.longestStreak - a.longestStreak);
    sortedByStreak.forEach((s, idx) => {
      s.rankStreak = idx + 1;
    });
    let eligibleStreakRank = 1;
    sortedByStreak.forEach((s) => {
      if (s.isEligible) {
        s.eligibleRankStreak = eligibleStreakRank++;
      }
    });

    // 9. Assign Projected Prizes ($50 per won challenge for rank 1 eligible)
    rawStandings.forEach((s) => {
      let winTotal = 0;
      const categories: string[] = [];

      if (s.eligibleRankAp === 1) {
        winTotal += 50;
        categories.push('Most APs ($50)');
      }
      if (s.eligibleRankQotd === 1) {
        winTotal += 50;
        categories.push('Most QOTD Completed ($50)');
      }
      if (s.eligibleRankStreak === 1) {
        winTotal += 50;
        categories.push('Longest QOTD Streak ($50)');
      }

      s.potentialWinnings = winTotal;
      s.winningCategories = categories;
    });

    // Final sort by eligible first, then total AP
    const finalStandings = [...rawStandings].sort((a, b) => {
      if (a.isEligible !== b.isEligible) return Number(b.isEligible) - Number(a.isEligible);
      return b.totalAp - a.totalAp;
    });

    const eligibleStandings = rawStandings.filter((s) => s.isEligible);

    // Identify Leaders
    const topEligibleAp = eligibleStandings.sort((a, b) => b.totalAp - a.totalAp);
    const topEligibleQotd = [...eligibleStandings].sort((a, b) => b.qotdCompletedCount - a.qotdCompletedCount);
    const topEligibleStreak = [...eligibleStandings].sort((a, b) => b.longestStreak - a.longestStreak);

    const response: ChallengeStandingsResponse = {
      academicYear,
      totalRequiredBlocks,
      requiredBlockTitles,
      standings: finalStandings,
      eligibleCount: eligibleStandings.length,
      totalResidentCount: activeRoster.length,
      leaders: {
        ap: {
          overall: sortedByAp[0] || null,
          eligible: topEligibleAp[0] || null,
          top3Eligible: topEligibleAp.slice(0, 3),
          top3Overall: sortedByAp.slice(0, 3),
        },
        qotd: {
          overall: sortedByQotd[0] || null,
          eligible: topEligibleQotd[0] || null,
          top3Eligible: topEligibleQotd.slice(0, 3),
          top3Overall: sortedByQotd.slice(0, 3),
        },
        streak: {
          overall: sortedByStreak[0] || null,
          eligible: topEligibleStreak[0] || null,
          top3Eligible: topEligibleStreak.slice(0, 3),
          top3Overall: sortedByStreak.slice(0, 3),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching challenge standings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challenge standings' }, { status: 500 });
  }
}
