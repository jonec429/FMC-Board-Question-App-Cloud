'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  OFFICIAL_ABFM_PREDICTOR_URL,
  ABFM_PASSING_SCALED_SCORE,
  ITE_SCALED_SEM,
  MIN_BLOCKS_FOR_READINESS,
  MIN_QUESTIONS_FOR_READINESS,
  NATIONAL_PGY_MEANS,
  LicensingExamType,
  SavedResidentExamScores,
  runAbfmBayesianModel,
  computeExperimentalReadiness,
  loadResidentExamScores,
  saveResidentExamScores,
} from '@/lib/iteScoring';
import {
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Info,
  ExternalLink,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';

interface BoardReadinessToolProps {
  residentKey: string; // email or userId for local storage key
  residentName?: string;
  pgyLevel?: 1 | 2 | 3;
  blocksCompleted: number;
  totalQuestionsAnswered: number;
  curriculumAvgPct: number;
  isFacultyView?: boolean;
  compact?: boolean;
}

export default function BoardReadinessTool({
  residentKey,
  residentName,
  pgyLevel = 2,
  blocksCompleted,
  totalQuestionsAnswered,
  curriculumAvgPct,
  isFacultyView = false,
  compact = false,
}: BoardReadinessToolProps) {
  const [scores, setScores] = useState<SavedResidentExamScores>({
    examType: 'USMLE',
    step2Score: null,
    comlex2Score: null,
    pgy1Ite: null,
    pgy2Ite: null,
    pgy3Ite: null,
  });

  const [pgy1Input, setPgy1Input] = useState<string>('');
  const [pgy2Input, setPgy2Input] = useState<string>('');
  const [pgy3Input, setPgy3Input] = useState<string>('');
  const [licensingInput, setLicensingInput] = useState<string>('');
  const [showFullDisclaimer, setShowFullDisclaimer] = useState<boolean>(false);
  const [selectedDistNode, setSelectedDistNode] = useState<'pgy1' | 'pgy2' | 'pgy3' | 'certExam'>('certExam');
  const [savedToast, setSavedToast] = useState<boolean>(false);

  useEffect(() => {
    const loaded = loadResidentExamScores(residentKey);
    setScores(loaded);
    setPgy1Input(loaded.pgy1Ite != null ? String(loaded.pgy1Ite) : '');
    setPgy2Input(loaded.pgy2Ite != null ? String(loaded.pgy2Ite) : '');
    setPgy3Input(loaded.pgy3Ite != null ? String(loaded.pgy3Ite) : '');
    const lic = loaded.examType === 'COMLEX' ? loaded.comlex2Score : loaded.step2Score;
    setLicensingInput(lic != null ? String(lic) : '');
  }, [residentKey]);

  const parseScoreInput = (val: string, min: number, max: number): number | null => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
    if (isNaN(n)) return null;
    return Math.max(min, Math.min(max, n));
  };

  const handleSaveScores = (nextExamType?: LicensingExamType) => {
    const activeType = nextExamType || scores.examType;
    const p1 = parseScoreInput(pgy1Input, 200, 800);
    const p2 = parseScoreInput(pgy2Input, 200, 800);
    const p3 = parseScoreInput(pgy3Input, 200, 800);
    const lic =
      activeType === 'COMLEX'
        ? parseScoreInput(licensingInput, 300, 800)
        : parseScoreInput(licensingInput, 190, 300);

    const updated: SavedResidentExamScores = {
      examType: activeType,
      step2Score: activeType === 'USMLE' ? lic : scores.step2Score,
      comlex2Score: activeType === 'COMLEX' ? lic : scores.comlex2Score,
      pgy1Ite: p1,
      pgy2Ite: p2,
      pgy3Ite: p3,
    };
    setScores(updated);
    saveResidentExamScores(residentKey, updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleClearScores = () => {
    const cleared: SavedResidentExamScores = {
      examType: scores.examType,
      step2Score: null,
      comlex2Score: null,
      pgy1Ite: null,
      pgy2Ite: null,
      pgy3Ite: null,
    };
    setPgy1Input('');
    setPgy2Input('');
    setPgy3Input('');
    setLicensingInput('');
    setScores(cleared);
    saveResidentExamScores(residentKey, cleared);
  };

  // Run the exact ABFM Bayesian Markov Model on entered official ITE scores
  const bayesianOutput = useMemo(() => {
    return runAbfmBayesianModel({
      examType: scores.examType,
      pgy1Score: scores.pgy1Ite,
      pgy2Score: scores.pgy2Ite,
      pgy3Score: scores.pgy3Ite,
    });
  }, [scores]);

  // Run the Experimental Curriculum Readiness Model (Beta)
  const experimentalReadiness = useMemo(() => {
    return computeExperimentalReadiness({
      blocksCompleted,
      totalQuestionsAnswered,
      rawAccuracyPct: curriculumAvgPct,
      pgyLevel,
      bayesianBaseline: bayesianOutput,
    });
  }, [blocksCompleted, totalQuestionsAnswered, curriculumAvgPct, pgyLevel, bayesianOutput]);

  // Helper to position a score on the 200..700 visual scale bar
  const scaleToPct = (score: number) => {
    const clamped = Math.max(220, Math.min(680, score));
    return ((clamped - 220) / (680 - 220)) * 100;
  };

  const activeDistribution = bayesianOutput[selectedDistNode];
  // Display bins from low to high (250 -> 600+) for intuitive left-to-right chart reading
  const orderedBins = useMemo(() => {
    return [...activeDistribution.states].reverse();
  }, [activeDistribution]);
  const maxBinProb = useMemo(() => {
    return Math.max(0.06, ...orderedBins.map((b) => b.prob));
  }, [orderedBins]);

  return (
    <div className="space-y-5 print:space-y-4">
      {/* 1. Mandatory Persistent Beta Disclaimer Banner */}
      <div className="bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Board Readiness Tool (Experimental Beta)
                </h3>
                <span className="bg-amber-200/90 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Beta Model • Study Guidance Only
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
                <strong>Not a Score Prediction or Pass Guarantee:</strong> This experimental beta tool estimates
                study readiness ranges from curriculum practice blocks and models official ITE trajectories. Untimed,
                open-book practice percentages typically run higher than proctored exam-day performance and{' '}
                <strong className="underline">do not guarantee</strong> passage of the ABFM In-Training Exam (ITE) or{' '}
                <strong>ABFM Certification Exam</strong>.
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
            onClick={() => setShowFullDisclaimer((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline"
          >
            {showFullDisclaimer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showFullDisclaimer ? 'Hide Methodology & Limitations' : 'Read Full Methodology, SEM Margin of Error & Limitations'}</span>
          </button>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Minimum Passing Standard: <strong>380 Scaled (~60% Conservative Target)</strong> • ITE SEM: <strong>±38 Points</strong>
          </span>
        </div>

        {showFullDisclaimer && (
          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200/90 space-y-2 leading-relaxed">
            <p>
              <strong>1. Practice vs. Proctored Conditions:</strong> Curriculum blocks and custom quizzes are untimed
              learning tools. Looking up references, repeating familiar topics, and absence of 4-hour test-day fatigue
              mean app percentages can overestimate proctored ITE and ABFM Certification Exam scores.
            </p>
            <p>
              <strong>2. Why 60%–65% Is Borderline (±38 Point SEM):</strong> On the 2023–2025 ABFM Score Results
              Handbooks, the 380 minimum passing standard corresponded to 54.9%–61.1% raw accuracy, with a Standard
              Error of Measurement (SEM) of <strong>±38 scaled points (~5% raw)</strong>. A resident averaging 60%–65%
              is within 1 SEM of a non-passing score on exam day.
            </p>
            <p>
              <strong>3. Crucial Caveat on Bayesian Pass Probabilities:</strong> The official ABFM Bayesian model
              assumes residents will gain <strong>+40 to +60 scaled points per year</strong> through continuous residency
              training and study. A high projected probability in PGY-1 or PGY-2 does <em>not</em> mean a current score
              below 380 would pass today—it reflects historical peers who studied continuously until graduation.
            </p>
          </div>
        )}
      </div>

      {/* 2. Two-Column Split: Track A (Experimental App Readiness) & Track B (Official ITE Reference) */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-5`}>
        {/* PANEL A: EXPERIMENTAL CURRICULUM READINESS MODEL (BETA) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Track 1 • App Curriculum Performance
                </span>
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Experimental Readiness Range (Beta)
                </h4>
              </div>
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                Beta Model
              </span>
            </div>

            {!experimentalReadiness.isUnlocked ? (
              /* Locked State: < 3 blocks and < 120 questions */
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 my-2">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
                      Building Baseline ({blocksCompleted} / {MIN_BLOCKS_FOR_READINESS} Blocks Completed)
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                      To prevent small-sample noise from causing false confidence or unnecessary alarm, experimental
                      readiness ranges require at least <strong>{MIN_BLOCKS_FOR_READINESS} completed blocks</strong> (or{' '}
                      <strong>{MIN_QUESTIONS_FOR_READINESS} questions</strong> — 60% of a full ITE).
                    </p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          <span>Curriculum Blocks</span>
                          <span>
                            {blocksCompleted} / {MIN_BLOCKS_FOR_READINESS}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.round((blocksCompleted / MIN_BLOCKS_FOR_READINESS) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          <span>Total Questions Answered</span>
                          <span>
                            {totalQuestionsAnswered} / {MIN_QUESTIONS_FOR_READINESS}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((totalQuestionsAnswered / MIN_QUESTIONS_FOR_READINESS) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Unlocked State: >= 3 blocks or >= 120 questions */
              <div className="space-y-4">
                {/* Readiness Zone Pill + Raw Accuracy */}
                <div
                  className={`rounded-2xl p-4 border ${
                    experimentalReadiness.zone === 'on_track'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                      : experimentalReadiness.zone === 'borderline'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
                      : 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {experimentalReadiness.zone === 'on_track' ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : experimentalReadiness.zone === 'borderline' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                      <span
                        className={`text-sm font-black ${
                          experimentalReadiness.zone === 'on_track'
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : experimentalReadiness.zone === 'borderline'
                            ? 'text-amber-900 dark:text-amber-200'
                            : 'text-red-900 dark:text-red-200'
                        }`}
                      >
                        {experimentalReadiness.zoneLabel}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                      {Math.round(curriculumAvgPct)}% Avg ({blocksCompleted} Blocks • {totalQuestionsAnswered} Qs)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {experimentalReadiness.zoneDescription}
                  </p>
                </div>

                {/* Estimated Scaled Score Range (±1 SEM Band, Never a Single Point) */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Implied ITE Readiness Band (±{ITE_SCALED_SEM} SEM)
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                        {experimentalReadiness.practiceBandLow} – {experimentalReadiness.practiceBandHigh}
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
                          (Midpoint ~{experimentalReadiness.practiceImpliedScaledScore})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Passing Standard
                      </span>
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">380 Scaled</span>
                    </div>
                  </div>

                  {/* Visual Scale Bar (220 to 680) */}
                  <div className="relative h-7 bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden mt-3 mb-5">
                    {/* Below 380 Red/Amber zone shading */}
                    <div
                      className="absolute inset-y-0 left-0 bg-red-200/60 dark:bg-red-950/50 border-r-2 border-red-500/80"
                      style={{ width: `${scaleToPct(ABFM_PASSING_SCALED_SCORE)}%` }}
                    />
                    {/* Resident ±1 SEM Band */}
                    <div
                      className={`absolute inset-y-1.5 rounded-lg shadow-sm transition-all ${
                        experimentalReadiness.practiceBandLow < ABFM_PASSING_SCALED_SCORE
                          ? 'bg-amber-500/85 dark:bg-amber-400/85'
                          : 'bg-emerald-500/85 dark:bg-emerald-400/85'
                      }`}
                      style={{
                        left: `${scaleToPct(experimentalReadiness.practiceBandLow)}%`,
                        width: `${Math.max(
                          4,
                          scaleToPct(experimentalReadiness.practiceBandHigh) -
                            scaleToPct(experimentalReadiness.practiceBandLow)
                        )}%`,
                      }}
                    />
                    {/* Midpoint tick */}
                    <div
                      className="absolute inset-y-0 w-1 bg-slate-900 dark:bg-white"
                      style={{ left: `${scaleToPct(experimentalReadiness.practiceImpliedScaledScore)}%` }}
                    />
                    {/* PGY Peer Mean marker */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-indigo-600 dark:bg-indigo-400"
                      style={{ left: `${scaleToPct(NATIONAL_PGY_MEANS[pgyLevel].mean)}%` }}
                      title={NATIONAL_PGY_MEANS[pgyLevel].label}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 -mt-3">
                    <span>250</span>
                    <span className="text-red-600 dark:text-red-400 font-black">380 Min Pass</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      PGY-{pgyLevel} Avg ({NATIONAL_PGY_MEANS[pgyLevel].mean})
                    </span>
                    <span>650+</span>
                  </div>

                  {experimentalReadiness.practiceBandLow < ABFM_PASSING_SCALED_SCORE && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold mt-2.5 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Notice: The lower end of this ±{ITE_SCALED_SEM} SEM margin ({experimentalReadiness.practiceBandLow}) extends below the 380 passing line. Aim for &gt;65% to build a full 1-SEM cushion.
                      </span>
                    </p>
                  )}
                </div>

                {/* Blended Comparison with Official ITE (if entered) */}
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                      Combined ITE + Practice Beta Blend
                    </span>
                    {experimentalReadiness.blendedBandLow != null && experimentalReadiness.blendedBandHigh != null && (
                      <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-700">
                        {experimentalReadiness.blendedBandLow} – {experimentalReadiness.blendedBandHigh} (Mid ~
                        {experimentalReadiness.blendedScaledScore})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {experimentalReadiness.trajectoryNote}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Cutoffs: &lt;60% At Risk • 60–65% Borderline • &gt;65% On Track</span>
            <span className="font-semibold">Unified 2023–2025 Curve</span>
          </div>
        </div>

        {/* PANEL B: OFFICIAL ITE BASELINE & ABFM BAYESIAN REFERENCE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Track 2 • Proctored Exam Baseline
                </span>
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Official ITE &amp; ABFM Bayesian Reference
                </h4>
              </div>

              {/* USMLE / COMLEX Cohort Selector */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                {(['USMLE', 'COMLEX'] as LicensingExamType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSaveScores(type)}
                    className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-colors ${
                      scores.examType === type
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Score Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {scores.examType === 'COMLEX' ? 'COMLEX L2' : 'USMLE Step 2'}
                </label>
                <input
                  type="number"
                  min={scores.examType === 'COMLEX' ? 300 : 190}
                  max={scores.examType === 'COMLEX' ? 800 : 300}
                  placeholder={scores.examType === 'COMLEX' ? 'e.g. 500' : 'e.g. 240'}
                  value={licensingInput}
                  onChange={(e) => setLicensingInput(e.target.value)}
                  onBlur={() => handleSaveScores()}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  PGY-1 ITE
                </label>
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  placeholder="200–800"
                  value={pgy1Input}
                  onChange={(e) => setPgy1Input(e.target.value)}
                  onBlur={() => handleSaveScores()}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  PGY-2 ITE
                </label>
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  placeholder="200–800"
                  value={pgy2Input}
                  onChange={(e) => setPgy2Input(e.target.value)}
                  onBlur={() => handleSaveScores()}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  PGY-3 ITE
                </label>
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  placeholder="200–800"
                  value={pgy3Input}
                  onChange={(e) => setPgy3Input(e.target.value)}
                  onBlur={() => handleSaveScores()}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {bayesianOutput.mostRecentObservedStage === 'none'
                  ? `Showing unconditioned ${scores.examType} national cohort prior. Enter an official ITE score above.`
                  : `Conditioned on ${bayesianOutput.mostRecentObservedStage} ITE = ${bayesianOutput.mostRecentObservedScore} (most recent ITE drives Markov chain).`}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {savedToast && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3 h-3" /> Saved locally
                  </span>
                )}
                {bayesianOutput.mostRecentObservedStage !== 'none' && (
                  <button
                    type="button"
                    onClick={handleClearScores}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* 4-Stage Markov Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {(
                [
                  { key: 'pgy1', node: bayesianOutput.pgy1 },
                  { key: 'pgy2', node: bayesianOutput.pgy2 },
                  { key: 'pgy3', node: bayesianOutput.pgy3 },
                  { key: 'certExam', node: bayesianOutput.certExam },
                ] as const
              ).map(({ key, node }) => {
                const isSelected = selectedDistNode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDistNode(key)}
                    className={`text-left p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-75 truncate">
                        {key === 'certExam' ? 'ABFM Cert' : node.displayName}
                      </span>
                      {node.isObserved && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 dark:text-emerald-600">
                          Actual
                        </span>
                      )}
                    </div>
                    <div className="text-base font-black mt-0.5">
                      {node.isObserved ? node.observedBinTitle : `~${node.expectedMean}`}
                    </div>
                    <div className="text-[10px] font-semibold opacity-75">
                      Range: {node.semLow}–{node.semHigh}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Distribution Histogram (Matching ABFM Bayesian Predictor Bins) */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {activeDistribution.displayName} Score Distribution
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                    (Mean {activeDistribution.expectedMean} ± {activeDistribution.expectedSd} SD)
                  </span>
                </div>
                {bayesianOutput.mostRecentObservedStage !== 'none' && (
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    ABFM Cert Exam ≥380 Prob:{' '}
                    <span
                      className={
                        bayesianOutput.certificationPassProbability >= 0.9
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : bayesianOutput.certificationPassProbability >= 0.8
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {(bayesianOutput.certificationPassProbability * 100).toFixed(1)}%
                    </span>
                  </span>
                )}
              </div>

              {/* Histogram Bars */}
              <div className="h-24 flex items-end gap-[2px] pt-2 pb-1 px-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                {orderedBins.map((bin) => {
                  const heightPct = Math.max(2, Math.round((bin.prob / maxBinProb) * 100));
                  const isPassingBin = bin.lowerBound >= ABFM_PASSING_SCALED_SCORE;
                  return (
                    <div
                      key={bin.name}
                      className="flex-1 h-full flex flex-col justify-end group relative"
                      title={`${bin.title}: ${(bin.prob * 100).toFixed(2)}%`}
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          isPassingBin
                            ? 'bg-emerald-500/85 group-hover:bg-emerald-600'
                            : 'bg-amber-500/80 group-hover:bg-amber-600'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-1 px-1">
                <span>&lt;250</span>
                <span className="text-amber-600 dark:text-amber-400">380 Pass Cutoff</span>
                <span>500</span>
                <span>{selectedDistNode === 'certExam' ? '&gt;600' : '&gt;640'}</span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
                <strong>Growth Assumption Note:</strong> ABFM Bayesian probabilities assume typical national score
                growth (+40–60 pts/yr) through graduation. Always verify official proctored ITE projections on{' '}
                <a
                  href={OFFICIAL_ABFM_PREDICTOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 font-bold underline"
                >
                  theabfm.org/bayesian-score-predictor
                </a>
                .
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Privacy: Entered ITE scores are saved locally on this device only.</span>
            <a
              href={OFFICIAL_ABFM_PREDICTOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <span>ABFM Website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
