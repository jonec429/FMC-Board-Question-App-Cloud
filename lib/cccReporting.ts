/**
 * Clinical Competency Committee (CCC) & Academic Performance Reporting Utilities
 *
 * Provides date-bounded performance calculations, spelled-out metrics,
 * plain-English evaluations (no jargon or cryptic abbreviations), and
 * multi-format export utilities for faculty and committee reviews.
 */

import { AdminData, Profile, Result, RosterEntry, Block, BlockSchedule, AttendanceRecord } from './types';
import { getCurrentAcademicYear, formatAcademicYear, isActiveResident } from './academicYear';
import { getDueBlocks, getOverdueBlocks, getRiskLevel, getComplianceRisk, computeTrend } from './residentRisk';
import { formatDisplayName } from './utils';

export type DateRangePreset = 'ay' | '6m' | '3m' | '30d' | 'all' | 'custom';

export interface DateRangeConfig {
  preset: DateRangePreset;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  label: string;
}

export interface CategoryPerformance {
  category: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface BlockSubmissionItem {
  topic: string;
  score: number;
  total: number;
  percentage: number;
  points: number;
  date: string;
  timingStatus: 'On-Time' | 'Late' | 'Self-Directed';
}

export interface MeetingItem {
  topic: string;
  date: string;
  notes?: string;
}

export type CommitteeStanding = 'Satisfactory Progress' | 'Academic Monitoring' | 'Remediation / Review Needed';

export interface CccResidentReportItem {
  id: string;
  name: string;
  formattedName: string;
  lastNameFirst: string;
  email: string;
  pgy: string;
  pgyLabel: string;
  advisor: string;
  
  // Date-bounded Metrics (spelled out)
  curriculumAvg: number;
  curriculumAttempts: number;
  blocksCompleted: number;
  requiredBlocksTotal: number;
  onTimeRate: number;
  onTimeCount: number;
  overdueCount: number;
  overdueBlockTitles: string[];
  totalPoints: number;
  attendanceCount: number;
  
  // Standing & Clinical Competency Analysis
  standing: CommitteeStanding;
  standingColor: 'emerald' | 'amber' | 'red';
  academicRisk: 'green' | 'yellow' | 'red' | 'gray';
  complianceRisk: 'green' | 'yellow' | 'red' | 'gray';
  trendDirection: 'improving' | 'stable' | 'declining';
  trendDelta: number | null;
  flags: string[];
  narrativeSummary: string;
  
  // Detailed Records
  weakCategories: CategoryPerformance[];
  strongCategories: CategoryPerformance[];
  blockSubmissions: BlockSubmissionItem[];
  meetings: MeetingItem[];
}

/**
 * Generates start and end dates based on standard CCC review intervals.
 */
export function getDateRangePreset(preset: DateRangePreset, academicYear: number = getCurrentAcademicYear()): DateRangeConfig {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (preset) {
    case 'ay': {
      const startYear = academicYear - 1;
      const startDate = `${startYear}-07-01`;
      const endDate = `${academicYear}-06-30`;
      return {
        preset,
        startDate,
        endDate: endDate < todayStr ? endDate : todayStr,
        label: `Current Academic Year (${formatAcademicYear(academicYear)})`,
      };
    }
    case '6m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return {
        preset,
        startDate: d.toISOString().split('T')[0],
        endDate: todayStr,
        label: 'Past 6 Months (Semi-Annual CCC Review)',
      };
    }
    case '3m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return {
        preset,
        startDate: d.toISOString().split('T')[0],
        endDate: todayStr,
        label: 'Past 3 Months (Quarterly Review)',
      };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return {
        preset,
        startDate: d.toISOString().split('T')[0],
        endDate: todayStr,
        label: 'Past 30 Days (Recent Activity)',
      };
    }
    case 'all': {
      return {
        preset,
        startDate: '2020-07-01',
        endDate: todayStr,
        label: 'All-Time Residency Record',
      };
    }
    case 'custom':
    default: {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return {
        preset: 'custom',
        startDate: d.toISOString().split('T')[0],
        endDate: todayStr,
        label: 'Custom Date Range',
      };
    }
  }
}

