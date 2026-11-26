'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  OFFICIAL_ABFM_PREDICTOR_URL,
  ABFM_PASSING_SCALED_SCORE,
  ITE_SCALED_SEM,
  MIN_BLOCKS_FOR_READINESS,
  MIN_QUESTIONS_FOR_READINESS,
  NATIONAL_PGY_MEANS,
  ReadinessZone,
  BayesianPredictionOutput,
  ExperimentalReadinessSummary,
  SavedResidentExamScores,
  convertPracticePctToConservativeScaled,
  runAbfmBayesianModel,
  computeExperimentalReadiness,
  loadResidentExamScores,
} from '@/lib/iteScoring';
import { formatLastNameFirst } from '@/lib/utils';
import { getCurrentAcademicYear, residentMatchesCohort } from '@/lib/academicYear';
import {
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Lock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
} from 'lucide-react';

export interface BoardReadinessResidentInput {
  userId: string | null;
  name: string;
  last_name: string;
  email: string;
  pgy: string;
  label: string;
  classYear?: number | null;
  cohortYear?: number | null;
  advisor: string;
  curriculumAttempts: number;
  curriculumAvg: number;
  curriculumQuestions?: string;
  curriculumTotalQuestions: number;
  globalFirstAvg?: number | null;
  globalFirstTotal?: number;
  globalBestAvg?: number | null;
  globalBestTotal?: number;
  curriculumFirstAvg?: number | null;
  curriculumFirstTotal?: number;
  curriculumBestAvg?: number | null;
  curriculumBestTotal?: number;
  blocksCompleted: number;
  overdueCount: number;
  onTimePct: number;
  declining: boolean;
  trendDelta: number | null;
}

interface AdminBoardReadinessProps {
  residents: BoardReadinessResidentInput[];
  selectedYear: number;
  scoresVersion: number;
  myAdviseeEmails?: string[];
  onSelectResidentReadiness: (email: string) => void;
}

interface EvaluatedResident {
  resident: BoardReadinessResidentInput;
  pgyLevel: 1 | 2 | 3;
  savedScores: SavedResidentExamScores | null;
  bayesian: BayesianPredictionOutput | null;
  readiness: ExperimentalReadinessSummary;
}

type CohortFilter = 'ALL' | 'MY_ADVISEES' | 'PGY-1' | 'PGY-2' | 'PGY-3';
type SortKey = 'zone' | 'name' | 'pgy' | 'baseline' | 'currAvg' | 'scale' | 'ite';

const ZONE_PRIORITY: Record<ReadinessZone, number> = {
  at_risk: 0,
  borderline: 1,
  on_track: 2,
  evaluating: 3,
};

function parsePgyLevel(labelOrPgy: string): 1 | 2 | 3 {
  if (/3/.test(labelOrPgy)) return 3;
  if (/1/.test(labelOrPgy)) return 1;
  return 2;
}

function scaleToPct(score: number): number {
  const clamped = Math.max(220, Math.min(680, score));
  return ((clamped - 220) / (680 - 220)) * 100;
}

