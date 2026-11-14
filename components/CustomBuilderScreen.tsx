'use client';

import { REMOVED_BY_ABFM_IDS } from '@/lib/iteRemovedQuestions';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Sliders, Shuffle, XCircle, CheckCircle, Database, Loader2, AlertTriangle, Clock, Flag } from './AppIcons';
import { Award, Trophy, Coffee, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import {
  RECENT_ITE_YEAR_WINDOW,
  LEGACY_WARNING_TITLE,
  LEGACY_WARNING_BODY,
  partitionYears,
} from '@/lib/questionFilters';
import { User, Question, QuestionAttempt } from '@/lib/types';
import { fetchAllPages } from '@/lib/supabasePagination';

interface CustomBuilderScreenProps {
  user: User;
  onStart: (config: {
    years: string[];
    categories: string[];
    count: number;
    pool: 'all' | 'unused' | 'incorrect' | 'flagged';
    timerEnabled: boolean;
    isMockExam?: boolean;
    mockExamType?: 'abfm' | 'ite';
    sectionsCount?: number;
    questionsPerSection?: number;
    timePerSectionMinutes?: number;
    pooledBreakMinutes?: number;
    topic?: string;
  }) => void;
  onCancel: () => void;
}

export default function CustomBuilderScreen({ user, onStart, onCancel }: CustomBuilderScreenProps) {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Data for live capacity calculation
  const [allQuestions, setAllQuestions] = useState<Pick<Question, 'id' | 'year' | 'category' | 'secondary_system'>[]>([]);
  const [userAttempts, setUserAttempts] = useState<Pick<QuestionAttempt, 'question_id' | 'is_correct'>[]>([]);

  const [mode, setMode] = useState<'random' | 'custom' | 'mock_exam'>('custom');
  const [mockExamPreset, setMockExamPreset] = useState<'abfm' | 'ite'>('abfm');
  const [iteSourceYear, setIteSourceYear] = useState<string>('2025');
  const [pool, setPool] = useState<'all' | 'unused' | 'incorrect' | 'flagged'>('all');
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [weakestCategories, setWeakestCategories] = useState<string[]>([]);
  const [qCount, setQCount] = useState(40);
  const [qCountInput, setQCountInput] = useState('40');
  const [showErrors, setShowErrors] = useState(false);
  // Legacy year reveal — residents must explicitly opt-in to ITEs > 3 years old
  const [showLegacyYears, setShowLegacyYears] = useState(false);
  const [showLegacyWarning, setShowLegacyWarning] = useState(false);

  // Split the available years into recent (default visible) and legacy (opt-in) buckets
  const { recent: recentYears, legacy: legacyYears } = useMemo(
    () => partitionYears(years, RECENT_ITE_YEAR_WINDOW),
    [years]
  );

  useEffect(() => {
    async function fetchFilters() {
      setLoading(true);
      try {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Request timed out while loading questions.')), 10000);
        });

        const fetchTask = async () => {
          const qData = await fetchAllPages<Pick<Question, 'id' | 'category' | 'secondary_system' | 'year'>>((from, to) =>
            supabase
              .from('questions')
              .select('id, category, secondary_system, year')
              .neq('category', 'Demo')
              .neq('year', 'Demo')
              .order('id', { ascending: true })
              .range(from, to)
          );

          if (qData) {
            const yearSet = Array.from(new Set(qData.map(q => q.year))).filter((y): y is string => Boolean(y)).sort().reverse();
            const catSet = Array.from(new Set(qData.map(q => q.category))).filter((c): c is string => Boolean(c)).sort();
            setYears(yearSet);
            setCategories(catSet);
            setAllQuestions(qData);
          }

          // Fetch user attempts to compute unused/incorrect (paginated)
          if (user?.id) {
            const aData = await fetchAllPages<{ question_id: string; is_correct: boolean }>((from, to) =>
              supabase
                .from('question_attempts')
                .select('question_id, is_correct')
                .eq('user_id', user.id)
                .order('id', { ascending: true })
                .range(from, to)
            );
            if (aData) {
              setUserAttempts(aData);
            }
          }

          // Fetch user results for weakest topics (paginated)
          const rData = await fetchAllPages<{ category_stats: any }>((from, to) =>
            supabase
              .from('results')
              .select('category_stats')
              .eq('user_id', user?.id)
              .order('id', { ascending: true })
              .range(from, to)
          );
          if (rData && rData.length > 0) {
            const statsMap = new Map<string, { correct: number, total: number }>();
            rData.forEach(r => {
              if (r.category_stats) {
                Object.entries(r.category_stats as Record<string, { correct: number; total: number }>).forEach(([cat, st]) => {
                  const cur = statsMap.get(cat) || { correct: 0, total: 0 };
                  statsMap.set(cat, { correct: cur.correct + st.correct, total: cur.total + st.total });
                });
              }
            });
            const catPcts = Array.from(statsMap.entries()).map(([cat, st]) => ({ cat, pct: st.correct / st.total }));
            catPcts.sort((a, b) => a.pct - b.pct);
            setWeakestCategories(catPcts.slice(0, 3).map(x => x.cat));
          }
        };

        await Promise.race([fetchTask(), timeoutPromise]);
        clearTimeout(timeoutId!);

      } catch (err) {
        console.error('Filter fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFilters();
  }, [user?.id]);

  const toggleYear = (y: string) => setSelectedYears(p => p.includes(y) ? p.filter(i => i !== y) : [...p, y]);
  const toggleCategory = (c: string) => setSelectedCategories(p => p.includes(c) ? p.filter(i => i !== c) : [...p, c]);

  // "Select All" applies to whatever year set is currently visible (recent only,
  // or recent + legacy after user opts in)
  const visibleYears = showLegacyYears ? years : recentYears;
  const handleSelectAllYears = () => {
    if (visibleYears.every(y => selectedYears.includes(y))) {
      // All visible selected → deselect them
      setSelectedYears(prev => prev.filter(y => !visibleYears.includes(y)));
    } else {
      // Add any visible years not yet selected
      setSelectedYears(prev => Array.from(new Set([...prev, ...visibleYears])));
    }
  };

  const requestShowLegacyYears = () => {
    if (showLegacyYears) {
      // Already revealed — hiding requires no warning, but drop any selected legacy years for safety
      setShowLegacyYears(false);
      setSelectedYears(prev => prev.filter(y => !legacyYears.includes(y)));
    } else {
      setShowLegacyWarning(true);
    }
  };

  const confirmShowLegacyYears = () => {
    setShowLegacyYears(true);
    setShowLegacyWarning(false);
  };

  const handleSelectAllCats = () => {
    if (selectedCategories.length === categories.length) setSelectedCategories([]);
    else setSelectedCategories([...categories]);
  };

  const handleQCountChange = (val: string) => {
    setQCountInput(val);
    const n = parseInt(val);
    if (!isNaN(n)) setQCount(Math.min(100, Math.max(5, n)));
  };

  const handleQCountBlur = () => {
    const n = parseInt(qCountInput);
    const clamped = isNaN(n) ? 40 : Math.min(100, Math.max(5, n));
    setQCount(clamped);
    setQCountInput(String(clamped));
  };

  const handleGenerate = () => {
    if (mode === 'custom') {
      if (selectedYears.length === 0 || selectedCategories.length === 0) {
        setShowErrors(true);
        return;
      }
    }
    setShowErrors(false);

    if (mode === 'mock_exam') {
      const isAbfm = mockExamPreset === 'abfm';
      onStart({
        years: isAbfm ? recentYears : (iteSourceYear === 'unused' ? recentYears : [iteSourceYear]),
        categories: [],
        count: isAbfm ? 300 : 200,
        pool: isAbfm ? 'all' : (iteSourceYear === 'unused' ? 'unused' : 'all'),
        timerEnabled: true,
        isMockExam: true,
        mockExamType: mockExamPreset,
        sectionsCount: 4,
        questionsPerSection: isAbfm ? 75 : 50,
        timePerSectionMinutes: isAbfm ? 95 : 63,
        pooledBreakMinutes: isAbfm ? 100 : 45,
        topic: isAbfm ? 'ABFM Board Exam Simulation' : `ITE ${iteSourceYear === 'unused' ? 'Mix' : iteSourceYear} Mock Exam`,
      });
      return;
    }

    onStart({
      years: mode === 'random' ? recentYears : selectedYears,
      categories: mode === 'random' ? [] : selectedCategories,
      count: qCount,
      pool: pool,
      timerEnabled: false,
    });
  };

  const availableCount = useMemo(() => {
    if (mode === 'mock_exam') {
      if (mockExamPreset === 'abfm') {
        return allQuestions.filter(q => !REMOVED_BY_ABFM_IDS.has(q.id)).length;
      } else {
        if (iteSourceYear === 'unused') {
          const attemptedIds = new Set(userAttempts.map(a => a.question_id));
          return allQuestions.filter(q => !attemptedIds.has(q.id)).length;
        }
        return allQuestions.filter(q => q.year === iteSourceYear).length;
      }
    }

    let qList = allQuestions.filter(q => !REMOVED_BY_ABFM_IDS.has(q.id));

    // 1. Filter by Pool
    if (pool === 'unused') {
      const attemptedIds = new Set(userAttempts.map(a => a.question_id));
      qList = qList.filter(q => !attemptedIds.has(q.id));
    } else if (pool === 'incorrect') {
      const incorrectIds = new Set(userAttempts.filter(a => !a.is_correct).map(a => a.question_id));
      qList = qList.filter(q => incorrectIds.has(q.id));
    }

    // 2. Filter by Years and Categories (Only if mode is custom)
    if (mode === 'custom') {
      if (selectedYears.length > 0) {
        const ySet = new Set(selectedYears);
        qList = qList.filter(q => ySet.has(q.year));
      } else {
        return 0;
      }
      
      if (selectedCategories.length > 0) {
        const cSet = new Set(selectedCategories);
        qList = qList.filter(q => (q.category && cSet.has(q.category)) || (q.secondary_system && cSet.has(q.secondary_system)));
      } else {
        return 0;
      }
    } else {
      // Random Mode uses recentYears
      const ySet = new Set(recentYears);
      qList = qList.filter(q => ySet.has(q.year));
    }

    return qList.length;
  }, [allQuestions, userAttempts, pool, mode, mockExamPreset, iteSourceYear, selectedYears, selectedCategories, recentYears]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-stretch sm:items-center justify-center sm:p-6 font-sans text-slate-800 dark:text-slate-100 transition-colors">
      <div className="bg-white dark:bg-slate-900 w-full max-h-[100dvh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col rounded-none sm:rounded-3xl sm:max-w-3xl min-h-[600px] transition-colors">
        <div className="p-6 sm:p-8 flex flex-col flex-1 min-h-0 animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Create Custom Block
            </h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Close">
              <XCircle className="w-8 h-8" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
          ) : allQuestions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p>Master Question Bank is empty.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-4">
              {/* Mode Toggle */}
              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">1. Quiz Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setMode('random')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-1.5 ${mode === 'random' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'}`}
                  >
                    <Shuffle className="w-5 h-5" />
                    Quick Mixed
                    <span className={`text-[10px] font-normal ${mode === 'random' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>All topics &amp; years</span>
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-1.5 ${mode === 'custom' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                  >
                    <Sliders className="w-5 h-5" />
                    Custom Filters
                    <span className={`text-[10px] font-normal ${mode === 'custom' ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>Pick topics &amp; count</span>
                  </button>
                  <button
                    onClick={() => setMode('mock_exam')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-1.5 relative overflow-hidden ${mode === 'mock_exam' ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500'}`}
                  >
                    <span className="absolute top-1 right-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200">New</span>
                    <Trophy className="w-5 h-5 text-amber-300" />
                    Mock Exam
                    <span className={`text-[10px] font-normal ${mode === 'mock_exam' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'}`}>ABFM 300Q / ITE 200Q</span>
                  </button>
                </div>
              </div>

              {/* MOCK EXAM SIMULATION CONFIGURATION */}
              {mode === 'mock_exam' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Preset Choice */}
                  <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">2. Choose Simulation Format</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* ABFM Certification Exam */}
                      <button
                        type="button"
                        onClick={() => setMockExamPreset('abfm')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${mockExamPreset === 'abfm' ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500 shadow-md' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-amber-300'}`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-500 text-white">
                              Board Exam
                            </span>
                            <span className="text-xs font-bold text-slate-400">PGY-3 &amp; Graduating</span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white mb-1">ABFM Initial Certification</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Full board exam conditions with 4 sections of 75 questions and shared break time.
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                          <div>
                            <span className="block text-base font-black text-amber-600 dark:text-amber-400">300</span>
                            <span className="text-[10px] text-slate-400 uppercase">Questions</span>
                          </div>
                          <div>
                            <span className="block text-base font-black text-slate-700 dark:text-slate-200">4 × 95m</span>
                            <span className="text-[10px] text-slate-400 uppercase">Sections</span>
                          </div>
                          <div>
                            <span className="block text-base font-black text-emerald-600 dark:text-emerald-400">100m</span>
                            <span className="text-[10px] text-slate-400 uppercase">Pooled Break</span>
                          </div>
                        </div>
                      </button>

                      {/* ITE Exam */}
                      <button
                        type="button"
                        onClick={() => setMockExamPreset('ite')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${mockExamPreset === 'ite' ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500 shadow-md' : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-indigo-600 text-white">
                              In-Training Exam
                            </span>
                            <span className="text-xs font-bold text-slate-400">PGY-1 to PGY-3</span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white mb-1">ABFM In-Training Exam (ITE)</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            October exam simulation with 4 sections of 50 questions and structured break periods.
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                          <div>
                            <span className="block text-base font-black text-indigo-600 dark:text-indigo-400">200</span>
                            <span className="text-[10px] text-slate-400 uppercase">Questions</span>
                          </div>
                          <div>
                            <span className="block text-base font-black text-slate-700 dark:text-slate-200">4 × 63m</span>
                            <span className="text-[10px] text-slate-400 uppercase">Sections</span>
                          </div>
                          <div>
                            <span className="block text-base font-black text-emerald-600 dark:text-emerald-400">45m</span>
                            <span className="text-[10px] text-slate-400 uppercase">Pooled Break</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* If ITE, allow source selection */}
                  {mockExamPreset === 'ite' && (
                    <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">3. Question Source</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: '2025', label: '2025 ITE (Latest)', desc: '200 Questions' },
                          { id: '2024', label: '2024 ITE', desc: '200 Questions' },
                          { id: '2023', label: '2023 ITE', desc: '200 Questions' },
                          { id: 'unused', label: 'Unused Mix', desc: 'Fresh Questions' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setIteSourceYear(opt.id)}
                            className={`p-3 rounded-xl border-2 text-center font-bold text-xs transition-all ${iteSourceYear === opt.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                          >
                            <span className="block">{opt.label}</span>
                            <span className={`text-[10px] font-normal ${iteSourceYear === opt.id ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Official Testing Conditions Card */}
                  <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/60">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          Standard Exam Simulation Rules
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                          <li><strong>4 Timed Sections:</strong> Once you complete and submit a section, it is locked. You cannot return to change answers.</li>
                          <li><strong>Pooled Break Time:</strong> Use your break bank ({mockExamPreset === 'abfm' ? '100' : '45'} minutes) across sections as you choose.</li>
                          <li><strong>Emergency Pause Available:</strong> If an urgent situation arises or your battery is dying, you can use the "Break Glass" Emergency Pause to save your exact clock and resume later.</li>
                          <li><strong>Detailed Score Report:</strong> Full explanations, section-by-section breakdown, and passing benchmarks unlock upon final completion.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {mode !== 'mock_exam' && (<>
              {/* Question Bank Selection */}
              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">2. Question Bank</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['all', 'unused', 'incorrect', 'flagged'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPool(p)}
                      className={`py-3 px-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all text-center capitalize flex items-center justify-center gap-1.5 ${pool === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                    >
                      {p === 'flagged' && <Flag className={`w-3.5 h-3.5 ${pool === 'flagged' ? 'fill-white' : 'text-red-500 fill-current'}`} />}
                      <span>{p} Questions</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Selection */}
              {mode === 'custom' && (
                <div className={`bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border ${showErrors && selectedYears.length === 0 ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      3. Select ITE Year(s) <span className="text-red-500">*</span>
                    </label>
                    <button onClick={handleSelectAllYears} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                      {visibleYears.every(y => selectedYears.includes(y)) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Recent (default) */}
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                    Recent ITEs (last {RECENT_ITE_YEAR_WINDOW} years)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {recentYears.map(y => (
                      <label key={y} className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedYears.includes(y)}
                          onChange={() => toggleYear(y)}
                        />
                        <div className={`px-4 py-2 border-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${selectedYears.includes(y) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 group-hover:border-indigo-300 dark:group-hover:border-indigo-500'}`}>
                          {selectedYears.includes(y) && <CheckCircle className="w-4 h-4 text-white" />}
                          <span>{y}</span>
                        </div>
                      </label>
                    ))}
                    {recentYears.length === 0 && <span className="text-sm text-slate-400 dark:text-slate-500 italic">No recent years found.</span>}
                  </div>

                  {/* Legacy reveal toggle */}
                  {legacyYears.length > 0 && (
                    <button
                      type="button"
                      onClick={requestShowLegacyYears}
                      className={`mt-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${showLegacyYears ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200' : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {showLegacyYears
                        ? `Hide ${legacyYears.length} older year${legacyYears.length !== 1 ? 's' : ''}`
                        : `Show ${legacyYears.length} older year${legacyYears.length !== 1 ? 's' : ''} (more than 3 years old)`}
                    </button>
                  )}

                  {/* Legacy (after opt-in) */}
                  {showLegacyYears && legacyYears.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-amber-200 dark:border-amber-900/50">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                          Legacy ITEs — may not reflect current guidelines
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {legacyYears.map(y => (
                          <label key={y} className="relative cursor-pointer group">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={selectedYears.includes(y)}
                              onChange={() => toggleYear(y)}
                            />
                            <div className={`px-4 py-2 border-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${selectedYears.includes(y) ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20 group-hover:border-amber-400'}`}>
                              {selectedYears.includes(y) && <CheckCircle className="w-4 h-4 text-white" />}
                              <span>{y}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {showErrors && selectedYears.length === 0 && (
                    <p className="text-xs text-red-500 font-bold mt-2">Please select at least one ITE year.</p>
                  )}
                </div>
              )}

              {/* Category Selection */}
              {mode === 'custom' && (
                <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border transition-colors ${showErrors && selectedCategories.length === 0 ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      4. Select Topics <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4 items-center">
                      {weakestCategories.length > 0 && (
                        <button 
                          onClick={() => setSelectedCategories(weakestCategories)}
                          className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
                        >
                          Target Weakest Topics
                        </button>
                      )}
                      <button onClick={handleSelectAllCats} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                        {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {categories.map(c => (
                      <label key={c} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(c)}
                          onChange={() => toggleCategory(c)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{c}</span>
                      </label>
                    ))}
                    {categories.length === 0 && <span className="text-sm text-slate-400 dark:text-slate-500 italic">No categories found.</span>}
                  </div>
                  {showErrors && selectedCategories.length === 0 && (
                    <p className="text-xs text-red-500 font-bold mt-2">Please select at least one topic.</p>
                  )}
                </div>
              )}

              {/* Count */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  {mode === 'custom' ? '5' : '3'}. Number of Questions{' '}
                  <span className="text-slate-400 dark:text-slate-500 font-normal normal-case">(5-100)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={qCountInput}
                    onChange={e => handleQCountChange(e.target.value)}
                    onBlur={handleQCountBlur}
                    className="w-28 p-3 text-2xl font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950 text-center border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    questions will be selected randomly from your chosen filters.
                  </span>
                </div>
              </div>
              </>)}
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            {!loading && allQuestions.length > 0 && (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Live Capacity:</span>
                <span className={`text-sm font-black ${availableCount >= qCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {availableCount} matching {availableCount === 1 ? 'question' : 'questions'}
                </span>
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={loading || allQuestions.length === 0 || (mode !== 'mock_exam' && availableCount < qCount)}
              className={`w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all text-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                mode === 'mock_exam'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 shadow-amber-200 dark:shadow-none'
                  : mode === 'random'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {mode === 'mock_exam' ? (
                <>
                  <Trophy className="w-6 h-6 text-amber-200" />
                  {mockExamPreset === 'abfm' ? 'Launch 300-Question ABFM Board Simulation' : 'Launch 200-Question ITE Mock Exam'}
                </>
              ) : mode === 'random' ? (
                <>
                  <Shuffle className="w-5 h-5" />
                  Generate Mixed Review
                </>
              ) : (
                <>
                  <Sliders className="w-5 h-5" />
                  Generate Custom Block
                </>
              )}
            </button>
            
            {availableCount < qCount && availableCount > 0 && !loading && (
              <p className="text-xs text-red-500 font-bold text-center">
                Only {availableCount} matching questions available. Reduce your requested number or broaden your filters.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Legacy ITE Year Warning Modal */}
      {showLegacyWarning && (
        <div
          onClick={() => setShowLegacyWarning(false)}
          className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{LEGACY_WARNING_TITLE}</h3>
              </div>
            </div>
            <div className="p-6 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              {LEGACY_WARNING_BODY}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setShowLegacyWarning(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmShowLegacyYears}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 dark:shadow-none"
              >
                Yes, show legacy years
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