/**
 * Human-readable full title for PGY level without confusing jargon.
 */
export function formatPgyFull(pgy?: string | null): string {
  if (!pgy) return 'Resident Physician';
  const clean = pgy.trim().toUpperCase();
  if (clean.includes('1') || clean === 'PGY-1' || clean === 'PGY1') return 'Post-Graduate Year 1 (PGY-1)';
  if (clean.includes('2') || clean === 'PGY-2' || clean === 'PGY2') return 'Post-Graduate Year 2 (PGY-2)';
  if (clean.includes('3') || clean === 'PGY-3' || clean === 'PGY3') return 'Post-Graduate Year 3 (PGY-3)';
  if (clean.toLowerCase().includes('faculty')) return 'Attending Faculty';
  if (clean.toLowerCase().includes('fellow')) return 'Fellow';
  return pgy;
}

/**
 * Plain-language narrative summary for committee review sheets.
 */
function generateNarrative(data: {
  name: string;
  pgyLabel: string;
  standing: CommitteeStanding;
  curriculumAvg: number;
  attempts: number;
  blocksCompleted: number;
  requiredTotal: number;
  onTimeRate: number;
  overdueCount: number;
  totalPoints: number;
  weakestCategory?: string;
}): string {
  const {
    name,
    pgyLabel,
    standing,
    curriculumAvg,
    attempts,
    blocksCompleted,
    requiredTotal,
    onTimeRate,
    overdueCount,
    totalPoints,
    weakestCategory,
  } = data;

  const scoreText = attempts > 0
    ? `maintains a curriculum exam average of ${Math.round(curriculumAvg)}% across ${attempts} assigned question module${attempts === 1 ? '' : 's'} (${curriculumAvg >= 70 ? 'meets program standard' : 'below 70% passing standard'})`
    : 'has not yet recorded question module attempts in this evaluation period';

  const blockText = requiredTotal > 0
    ? `has completed ${blocksCompleted} of ${requiredTotal} required curriculum block${requiredTotal === 1 ? '' : 's'} with an on-time submission rate of ${Math.round(onTimeRate)}%`
    : `has completed ${blocksCompleted} curriculum block${blocksCompleted === 1 ? '' : 's'}`;

  const overdueText = overdueCount > 0
    ? ` Notably, ${overdueCount} curriculum block${overdueCount === 1 ? ' is' : 's are'} past due and require completion.`
    : ' All required assignments are up to date.';

  const pointsText = ` Total academic engagement credit is ${totalPoints} point${totalPoints === 1 ? '' : 's'}.`;

  const growthText = weakestCategory
    ? ` Identified primary subject area for targeted board preparation: ${weakestCategory}.`
    : '';

  let standingIntro = `${name} (${pgyLabel}) is in ${standing}.`;
  if (standing === 'Satisfactory Progress') {
    standingIntro = `${name} (${pgyLabel}) demonstrates Satisfactory Academic Progress and is meeting residency milestones.`;
  } else if (standing === 'Academic Monitoring') {
    standingIntro = `${name} (${pgyLabel}) is under Academic Monitoring due to score variances or timeline compliance.`;
  } else {
    standingIntro = `${name} (${pgyLabel}) warrants Committee Review and academic support.`;
  }

  return `${standingIntro} The resident ${scoreText} and ${blockText}.${overdueText}${pointsText}${growthText}`;
}

export interface ComputeCccReportOptions {
  adminData: AdminData;
  selectedEmails?: string[];
  dateRange: DateRangeConfig;
  academicYear?: number;
}

/**
 * Computes date-bounded, non-abbreviated performance data for all selected residents.
 */