export default function AdminBoardReadiness({
  residents,
  selectedYear,
  scoresVersion,
  myAdviseeEmails,
  onSelectResidentReadiness,
}: AdminBoardReadinessProps) {
  const [scoresByKey, setScoresByKey] = useState<Record<string, SavedResidentExamScores>>({});
  const [showMethodology, setShowMethodology] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<'all' | ReadinessZone>('all');
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('zone');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [metricScope, setMetricScope] = useState<'global' | 'curriculum'>('global');
  const [metricAttempt, setMetricAttempt] = useState<'first' | 'best'>('first');

  useEffect(() => {
    const next: Record<string, SavedResidentExamScores> = {};
    for (const r of residents) {
      const key = r.email || r.userId || r.name;
      next[key] = loadResidentExamScores(key);
    }
    setScoresByKey(next);
  }, [residents, scoresVersion]);

  const evaluated = useMemo<EvaluatedResident[]>(() => {
    return residents.map((resident) => {
      const pgyLevel = parsePgyLevel(resident.label || resident.pgy || '');
      const key = resident.email || resident.userId || resident.name;
      const savedScores = scoresByKey[key] || null;
      let bayesian: BayesianPredictionOutput | null = null;

      if (savedScores) {
        const hasIte =
          (savedScores.pgy1Ite != null && savedScores.pgy1Ite >= 200) ||
          (savedScores.pgy2Ite != null && savedScores.pgy2Ite >= 200) ||
          (savedScores.pgy3Ite != null && savedScores.pgy3Ite >= 200);
        if (hasIte) {
          bayesian = runAbfmBayesianModel({
            examType: savedScores.examType,
            pgy1Score: savedScores.pgy1Ite,
            pgy2Score: savedScores.pgy2Ite,
            pgy3Score: savedScores.pgy3Ite,
          });
        }
      }

      const activeTotalQuestions =
        metricScope === 'global'
          ? metricAttempt === 'first'
            ? (resident.globalFirstTotal || resident.curriculumTotalQuestions)
            : (resident.globalBestTotal || resident.curriculumTotalQuestions)
          : metricAttempt === 'first'
            ? (resident.curriculumFirstTotal ?? resident.curriculumTotalQuestions)
            : (resident.curriculumBestTotal ?? resident.curriculumTotalQuestions);

      const activeAccuracyPct =
        metricScope === 'global'
          ? metricAttempt === 'first'
            ? (resident.globalFirstAvg ?? resident.curriculumAvg)
            : (resident.globalBestAvg ?? resident.curriculumAvg)
          : metricAttempt === 'first'
            ? (resident.curriculumFirstAvg ?? resident.curriculumAvg)
            : (resident.curriculumBestAvg ?? resident.curriculumAvg);

      const readiness = computeExperimentalReadiness({
        blocksCompleted: resident.blocksCompleted,
        totalQuestionsAnswered: activeTotalQuestions,
        rawAccuracyPct: activeAccuracyPct,
        pgyLevel,
        bayesianBaseline: bayesian,
      });

      return {
        resident,
        pgyLevel,
        savedScores,
        bayesian,
        readiness,
      };
    });
  }, [residents, scoresByKey, metricScope, metricAttempt]);

  // Cohort-scoped rows (before zoneFilter/search) for summary cards
  const cohortScoped = useMemo(() => {
    const activeAY = selectedYear === 0 ? getCurrentAcademicYear() : selectedYear;
    const adviseeSet = new Set((myAdviseeEmails || []).map((e) => e.toLowerCase()));

    return evaluated.filter(({ resident }) => {
      if (cohortFilter === 'MY_ADVISEES') {
        return adviseeSet.has(resident.email.toLowerCase());
      }
      if (cohortFilter !== 'ALL') {
        return residentMatchesCohort(
          {
            pgy: resident.pgy,
            cohort_year: resident.cohortYear,
            graduated_year: null,
            track: 'family_medicine',
          },
          cohortFilter,
          activeAY
        );
      }
      return true;
    });
  }, [evaluated, cohortFilter, selectedYear, myAdviseeEmails]);

  const zoneCounts = useMemo(() => {
    const onTrack = cohortScoped.filter((e) => e.readiness.zone === 'on_track').length;
    const borderline = cohortScoped.filter((e) => e.readiness.zone === 'borderline').length;
    const atRisk = cohortScoped.filter((e) => e.readiness.zone === 'at_risk').length;
    const evaluating = cohortScoped.filter((e) => e.readiness.zone === 'evaluating').length;
    const unlocked = onTrack + borderline + atRisk;
    return { onTrack, borderline, atRisk, evaluating, unlocked, total: cohortScoped.length };
  }, [cohortScoped]);

  // Class-by-Class breakdown computed across all residents in the view
  const classBreakdown = useMemo(() => {
    const groups = new Map<string, EvaluatedResident[]>();
    evaluated.forEach((item) => {
      const lbl = item.resident.label || 'Resident';
      const arr = groups.get(lbl) || [];
      arr.push(item);
      groups.set(lbl, arr);
    });

    return Array.from(groups.entries())
      .map(([label, list]) => {
        const unlockedItems = list.filter((i) => i.readiness.isUnlocked);
        const attemptedItems = list.filter((i) => i.resident.curriculumAttempts > 0);
        const avgSource = unlockedItems.length > 0 ? unlockedItems : attemptedItems;
        const hasAvg = avgSource.length > 0;
        const classAvg = hasAvg
          ? avgSource.reduce((sum, i) => sum + i.resident.curriculumAvg, 0) / avgSource.length
          : 0;
        const impliedMid = hasAvg ? convertPracticePctToConservativeScaled(classAvg) : null;
        const bandLow = impliedMid != null ? Math.max(200, impliedMid - ITE_SCALED_SEM) : null;
        const bandHigh = impliedMid != null ? Math.min(800, impliedMid + ITE_SCALED_SEM) : null;
        const pgyLevel = parsePgyLevel(label);
        const classYear = list.find((i) => i.resident.classYear)?.resident.classYear || null;

        const onTrack = list.filter((i) => i.readiness.zone === 'on_track').length;
        const borderline = list.filter((i) => i.readiness.zone === 'borderline').length;
        const atRisk = list.filter((i) => i.readiness.zone === 'at_risk').length;
        const evaluating = list.filter((i) => i.readiness.zone === 'evaluating').length;

        return {
          label,
          classYear,
          pgyLevel,
          total: list.length,
          unlockedCount: unlockedItems.length,
          usingEarlyBaseline: unlockedItems.length === 0 && attemptedItems.length > 0,
          hasAvg,
          classAvg,
          impliedMid,
          bandLow,
          bandHigh,
          onTrack,
          borderline,
          atRisk,
          evaluating,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [evaluated]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = cohortScoped.filter(({ resident, readiness }) => {
      if (zoneFilter !== 'all' && readiness.zone !== zoneFilter) return false;
      if (!q) return true;
      const classYr = resident.classYear ? String(resident.classYear) : '';
      return (
        resident.name.toLowerCase().includes(q) ||
        (resident.last_name && resident.last_name.toLowerCase().includes(q)) ||
        resident.email.toLowerCase().includes(q) ||
        (resident.advisor && resident.advisor.toLowerCase().includes(q)) ||
        (resident.label && resident.label.toLowerCase().includes(q)) ||
        classYr.includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'zone') {
        cmp = ZONE_PRIORITY[a.readiness.zone] - ZONE_PRIORITY[b.readiness.zone];
        if (cmp === 0) {
          if (a.readiness.isUnlocked && b.readiness.isUnlocked) {
            cmp = a.resident.curriculumAvg - b.resident.curriculumAvg;
          } else {
            cmp = b.resident.blocksCompleted - a.resident.blocksCompleted;
          }
        }
      } else if (sortKey === 'name') {
        cmp = a.resident.last_name.localeCompare(b.resident.last_name);
      } else if (sortKey === 'pgy') {
        cmp = a.resident.label.localeCompare(b.resident.label);
      } else if (sortKey === 'baseline') {
        cmp =
          a.resident.blocksCompleted !== b.resident.blocksCompleted
            ? a.resident.blocksCompleted - b.resident.blocksCompleted
            : a.resident.curriculumTotalQuestions - b.resident.curriculumTotalQuestions;
      } else if (sortKey === 'currAvg') {
        const aVal = a.resident.curriculumAttempts > 0 ? a.resident.curriculumAvg : -1;
        const bVal = b.resident.curriculumAttempts > 0 ? b.resident.curriculumAvg : -1;
        cmp = aVal - bVal;
      } else if (sortKey === 'scale') {
        const aVal = a.readiness.isUnlocked ? a.readiness.practiceImpliedScaledScore : -1;
        const bVal = b.readiness.isUnlocked ? b.readiness.practiceImpliedScaledScore : -1;
        cmp = aVal - bVal;
      } else if (sortKey === 'ite') {
        const aVal = a.bayesian && a.bayesian.mostRecentObservedStage !== 'none'
          ? a.bayesian.certificationPassProbability
          : -1;
        const bVal = b.bayesian && b.bayesian.mostRecentObservedStage !== 'none'
          ? b.bayesian.certificationPassProbability
          : -1;
        cmp = aVal - bVal;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [cohortScoped, zoneFilter, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'zone' || key === 'name' || key === 'pgy');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover/col:opacity-100 transition-opacity ml-1 shrink-0" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 ml-1 shrink-0" />
    );
  };

  const handleExportCsv = () => {
    const yearLabel = selectedYear === 0 ? 'All_Years' : `AY_${selectedYear}`;
    const headers = [
      'Resident',
      'Email',
      'PGY',
      'Advisor',
      'Blocks Completed',
      'Curriculum Qs',
      'Curriculum Avg %',
      'Readiness Zone',
      'Implied Scale Midpoint',
      'Implied Band Low',
      'Implied Band High',
      'Saved ITE Stage',
      'Saved ITE Score',
      'Blended Scale Midpoint',
      'ABFM Cert >=380 Prob %',
    ];

    const zoneTextMap: Record<ReadinessZone, string> = {
      on_track: 'On Track (>65%)',
      borderline: 'Borderline (60-65%)',
      at_risk: 'At Risk (<60%)',
      evaluating: 'Building Baseline',
    };

    const rows = filteredAndSorted.map(({ resident, bayesian, readiness }) => {
      const hasIte = bayesian && bayesian.mostRecentObservedStage !== 'none';
      return [
        `"${formatLastNameFirst(resident.name, resident.last_name).replace(/"/g, '""')}"`,
        `"${resident.email}"`,
        `"${resident.label}"`,
        `"${(resident.advisor || '').replace(/"/g, '""')}"`,
        String(resident.blocksCompleted),
        String(resident.curriculumTotalQuestions),
        resident.curriculumAttempts > 0 ? resident.curriculumAvg.toFixed(1) : '',
        `"${zoneTextMap[readiness.zone]}"`,
        readiness.isUnlocked ? String(readiness.practiceImpliedScaledScore) : '',
        readiness.isUnlocked ? String(readiness.practiceBandLow) : '',
        readiness.isUnlocked ? String(readiness.practiceBandHigh) : '',
        hasIte ? `"${bayesian.mostRecentObservedStage}"` : '',
        hasIte && bayesian.mostRecentObservedScore != null ? String(bayesian.mostRecentObservedScore) : '',
        readiness.blendedScaledScore != null ? String(readiness.blendedScaledScore) : '',
        hasIte ? (bayesian.certificationPassProbability * 100).toFixed(1) : '',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FMC_Board_Readiness_${yearLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleZone = (z: ReadinessZone) => {
    setZoneFilter((prev) => (prev === z ? 'all' : z));
  };

  const zoneLabelBadge = (zone: ReadinessZone) => {
    if (zone === 'on_track') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheck className="w-3 h-3" /> On Track
        </span>
      );
    }
    if (zone === 'borderline') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <AlertTriangle className="w-3 h-3" /> Borderline
        </span>
      );
    }
    if (zone === 'at_risk') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
          <AlertCircle className="w-3 h-3" /> At Risk
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <Lock className="w-3 h-3" /> Baseline
      </span>
    );
  };

  const hasMyAdvisees = (myAdviseeEmails?.length || 0) > 0;
  const activeAY = selectedYear === 0 ? getCurrentAcademicYear() : selectedYear;

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. Compact Experimental Beta Disclaimer Banner */}
      <div className="bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Board Readiness Overview (Experimental Beta)
                </h3>
                <span className="shrink-0 whitespace-nowrap inline-flex items-center bg-amber-200/90 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  ABFM 380 Equated · Guidance Only
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
                Min Passing Standard: <strong>{ABFM_PASSING_SCALED_SCORE} Scaled (~60% Floor)</strong> · ITE SEM:{' '}
                <strong>±{ITE_SCALED_SEM} pts</strong> · Unlocks at{' '}
                <strong>≥{MIN_BLOCKS_FOR_READINESS} Blocks</strong> or <strong>≥{MIN_QUESTIONS_FOR_READINESS} Qs</strong>.
                Practice percentages typically run higher than proctored exam scores; click any resident to review or enter official ITE scores.
              </p>
            </div>
          </div>

          <a
            href={OFFICIAL_ABFM_PREDICTOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 bg-amber-900 hover:bg-amber-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl transition-colors shadow-sm self-start"
          >
            <span>Official ABFM Calculator</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-3 pt-2.5 border-t border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowMethodology((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline"
          >
            {showMethodology ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showMethodology ? 'Hide Methodology & Score Cutoffs' : 'View Methodology, SEM Cutoffs & ITE Storage Note'}</span>
          </button>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Cutoffs: &lt;60% At Risk · 60–65% Borderline · &gt;65% On Track
          </span>
        </div>

        {showMethodology && (
          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200/90 space-y-1.5 leading-relaxed">
            <p>
              <strong>1. Practice vs. Proctored Conditions:</strong> Curriculum blocks are untimed learning exercises; the unified 2023–2025 conservative curve anchors 60.0% practice accuracy to the 380 ABFM minimum passing score and 65.5% to ~438 (+1 SEM buffer).
            </p>
            <p>
              <strong>2. Why 60%–65% Is Borderline (±38 SEM):</strong> With an official ITE Standard Error of Measurement of ±38 scaled points (~5% raw), residents averaging 60%–65% sit within 1 SEM of falling below 380 on exam day.
            </p>
            <p>
              <strong>3. Bayesian Growth Assumption &amp; Local Privacy:</strong> ABFM Bayesian probabilities assume typical national growth (+40–60 pts/yr) through graduation. Any entered ITE / Step 2 / COMLEX scores are stored locally on this browser only.
            </p>
          </div>
        )}
      </div>

      {/* 2. 4 Interactive Readiness Zone Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => toggleZone('on_track')}
          className={`text-left p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${
            zoneFilter === 'on_track'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/25 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              On Track
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{zoneCounts.onTrack}</div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            &gt;65% · Safe Buffer ({zoneCounts.unlocked > 0 ? `${Math.round((zoneCounts.onTrack / zoneCounts.unlocked) * 100)}%` : '0%'} of unlocked)
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleZone('borderline')}
          className={`text-left p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${
            zoneFilter === 'borderline'
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/25 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Borderline
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{zoneCounts.borderline}</div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            60–65% · Within ±{ITE_SCALED_SEM} SEM ({zoneCounts.unlocked > 0 ? `${Math.round((zoneCounts.borderline / zoneCounts.unlocked) * 100)}%` : '0%'} of unlocked)
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleZone('at_risk')}
          className={`text-left p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${
            zoneFilter === 'at_risk'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-500 ring-2 ring-red-500/25 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
              At Risk
            </span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{zoneCounts.atRisk}</div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            &lt;60% · Below {ABFM_PASSING_SCALED_SCORE} Floor ({zoneCounts.unlocked > 0 ? `${Math.round((zoneCounts.atRisk / zoneCounts.unlocked) * 100)}%` : '0%'} of unlocked)
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleZone('evaluating')}
          className={`text-left p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${
            zoneFilter === 'evaluating'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 ring-2 ring-slate-400/30 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Building Baseline
            </span>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{zoneCounts.evaluating}</div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            Needs ≥{MIN_BLOCKS_FOR_READINESS} blocks or ≥{MIN_QUESTIONS_FOR_READINESS} Qs
          </div>
        </button>
      </div>

      {/* 3. Class-by-Class Readiness & ABFM Peer Comparison */}
      {classBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {classBreakdown.map((cls) => {
            const peerMean = NATIONAL_PGY_MEANS[cls.pgyLevel].mean;
            const bandColorClass =
              cls.impliedMid == null
                ? 'bg-slate-400'
                : cls.impliedMid < ABFM_PASSING_SCALED_SCORE
                ? 'bg-red-500/85 dark:bg-red-400/85'
                : (cls.bandLow || 0) < ABFM_PASSING_SCALED_SCORE
                ? 'bg-amber-500/85 dark:bg-amber-400/85'
                : 'bg-emerald-500/85 dark:bg-emerald-400/85';

            return (
              <div
                key={cls.label}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {cls.label}{' '}
                        {cls.classYear ? (
                          <span className="font-bold text-slate-400 dark:text-slate-500 text-xs">
                            (Class of {cls.classYear})
                          </span>
                        ) : null}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 whitespace-nowrap">
                      {cls.unlockedCount} / {cls.total} unlocked
                    </span>
                  </div>

                  {cls.hasAvg && cls.impliedMid != null && cls.bandLow != null && cls.bandHigh != null ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Implied Scaled Band {cls.usingEarlyBaseline ? '(Early Baseline)' : ''}
                          </div>
                          <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                            {cls.bandLow} – {cls.bandHigh}
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1.5">
                              (~{cls.impliedMid})
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Class Avg</div>
                          <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                            {cls.classAvg.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Mini 220..680 Visual Scale Bar */}
                      <div className="relative h-5 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden mt-3 mb-2">
                        <div
                          className="absolute inset-y-0 left-0 bg-red-200/60 dark:bg-red-950/50 border-r-2 border-red-500/80"
                          style={{ width: `${scaleToPct(ABFM_PASSING_SCALED_SCORE)}%` }}
                        />
                        <div
                          className={`absolute inset-y-1 rounded-md shadow-sm transition-all ${bandColorClass}`}
                          style={{
                            left: `${scaleToPct(cls.bandLow)}%`,
                            width: `${Math.max(4, scaleToPct(cls.bandHigh) - scaleToPct(cls.bandLow))}%`,
                          }}
                        />
                        <div
                          className="absolute inset-y-0 w-0.5 bg-slate-900 dark:bg-white"
                          style={{ left: `${scaleToPct(cls.impliedMid)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 w-0.5 bg-indigo-600 dark:bg-indigo-400"
                          style={{ left: `${scaleToPct(peerMean)}%` }}
                          title={NATIONAL_PGY_MEANS[cls.pgyLevel].label}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>250</span>
                        <span className="text-red-600 dark:text-red-400 font-black">380 Min</span>
                        <span className="text-indigo-600 dark:text-indigo-400">
                          PGY-{cls.pgyLevel} Avg ({peerMean})
                        </span>
                        <span>650+</span>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> No curriculum quiz attempts recorded yet.
                    </div>
                  )}
                </div>

                {/* Stacked Zone Distribution Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                    {cls.onTrack > 0 && (
                      <div className="bg-emerald-500 h-full" style={{ width: `${(cls.onTrack / cls.total) * 100}%` }} />
                    )}
                    {cls.borderline > 0 && (
                      <div className="bg-amber-400 h-full" style={{ width: `${(cls.borderline / cls.total) * 100}%` }} />
                    )}
                    {cls.atRisk > 0 && (
                      <div className="bg-red-500 h-full" style={{ width: `${(cls.atRisk / cls.total) * 100}%` }} />
                    )}
                    {cls.evaluating > 0 && (
                      <div className="bg-slate-300 dark:bg-slate-600 h-full" style={{ width: `${(cls.evaluating / cls.total) * 100}%` }} />
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400">{cls.onTrack} On Track</span>
                    <span>·</span>
                    <span className="text-amber-600 dark:text-amber-400">{cls.borderline} Borderline</span>
                    <span>·</span>
                    <span className="text-red-600 dark:text-red-400">{cls.atRisk} At Risk</span>
                    {cls.evaluating > 0 && (
                      <>
                        <span>·</span>
                        <span>{cls.evaluating} Baseline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Program Readiness Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white">Program Readiness Roster</h3>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                Click any resident to view their ABFM Bayesian trajectory or enter official ITE scores
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {zoneFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setZoneFilter('all')}
                  className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                >
                  Showing:{' '}
                  {zoneFilter === 'on_track'
                    ? 'On Track'
                    : zoneFilter === 'borderline'
                    ? 'Borderline'
                    : zoneFilter === 'at_risk'
                    ? 'At Risk'
                    : 'Baseline'}{' '}
                  ×
                </button>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm shadow-sm"
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resident or advisor..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'ALL', label: `All (${evaluated.length})` },
                  ...(hasMyAdvisees ? [{ id: 'MY_ADVISEES' as CohortFilter, label: `My Advisees (${myAdviseeEmails?.length || 0})` }] : []),
                  { id: 'PGY-1', label: `PGY-1 (Class of ${activeAY + 2})` },
                  { id: 'PGY-2', label: `PGY-2 (Class of ${activeAY + 1})` },
                  { id: 'PGY-3', label: `PGY-3 (Class of ${activeAY})` },
                ] as Array<{ id: CohortFilter; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCohortFilter(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    cohortFilter === item.id
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/70 dark:border-slate-800/70">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMetricScope('global')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                    metricScope === 'global'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Global (All Qs)
                </button>
                <button
                  type="button"
                  onClick={() => setMetricScope('curriculum')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                    metricScope === 'curriculum'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Curriculum Blocks
                </button>
              </div>
              <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMetricAttempt('first')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                    metricAttempt === 'first'
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  First Attempt
                </button>
                <button
                  type="button"
                  onClick={() => setMetricAttempt('best')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                    metricAttempt === 'best'
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Best Attempt
                </button>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {metricScope === 'global' && metricAttempt === 'first'
                ? 'Official Standing Mode (excludes Demo, Attendance & QOTD)'
                : metricScope === 'global'
                ? 'Global Mastery (Best Attempt per unique question)'
                : metricAttempt === 'first'
                ? 'Curriculum Blocks (First Attempt per block)'
                : 'Curriculum Blocks (Best Attempt per block)'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[10px] font-black text-slate-400 dark:text-slate-500 select-none">
                <th onClick={() => handleSort('name')} className="px-5 py-3.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center gap-1">
                    <span>Resident</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('pgy')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>PGY</span>
                    {renderSortIcon('pgy')}
                  </div>
                </th>
                <th onClick={() => handleSort('baseline')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>Baseline</span>
                    {renderSortIcon('baseline')}
                  </div>
                </th>
                <th onClick={() => handleSort('currAvg')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>Curr Avg</span>
                    {renderSortIcon('currAvg')}
                  </div>
                </th>
                <th onClick={() => handleSort('scale')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>Implied Scale (±{ITE_SCALED_SEM} SEM)</span>
                    {renderSortIcon('scale')}
                  </div>
                </th>
                <th onClick={() => handleSort('ite')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>ITE / Cert Prob</span>
                    {renderSortIcon('ite')}
                  </div>
                </th>
                <th onClick={() => handleSort('zone')} className="px-3 py-3.5 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 group/col">
                  <div className="flex items-center justify-center gap-1">
                    <span>Readiness</span>
                    {renderSortIcon('zone')}
                  </div>
                </th>
                <th className="px-3 py-3.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredAndSorted.map(({ resident, bayesian, readiness }) => {
                const hasIte = bayesian && bayesian.mostRecentObservedStage !== 'none';
                const rowTint =
                  readiness.zone === 'at_risk'
                    ? 'bg-red-50/50 dark:bg-red-950/20'
                    : readiness.zone === 'borderline'
                    ? 'bg-amber-50/40 dark:bg-amber-950/15'
                    : readiness.zone === 'evaluating'
                    ? 'bg-slate-50/40 dark:bg-slate-800/20'
                    : '';

                return (
                  <tr
                    key={resident.email}
                    onClick={() => onSelectResidentReadiness(resident.email)}
                    className={`cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors group ${rowTint}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {formatLastNameFirst(resident.name, resident.last_name)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          Advisor: {resident.advisor || '—'}
                        </span>
                        {resident.declining && resident.trendDelta != null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Trending down {Math.abs(Math.round(resident.trendDelta))}%
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-center text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {resident.label}
                    </td>

                    <td className="px-3 py-3.5 text-center text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {!readiness.isUnlocked && <Lock className="w-3 h-3 text-slate-400" />}
                        {resident.blocksCompleted} blk · {resident.curriculumTotalQuestions} Qs
                      </span>
                    </td>

                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      {resident.curriculumAttempts > 0 ? (
                        <span
                          className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                            resident.curriculumAvg > 65
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : resident.curriculumAvg >= 60
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {resident.curriculumAvg.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      {readiness.isUnlocked ? (
                        <div>
                          <div
                            className={`text-xs font-black ${
                              readiness.practiceImpliedScaledScore < ABFM_PASSING_SCALED_SCORE
                                ? 'text-red-600 dark:text-red-400'
                                : readiness.practiceBandLow < ABFM_PASSING_SCALED_SCORE
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {readiness.practiceBandLow}–{readiness.practiceBandHigh}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            Mid ~{readiness.practiceImpliedScaledScore}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                          Locked ({resident.blocksCompleted}/{MIN_BLOCKS_FOR_READINESS} blk)
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      {hasIte ? (
                        <div>
                          <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {bayesian.mostRecentObservedStage}: {bayesian.mostRecentObservedScore}
                          </div>
                          <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            Cert ≥380: {(bayesian.certificationPassProbability * 100).toFixed(1)}%
                            {readiness.blendedScaledScore != null ? ` · Blend ~${readiness.blendedScaledScore}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-indigo-600/80 dark:text-indigo-400/80 group-hover:underline">
                          Add ITE →
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3.5 text-center whitespace-nowrap">{zoneLabelBadge(readiness.zone)}</td>

                    <td className="px-3 py-3.5 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors inline-block" />
                    </td>
                  </tr>
                );
              })}

              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                    No residents match the selected readiness filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
