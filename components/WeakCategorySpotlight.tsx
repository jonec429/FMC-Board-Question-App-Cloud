'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/types';
import { StartQuizOptions } from './Dashboard';
import {
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  X,
} from 'lucide-react';

interface WeakCategorySpotlightProps {
  myResults: Result[];
  onStartQuiz: (options: StartQuizOptions) => void;
  onOpenBuilder: () => void;
}

interface CategoryPerformance {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
}

/** Icon & color mapping for the 14 ABFM clinical systems */
const SYSTEM_THEMES: Record<string, { icon: string; bg: string; text: string; border: string }> = {
  Cardiovascular: { icon: '🫀', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  Pulmonary: { icon: '🫁', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  Gastrointestinal: { icon: '🩺', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  Neurologic: { icon: '🧠', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  Musculoskeletal: { icon: '🦴', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  Nephrologic: { icon: '💧', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  Endocrine: { icon: '🔬', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  'Infectious Disease': { icon: '🦠', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  'Hematologic/Immune': { icon: '🩸', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  'Skin/Subcutaneous': { icon: '🩹', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  'Psychiatric/Behavioral': { icon: '🧩', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  'Reproductive/Female': { icon: '🌸', bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  'Population Health/Epidemiology': { icon: '📊', bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  'Special Sensory': { icon: '👁️', bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
};

export default function WeakCategorySpotlight({
  myResults,
  onStartQuiz,
  onOpenBuilder,
}: WeakCategorySpotlightProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [bankCount, setBankCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Restore collapsed state preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fmc_weak_spotlight_collapsed');
      if (saved === 'true') setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('fmc_weak_spotlight_collapsed', String(next));
    } catch {}
  };

  // Compute category accuracy across all valid completed quiz blocks
  const { weakest, runnerUp, hasData, totalAttempts } = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    let overallAttempts = 0;

    myResults.forEach((r) => {
      const topicLower = (r.topic || '').toLowerCase();
      // Skip non-academic attendance or manual entries
      if (topicLower.includes('[attendance]') || topicLower.includes('[manual]') || topicLower.includes('demo')) {
        return;
      }

      let stats = r.category_stats;
      if (typeof stats === 'string') {
        try {
          stats = JSON.parse(stats);
        } catch {
          return;
        }
      }
      if (!stats || typeof stats !== 'object') return;

      Object.entries(stats).forEach(([cat, st]: [string, any]) => {
        if (!cat || !st || typeof st !== 'object') return;
        const cur = map.get(cat) || { correct: 0, total: 0 };
        const cVal = Number(st.correct) || 0;
        const tVal = Number(st.total) || 0;
        if (tVal > 0) {
          overallAttempts += tVal;
          map.set(cat, {
            correct: cur.correct + cVal,
            total: cur.total + tVal,
          });
        }
      });
    });

    const entries: CategoryPerformance[] = Array.from(map.entries()).map(
      ([category, { correct, total }]) => ({
        category,
        correct,
        total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      })
    );

    if (entries.length === 0) {
      return { weakest: null, runnerUp: null, hasData: false, totalAttempts: 0 };
    }

    // Sort: lowest accuracy first; tiebreak with higher total attempts
    entries.sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.total - a.total;
    });

    // Priority 1: Categories with >= 3 attempts and accuracy < 70% (true weak areas)
    const significantWeak = entries.filter((c) => c.total >= 3 && c.accuracy < 70);
    // Priority 2: Categories with >= 3 attempts
    const moderateSample = entries.filter((c) => c.total >= 3);

    const primary = significantWeak[0] || moderateSample[0] || entries[0];
    const secondary = entries.find((c) => c.category !== primary.category) || null;

    return {
      weakest: primary,
      runnerUp: secondary,
      hasData: true,
      totalAttempts: overallAttempts,
    };
  }, [myResults]);

  // Fetch count of questions available in this category in the bank
  useEffect(() => {
    if (!weakest?.category) {
      setBankCount(null);
      return;
    }

    let isMounted = true;
    setLoadingCount(true);

    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('category', weakest.category)
      .neq('category', 'Demo')
      .then(({ count, error }) => {
        if (isMounted) {
          setLoadingCount(false);
          if (!error && count !== null) {
            setBankCount(count);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [weakest?.category]);

  const targetCategory = weakest?.category || 'Cardiovascular';
  const theme = SYSTEM_THEMES[targetCategory] || {
    icon: '🎯',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  };

  const handleStartPractice = (count: number = 5) => {
    onStartQuiz({
      topic: `Target: ${targetCategory}`,
      categories: [targetCategory],
      count,
      forceNew: true,
    });
  };

  // If no data yet, show a welcome invitation to take a block
  if (!hasData || !weakest) {
    return (
      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50/80 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900/40 border border-blue-200/80 dark:border-blue-900/40 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Weak Category Spotlight
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
              Complete your first quiz block to unlock personalized high-yield topic recommendations.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenBuilder}
          className="shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
        >
          Explore Builder <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Collapsed compact ticker state
  if (collapsed) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800/80 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <span className="font-black text-slate-800 dark:text-slate-100 truncate">
            Spotlight: {theme.icon} {weakest.category}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            weakest.accuracy < 60
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              : weakest.accuracy < 70
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          }`}>
            {weakest.accuracy}% ({weakest.correct}/{weakest.total})
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleStartPractice(5)}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all shadow-xs cursor-pointer"
          >
            Practice 5 <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={toggleCollapsed}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
            title="Expand spotlight"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Full Expanded Widget
  const isHighPriority = weakest.accuracy < 70;
  const accuracyColor = weakest.accuracy < 50
    ? 'text-rose-600 dark:text-rose-400 bg-rose-500'
    : weakest.accuracy < 70
    ? 'text-amber-600 dark:text-amber-400 bg-amber-500'
    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';

  return (
    <div className="mb-4 bg-gradient-to-br from-white via-slate-50/50 to-amber-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden animate-fade-in group">
      {/* Background ambient decorative orb */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-amber-400/10 dark:bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 text-white rounded-xl shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                Weak Category Spotlight
              </span>
              {isHighPriority && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded">
                  Below 70% Benchmark
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={toggleCollapsed}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Minimize spotlight"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Category & stats */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{theme.icon}</span>
              <span>{weakest.category}</span>
            </h4>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              · Current Accuracy:{' '}
              <strong className={weakest.accuracy < 70 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-emerald-600 dark:text-emerald-400 font-black'}>
                {weakest.accuracy}%
              </strong>{' '}
              ({weakest.correct}/{weakest.total} correct)
            </span>
          </div>

          {/* Micro Progress Meter vs Board Readiness 70% Target */}
          <div className="max-w-md space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              <span>Your Accuracy ({weakest.accuracy}%)</span>
              <span>Board Ready Target: 70%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
              {/* 70% target marker */}
              <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-slate-300 dark:bg-slate-600 z-10" />
              {/* Resident progress bar */}
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  weakest.accuracy < 50
                    ? 'bg-rose-500'
                    : weakest.accuracy < 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, weakest.accuracy)}%` }}
              />
            </div>
          </div>

          {/* Bank availability footnote */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            {bankCount !== null && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <strong className="font-semibold text-slate-700 dark:text-slate-300">
                  {bankCount} board questions
                </strong>{' '}
                available in bank
              </span>
            )}
            {runnerUp && runnerUp.accuracy < 70 && (
              <span className="text-slate-400 dark:text-slate-500 hidden md:inline">
                • Also monitor:{' '}
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {runnerUp.category} ({runnerUp.accuracy}%)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick-Start Actions */}
        <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleStartPractice(5)}
            className="flex-1 sm:flex-initial py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span>Practice 5 Questions</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartPractice(10)}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline px-2 py-1"
            >
              Practice 10 Qs
            </button>
            <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
            <button
              type="button"
              onClick={onOpenBuilder}
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline px-2 py-1"
            >
              Custom Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