export function computeCccReportData({
  adminData,
  selectedEmails,
  dateRange,
  academicYear = getCurrentAcademicYear(),
}: ComputeCccReportOptions): CccResidentReportItem[] {
  if (!adminData) return [];

  const { roster, profiles, results, blocks, block_schedule, attendance } = adminData;

  // Map user_id to email
  const profileEmail = new Map<string, string>();
  (profiles || []).forEach((p: Profile) => {
    const e = (p?.email || '').toLowerCase();
    if (p?.id && e) profileEmail.set(p.id, e);
  });

  // Calculate required blocks due in this period or academic year
  const dueBlocksAll = getDueBlocks(blocks || [], block_schedule || [], academicYear, new Date(dateRange.endDate));

  // Determine active roster filtered to selected emails
  const activeRoster = (roster || []).filter(isActiveResident);
  const targetRoster = selectedEmails && selectedEmails.length > 0
    ? activeRoster.filter(r => selectedEmails.map(e => e.toLowerCase()).includes((r.email || '').toLowerCase()))
    : activeRoster;

  const startMs = new Date(`${dateRange.startDate}T00:00:00`).getTime();
  const endMs = new Date(`${dateRange.endDate}T23:59:59.999`).getTime();

  return targetRoster.map((rosterEntry) => {
    const email = (rosterEntry.email || '').toLowerCase();
    const displayName = rosterEntry.name || `${rosterEntry.first_name || ''} ${rosterEntry.last_name || ''}`.trim() || 'Resident Physician';
    const formattedName = formatDisplayName(displayName);
    const pgy = rosterEntry.pgy || 'PGY-1';
    const pgyLabel = formatPgyFull(pgy);
    const advisor = rosterEntry.advisor || 'Unassigned';

    // Format Last Name, First Name
    const nameParts = displayName.split(' ');
    const lastNameFirst = nameParts.length > 1
      ? `${nameParts[nameParts.length - 1]}, ${nameParts.slice(0, -1).join(' ')}`
      : displayName;

    // Filter results to this resident and within the specified date range
    const userResultsAll = (results || []).filter((r: Result & { email?: string | null }) => {
      const matchEmail = (r.legacy_email || '').toLowerCase() === email ||
        (r.email || '').toLowerCase() === email ||
        (r.user_id && profileEmail.get(r.user_id) === email);
      return matchEmail && !r.topic?.toLowerCase().includes('demo');
    });

    const userResultsInDateRange = userResultsAll.filter((r) => {
      if (!r.created_at) return true; // Keep fallback if no timestamp
      const itemMs = new Date(r.created_at).getTime();
      return itemMs >= startMs && itemMs <= endMs;
    });

    // Curriculum block submissions (assigned quizzes)
    const curriculumResults = userResultsInDateRange.filter((r) =>
      !r.topic?.includes('[Attendance]') &&
      !r.topic?.includes('[Manual]') &&
      ((r.academic_points || 0) > 0 || r.timing_status != null)
    );

    // Topic best points for curriculum blocks completed in this window
    const topicBestPts = new Map<string, { points: number; percentage: number; date: string; timing: string }>();
    curriculumResults.forEach((r) => {
      const topic = r.topic || 'Curriculum Block';
      const cur = topicBestPts.get(topic);
      const points = r.academic_points || 0;
      if (!cur || points > cur.points) {
        topicBestPts.set(topic, {
          points,
          percentage: r.percentage || 0,
          date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
          timing: r.timing_status || (points >= 2 ? 'On-Time' : 'Late'),
        });
      }
    });

    const blocksCompleted = topicBestPts.size;
    const nonBonus = Array.from(topicBestPts.entries()).filter(([t]) => !t.toLowerCase().includes('bonus'));
    const onTimeBlocks = nonBonus.filter(([, data]) => data.points >= 2);
    const onTimeCount = onTimeBlocks.length;
    const onTimeRate = nonBonus.length > 0
      ? Math.round((onTimeCount / nonBonus.length) * 100)
      : 100;

    // Curriculum Average
    const curriculumAvg = curriculumResults.length > 0
      ? Math.round(curriculumResults.reduce((s, r) => s + (r.percentage || 0), 0) / curriculumResults.length)
      : 0;

    // Overdue Blocks (due up to dateRange.endDate)
    const completedTitles = new Set(Array.from(topicBestPts.keys()));
    const overdueList = getOverdueBlocks(dueBlocksAll, completedTitles);
    const overdueCount = overdueList.length;
    const overdueBlockTitles = overdueList.map(b => b.title);

    // Total Academic Engagement Points earned during this period
    const totalPoints = userResultsInDateRange.reduce((acc, r) => acc + (r.academic_points || 0), 0);

    // Attendance records in date range
    const userAttendance = (attendance || []).filter((a: AttendanceRecord) => {
      const match = (a.resident_email || '').toLowerCase() === email || (a.user_id && profileEmail.get(a.user_id) === email);
      if (!match) return false;
      if (!a.date) return true;
      const attMs = new Date(a.date).getTime();
      return attMs >= startMs && attMs <= endMs;
    });

    // Score Trend calculation
    const scoresChrono = [...curriculumResults]
      .filter((r) => typeof r.percentage === 'number' && r.created_at)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
      .map((r) => r.percentage as number);

    const { delta: trendDelta, declining } = computeTrend(scoresChrono);
    const trendDirection: 'improving' | 'stable' | 'declining' = declining
      ? 'declining'
      : (trendDelta && trendDelta >= 8 ? 'improving' : 'stable');

    // Risk levels & standing
    const academicRisk = getRiskLevel(curriculumAvg, curriculumResults.length);
    const complianceRisk = getComplianceRisk(onTimeRate, blocksCompleted, overdueCount);

    let standing: CommitteeStanding = 'Satisfactory Progress';
    let standingColor: 'emerald' | 'amber' | 'red' = 'emerald';

    if (academicRisk === 'red' || complianceRisk === 'red' || overdueCount >= 2) {
      standing = 'Remediation / Review Needed';
      standingColor = 'red';
    } else if (academicRisk === 'yellow' || complianceRisk === 'yellow' || declining || overdueCount === 1) {
      standing = 'Academic Monitoring';
      standingColor = 'amber';
    }

    // Explicit plain-English warning flags
    const flags: string[] = [];
    if (overdueCount > 0) {
      flags.push(`${overdueCount} Required Assignment${overdueCount === 1 ? ' is' : 's are'} Overdue (${overdueBlockTitles.join(', ')})`);
    }
    if (curriculumResults.length >= 2 && curriculumAvg < 70) {
      flags.push(`Curriculum Exam Average (${curriculumAvg}%) is below the 70% program passing benchmark`);
    }
    if (blocksCompleted >= 2 && onTimeRate < 75) {
      flags.push(`On-Time Submission Rate (${onTimeRate}%) is below the 75% timeliness benchmark`);
    }
    if (declining && trendDelta !== null) {
      flags.push(`Downward performance trajectory observed (${Math.abs(Math.round(trendDelta))}% score decline in recent blocks)`);
    }

    // Category breakdown from question category_stats in this date range
    const categoryStatsMap = new Map<string, { correct: number; total: number }>();
    userResultsInDateRange.forEach((r: any) => {
      if (r.category_stats) {
        let statsObj = r.category_stats;
        if (typeof statsObj === 'string') {
          try { statsObj = JSON.parse(statsObj); } catch { statsObj = null; }
        }
        if (statsObj && typeof statsObj === 'object') {
          Object.entries(statsObj).forEach(([cat, s]: [string, any]) => {
            if (s && typeof s === 'object' && typeof s.total === 'number' && s.total > 0) {
              const prev = categoryStatsMap.get(cat) || { correct: 0, total: 0 };
              categoryStatsMap.set(cat, {
                correct: prev.correct + (s.correct || 0),
                total: prev.total + s.total,
              });
            }
          });
        }
      }
    });

    const categoryList: CategoryPerformance[] = Array.from(categoryStatsMap.entries()).map(([cat, stats]) => ({
      category: cat,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }));

    const weakCategories = [...categoryList].sort((a, b) => a.percentage - b.percentage).slice(0, 4);
    const strongCategories = [...categoryList].sort((a, b) => b.percentage - a.percentage).slice(0, 4);

    // Block submission history
    const blockSubmissions: BlockSubmissionItem[] = curriculumResults
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
      .map((r) => ({
        topic: r.topic || 'Curriculum Module',
        score: r.score || 0,
        total: r.total || 0,
        percentage: r.percentage || 0,
        points: r.academic_points || 0,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        timingStatus: (r.academic_points || 0) >= 2 ? 'On-Time' : 'Late',
      }));

    // Meetings in date range
    const meetings: MeetingItem[] = [];
    userResultsInDateRange
      .filter((r) => r.topic?.toLowerCase().includes('advisor meeting'))
      .forEach((r) => {
        meetings.push({
          topic: r.topic || 'Faculty Advising Session',
          date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        });
      });

    // Generate plain-language executive narrative
    const narrativeSummary = generateNarrative({
      name: formattedName,
      pgyLabel,
      standing,
      curriculumAvg,
      attempts: curriculumResults.length,
      blocksCompleted,
      requiredTotal: dueBlocksAll.length,
      onTimeRate,
      overdueCount,
      totalPoints,
      weakestCategory: weakCategories[0]?.category,
    });

    return {
      id: email,
      name: displayName,
      formattedName,
      lastNameFirst,
      email,
      pgy,
      pgyLabel,
      advisor,
      curriculumAvg,
      curriculumAttempts: curriculumResults.length,
      blocksCompleted,
      requiredBlocksTotal: dueBlocksAll.length,
      onTimeRate,
      onTimeCount,
      overdueCount,
      overdueBlockTitles,
      totalPoints,
      attendanceCount: userAttendance.length,
      standing,
      standingColor,
      academicRisk,
      complianceRisk,
      trendDirection,
      trendDelta,
      flags,
      narrativeSummary,
      weakCategories,
      strongCategories,
      blockSubmissions,
      meetings,
    };
  }).sort((a, b) => a.lastNameFirst.localeCompare(b.lastNameFirst));
}

