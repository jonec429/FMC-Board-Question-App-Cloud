'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Sliders, Shuffle, XCircle, CheckCircle, Database, Loader2, AlertTriangle, Clock } from './AppIcons';
import {
  RECENT_ITE_YEAR_WINDOW,
  LEGACY_WARNING_TITLE,
  LEGACY_WARNING_BODY,
  partitionYears,
} from '@/lib/questionFilters';

interface CustomBuilderScreenProps {
  user: any;
  onStart: (config: { years: string[]; categories: string[]; count: number; pool: 'all' | 'unused' | 'incorrect'; timerEnabled: boolean }) => void;
  onCancel: () => void;
}

export default function CustomBuilderScreen({ user, onStart, onCancel }: CustomBuilderScreenProps) {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Data for live capacity calculation
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [userAttempts, setUserAttempts] = useState<any[]>([]);

  const [mode, setMode] = useState<'random' | 'custom'>('custom');
  const [pool, setPool] = useState<'all' | 'unused' | 'incorrect'>('all');
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
          const { data: qData } = await supabase
            .from('questions')
            .select('id, category, year')
            .neq('category', 'Demo')
            .neq('year', 'Demo');
            
          if (qData) {
            const yearSet = Array.from(new Set(qData.map((q: any) => q.year))).filter(Boolean).sort().reverse() as string[];
            const catSet = Array.from(new Set(qData.map((q: any) => q.category))).filter(Boolean).sort() as string[];
            setYears(yearSet);
            setCategories(catSet);
            setAllQuestions(qData);
          }

          // Fetch user attempts to compute unused/incorrect
          if (user?.id) {
            const { data: aData } = await supabase
              .from('question_attempts')
              .select('question_id, is_correct')
              .eq('user_id', user.id);
            if (aData) {
              setUserAttempts(aData);
            }
          }

          // Fetch user results for weakest topics
          const { data: rData } = await supabase.from('results').select('category_stats').eq('user_id', user?.id);
          if (rData && rData.length > 0) {
            const statsMap = new Map<string, { correct: number, total: number }>();
            rData.forEach(r => {
              if (r.category_stats) {
                Object.entries(r.category_stats).forEach(([cat, st]: any) => {
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
    onStart({
      // Mixed Review always uses the recent-N window (residents who want older content
      // must switch to Custom and explicitly opt in via the legacy toggle below).
      years: mode === 'random' ? recentYears : selectedYears,
      categories: mode === 'random' ? [] : selectedCategories,
      count: qCount,
      pool: pool,
      timerEnabled: false,
    });
  };

  const availableCount = useMemo(() => {
    let qList = allQuestions;

    // 1. Filter by Pool
    if (pool === 'unused') {
      const attemptedIds = new Set(userAttempts.map(a => a.question_id));
      qList = qList.filter(q => !attemptedIds.has(q.id));
    } else if (pool === 'incorrect') {
      // Find questions where the most recent attempt (or any attempt in this logic) was incorrect
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
        qList = qList.filter(q => cSet.has(q.category));
      } else {
        return 0;
      }
    } else {
      // Random Mode uses recentYears
      const ySet = new Set(recentYears);
      qList = qList.filter(q => ySet.has(q.year));
    }

    return qList.length;
  }, [allQuestions, userAttempts, pool, mode, selectedYears, selectedCategories, recentYears]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-stretch sm:items-center justify-center sm:p-6 font-sans text-slate-800">
      <div className="bg-white w-full max-h-[100dvh] shadow-2xl border border-slate-200 flex flex-col rounded-none sm:rounded-3xl sm:max-w-3xl min-h-[600px]">
        <div className="p-6 sm:p-8 flex flex-col flex-1 min-h-0 animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-600" /> Create Custom Block
            </h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600" title="Close">
              <XCircle className="w-8 h-8" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
          ) : allQuestions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p>Master Question Bank is empty.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-4">
              {/* Mode Toggle */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">1. Quiz Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('random')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-2 ${mode === 'random' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
                  >
                    <Shuffle className="w-6 h-6" />
                    Quick Mixed Review
                    <span className={`text-[10px] font-normal ${mode === 'random' ? 'text-blue-100' : 'text-slate-400'}`}>Pull from all topics &amp; years</span>
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-2 ${mode === 'custom' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                  >
                    <Sliders className="w-6 h-6" />
                    Custom Filters
                    <span className={`text-[10px] font-normal ${mode === 'custom' ? 'text-indigo-100' : 'text-slate-400'}`}>Pick specific topics &amp; years</span>
                  </button>
                </div>
              </div>

              {/* Question Bank Selection */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">2. Question Bank</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['all', 'unused', 'incorrect'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPool(p)}
                      className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all text-center capitalize ${pool === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                    >
                      {p} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Selection */}
              {mode === 'custom' && (
                <div className={`bg-white p-5 rounded-2xl shadow-sm border ${showErrors && selectedYears.length === 0 ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      3. Select ITE Year(s) <span className="text-red-500">*</span>
                    </label>
                    <button onClick={handleSelectAllYears} className="text-xs font-bold text-indigo-600 hover:underline">
                      {visibleYears.every(y => selectedYears.includes(y)) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Recent (default) */}
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
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
                        <div className={`px-4 py-2 border-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${selectedYears.includes(y) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 group-hover:border-indigo-300'}`}>
                          {selectedYears.includes(y) && <CheckCircle className="w-4 h-4 text-white" />}
                          <span>{y}</span>
                        </div>
                      </label>
                    ))}
                    {recentYears.length === 0 && <span className="text-sm text-slate-400 italic">No recent years found.</span>}
                  </div>

                  {/* Legacy reveal toggle */}
                  {legacyYears.length > 0 && (
                    <button
                      type="button"
                      onClick={requestShowLegacyYears}
                      className={`mt-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${showLegacyYears ? 'text-slate-500 hover:text-slate-700' : 'text-amber-600 hover:text-amber-700'}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {showLegacyYears
                        ? `Hide ${legacyYears.length} older year${legacyYears.length !== 1 ? 's' : ''}`
                        : `Show ${legacyYears.length} older year${legacyYears.length !== 1 ? 's' : ''} (more than 3 years old)`}
                    </button>
                  )}

                  {/* Legacy (after opt-in) */}
                  {showLegacyYears && legacyYears.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
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
                            <div className={`px-4 py-2 border-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${selectedYears.includes(y) ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-200 text-amber-700 bg-amber-50/40 group-hover:border-amber-400'}`}>
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
                <div className={`bg-white p-5 rounded-2xl shadow-sm border ${showErrors && selectedCategories.length === 0 ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
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
                      <button onClick={handleSelectAllCats} className="text-xs font-bold text-indigo-600 hover:underline">
                        {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {categories.map(c => (
                      <label key={c} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(c)}
                          onChange={() => toggleCategory(c)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700 truncate">{c}</span>
                      </label>
                    ))}
                    {categories.length === 0 && <span className="text-sm text-slate-400 italic">No categories found.</span>}
                  </div>
                  {showErrors && selectedCategories.length === 0 && (
                    <p className="text-xs text-red-500 font-bold mt-2">Please select at least one topic.</p>
                  )}
                </div>
              )}

              {/* Count */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  {mode === 'custom' ? '5' : '3'}. Number of Questions{' '}
                  <span className="text-slate-400 font-normal normal-case">(5-100)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={qCountInput}
                    onChange={e => handleQCountChange(e.target.value)}
                    onBlur={handleQCountBlur}
                    className="w-28 p-3 text-2xl font-black text-indigo-600 text-center border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-sm text-slate-500">
                    questions will be selected randomly from your chosen filters.
                  </span>
                </div>
              </div>



            </div>
          )}

          {/* Generate Button */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {!loading && allQuestions.length > 0 && (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-bold text-slate-500">Live Capacity:</span>
                <span className={`text-sm font-black ${availableCount >= qCount ? 'text-emerald-600' : 'text-red-500'}`}>
                  {availableCount} matching {availableCount === 1 ? 'question' : 'questions'}
                </span>
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={loading || allQuestions.length === 0 || availableCount < qCount}
              className={`w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all text-lg disabled:opacity-50 flex items-center justify-center gap-2 ${mode === 'random' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {mode === 'random' ? (
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
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">{LEGACY_WARNING_TITLE}</h3>
              </div>
            </div>
            <div className="p-6 text-sm font-medium text-slate-600 leading-relaxed">
              {LEGACY_WARNING_BODY}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowLegacyWarning(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmShowLegacyYears}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
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
