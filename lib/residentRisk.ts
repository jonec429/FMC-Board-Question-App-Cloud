import { Block, BlockSchedule } from '@/lib/types';
/**
 * Shared Resident Risk logic — used by AdminPerformance (dashboard) and
 * AdminReporting (CSV/PDF) so the two never disagree.
 *
 * Two axes:
 *   - academic   : average score on assigned curriculum blocks
 *   - compliance : on-time rate of completed blocks AND whether assigned blocks
 *                  whose due date has passed are still undone ("overdue")
 *
 * The overdue signal is the early-warning piece: a resident who simply hasn't
 * done past-due work gets flagged, instead of looking "on track" for lack of data.
 */

export type RiskLevel = 'red' | 'yellow' | 'green' | 'gray';

/** Score-based level. <3 attempts = "evaluating" (gray). */
export function getRiskLevel(pct: number, attempts: number): RiskLevel {
  if (attempts < 3) return 'gray';
  if (pct <= 50) return 'red';
  if (pct <= 65) return 'yellow';
  return 'green';
}

export interface DueBlock {
  title: string;
  endDate: string; // 'YYYY-MM-DD'
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Required curriculum blocks for an academic year whose due date (block_schedule
 * end_date) is already in the past. Excludes archived, demo, and bonus blocks, and
 * blocks with no scheduled end date.
 */
export function getDueBlocks(
  blocks: Block[],
  blockSchedule: BlockSchedule[],
  academicYear: number,
  now: Date = new Date()
): DueBlock[] {
  const today = localDateStr(now);
  const schedByBlock = new Map<string, any>();
  (blockSchedule || []).forEach((s) => {
    if (s?.block_id) schedByBlock.set(s.block_id, s);
  });

  const due: DueBlock[] = [];
  (blocks || []).forEach((b) => {
    if (!b || b.is_archived) return;
    if (String(b.academic_year ?? '') !== String(academicYear)) return;
    const t = (b.title || '').toLowerCase();
    if (t.includes('demo') || t.includes('bonus')) return;
    const end = schedByBlock.get(b.id)?.end_date;
    if (!end) return;
    // end_date is 'YYYY-MM-DD' (or a longer ISO string) — compare the date prefix.
    if (String(end).slice(0, 10) < today) due.push({ title: b.title, endDate: String(end).slice(0, 10) });
  });
  return due;
}

/** Blocks from `dueBlocks` the resident has NOT completed (matched by title). */
export function getOverdueBlocks(dueBlocks: DueBlock[], completedTitles: Set<string>): DueBlock[] {
  return dueBlocks.filter((d) => !completedTitles.has(d.title));
}

/**
 * Compliance risk = worse of the on-time signal and the overdue signal.
 *   2+ overdue blocks -> red; 1 overdue -> at least yellow; otherwise on-time level.
 */
export function getComplianceRisk(onTimePct: number, blocksCompleted: number, overdueCount: number): RiskLevel {
  let base: RiskLevel = 'green';
  if (blocksCompleted < 3) {
    base = 'gray';
  } else if (onTimePct <= 50) {
    base = 'red';
  } else if (onTimePct <= 75) {
    base = 'yellow';
  }

  if (overdueCount >= 2) return 'red';
  if (overdueCount === 1) return base === 'red' ? 'red' : 'yellow';
  return base;
}

export interface RiskInputs {
  curriculumAvg: number;
  curriculumAttempts: number;
  onTimePct: number;
  blocksCompleted: number;
  overdueCount: number;
  trendDelta?: number | null;
}

/** Plain-language reasons a resident is flagged — only the triggers that apply. */
export function getRiskReasons(x: RiskInputs): string[] {
  const reasons: string[] = [];
  if (x.overdueCount > 0) reasons.push(`${x.overdueCount} block${x.overdueCount === 1 ? '' : 's'} overdue`);
  
  const academic = getRiskLevel(x.curriculumAvg, x.curriculumAttempts);
  if (academic === 'red' || academic === 'yellow') reasons.push(`Avg ${Math.round(x.curriculumAvg)}%`);
  
  if (x.blocksCompleted >= 3 && x.onTimePct <= 75) reasons.push(`On-time ${Math.round(x.onTimePct)}%`);
  
  if (x.trendDelta != null && x.trendDelta <= -10) reasons.push(`Trending down ${Math.abs(Math.round(x.trendDelta))}%`);
  return reasons;
}

/** Coarse status label for exports, from the two axes. */
export function riskStatusLabel(
  academic: RiskLevel,
  compliance: RiskLevel,
  declining = false
): 'At Risk' | 'Needs Attention' | 'On Track' | 'Evaluating' {
  if (academic === 'red' || compliance === 'red') return 'At Risk';
  if (academic === 'yellow' || compliance === 'yellow' || declining) return 'Needs Attention';
  if (academic === 'green' || compliance === 'green') return 'On Track';
  return 'Evaluating';
}

/**
 * Recent-vs-earlier trend on a chronological list of scores (oldest -> newest %).
 * Returns the delta (recent avg - earlier avg) and whether it's a meaningful drop.
 * Needs >= 4 data points; compares the last up-to-3 against the 3 immediately before.
 */
export function computeTrend(scoresChrono: number[]): { delta: number | null; declining: boolean } {
  const n = scoresChrono.length;
  if (n < 4) return { delta: null, declining: false };
  const w = Math.min(3, Math.floor(n / 2));
  const recent = scoresChrono.slice(n - w);
  const earlier = scoresChrono.slice(n - 2 * w, n - w);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const delta = avg(recent) - avg(earlier);
  return { delta, declining: delta <= -10 };
}