/**
 * Exports data to CSV with clear, human-readable column headers.
 */
export function exportCccCsv(reportItems: CccResidentReportItem[], dateRangeLabel: string): void {
  if (reportItems.length === 0) return;

  const headers = [
    'Resident Name',
    'Email Address',
    'Training Level (PGY)',
    'Faculty Advisor',
    'Curriculum Exam Average (%)',
    'Curriculum Modules Completed',
    'Required Blocks Total',
    'On-Time Submission Rate (%)',
    'Past-Due Curriculum Blocks',
    'Academic Engagement Points',
    'Conference Attendance Sessions',
    'Committee Standing',
    'Identified Academic Warnings',
    'Executive Evaluation Narrative',
  ];

  const rows = reportItems.map((r) => [
    `"${r.name}"`,
    `"${r.email}"`,
    `"${r.pgyLabel}"`,
    `"${r.advisor}"`,
    r.curriculumAttempts > 0 ? r.curriculumAvg : 'N/A',
    r.blocksCompleted,
    r.requiredBlocksTotal,
    r.curriculumAttempts > 0 ? `${r.onTimeRate}%` : 'N/A',
    r.overdueCount,
    r.totalPoints,
    r.attendanceCount,
    `"${r.standing}"`,
    `"${r.flags.join('; ')}"`,
    `"${r.narrativeSummary.replace(/"/g, '""')}"`,
  ]);

  const csvContent = [
    `# Evaluation Period: ${dateRangeLabel}`,
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `CCC_Resident_Review_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
