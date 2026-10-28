'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, CheckCircle, AlertTriangle, Sparkles, X, Clock,
  ChevronDown, ChevronUp
} from './AppIcons';
import {
  Layers, CheckSquare, Trash2, Dices, Shuffle, Check, Filter,
  TrendingDown, TrendingUp, AlertCircle, BarChart3, PieChart
} from 'lucide-react';
import { partitionYears, RECENT_ITE_YEAR_WINDOW, LEGACY_WARNING_TITLE, LEGACY_WARNING_BODY } from '@/lib/questionFilters';
import { formatIteId } from '@/lib/iteQuestionMap';
import { Question } from '@/lib/types';
import { QuestionStat, getQuestionPerformanceStats } from '@/lib/questionStats';
import QuestionStemDisplay from './QuestionStemDisplay';

export interface QuestionPickerProps {
  allQuestions: Question[];
  selectedQuestionIds: string[];
  onChangeSelectedIds: (newIds: string[]) => void;
  targetCount?: number;
  initialCategoryFilters?: string[];
  maxHeight?: string;
  title?: string;
  overlappingQuestionMap?: Record<string, string[]>;
  questionStats?: Record<string, QuestionStat>;
}

// Fisher-Yates array shuffle for unbiased random selection
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuestionPicker({
  allQuestions,
  selectedQuestionIds,
  onChangeSelectedIds,
  targetCount,
  initialCategoryFilters = [],
  maxHeight = 'max-h-[580px]',
  title = 'Select Questions',
  overlappingQuestionMap = {},
  questionStats: initialQuestionStats,
}: QuestionPickerProps) {
  // Multi-Filter state
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategoryFilters);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'hard' | 'moderate' | 'high_yield' | 'untested'>('all');
  const [hideOverlapping, setHideOverlapping] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'selected'>('all');
  const [bulkCount, setBulkCount] = useState<number>(targetCount || 10);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Range selection state (Shift + Click)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Performance stats (auto-fetch if not provided by prop)
  const [statsMap, setStatsMap] = useState<Record<string, QuestionStat>>(initialQuestionStats || {});

  useEffect(() => {
    if (!initialQuestionStats || Object.keys(initialQuestionStats).length === 0) {
      getQuestionPerformanceStats().then(s => setStatsMap(s));
    }
  }, [initialQuestionStats]);

  // Legacy ITE opt-in
  const [showLegacyYears, setShowLegacyYears] = useState(false);
  const [showLegacyWarning, setShowLegacyWarning] = useState(false);

  // Master checkbox ref for indeterminate state
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  // Reset range tracking on filter/tab changes
  useEffect(() => {
    setLastClickedIndex(null);
  }, [search, selectedCategories, selectedYears, difficultyFilter, hideOverlapping, showLegacyYears, activeTab]);

  // Derive categories and years from question bank
  const { categories, years, categoryCounts } = useMemo(() => {
    const cs = new Set<string>();
    const ys = new Set<string>();
    const counts: Record<string, number> = {};

    allQuestions.forEach(q => {
      if (q.category && q.category !== 'Demo') {
        cs.add(q.category);
        counts[q.category] = (counts[q.category] || 0) + 1;
      }
      if (q.year && q.year !== 'Demo') {
        ys.add(q.year);
      }
    });

    return {
      categories: Array.from(cs).sort(),
      years: Array.from(ys).sort().reverse(),
      categoryCounts: counts,
    };
  }, [allQuestions]);

  const { recent: recentYears, legacy: legacyYears } = useMemo(
    () => partitionYears(years, RECENT_ITE_YEAR_WINDOW),
    [years]
  );

  const selectedSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);

  // Count overlapping questions in current question pool
  const overlappingPoolCount = useMemo(() => {
    return allQuestions.filter(q => (overlappingQuestionMap[q.id]?.length || 0) > 0).length;
  }, [allQuestions, overlappingQuestionMap]);

  // Filtered questions based on multiple active filters
  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const legacySet = new Set(legacyYears);

    return allQuestions.filter(q => {
      if (q.category === 'Demo') return false;

      // Overlap filter
      if (hideOverlapping && (overlappingQuestionMap[q.id]?.length || 0) > 0) {
        return false;
      }

      // Difficulty filter
      if (difficultyFilter !== 'all') {
        const stat = statsMap[q.id];
        const diff = stat?.difficulty || 'untested';
        if (diff !== difficultyFilter) return false;
      }

      // Category filter (multi-select)
      if (selectedCategories.length > 0 && !selectedCategories.includes(q.category)) {
        return false;
      }

      // Year filter (multi-select)
      if (selectedYears.length > 0) {
        if (!selectedYears.includes(q.year)) return false;
      } else {
        if (!showLegacyYears && legacySet.has(q.year)) {
          return false;
        }
      }

      // Search term
      if (term) {
        const iteId = formatIteId(q).toLowerCase();
        const text = (q.question_text || '').toLowerCase();
        const cat = (q.category || '').toLowerCase();
        const yr = (q.year || '').toLowerCase();
        if (!text.includes(term) && !iteId.includes(term) && !cat.includes(term) && !yr.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [allQuestions, selectedCategories, selectedYears, difficultyFilter, hideOverlapping, showLegacyYears, legacyYears, search, statsMap, overlappingQuestionMap]);

  // Questions displayed based on Active Tab
  const displayedQuestions = useMemo(() => {
    if (activeTab === 'selected') {
      const selectedMap = new Map(allQuestions.map(q => [q.id, q]));
      return selectedQuestionIds
        .map(id => selectedMap.get(id))
        .filter((q): q is Question => q !== undefined);
    }
    return filteredQuestions;
  }, [activeTab, filteredQuestions, allQuestions, selectedQuestionIds]);

  // Category Blueprint breakdown of currently selected questions
  const selectedCategoryBreakdown = useMemo(() => {
    const map = new Map(allQuestions.map(q => [q.id, q]));
    const counts: Record<string, number> = {};
    selectedQuestionIds.forEach(id => {
      const q = map.get(id);
      if (q?.category) {
        counts[q.category] = (counts[q.category] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allQuestions, selectedQuestionIds]);

  // Selection counts for displayed & filtered lists
  const displayedSelectedCount = useMemo(() => {
    return displayedQuestions.filter(q => selectedSet.has(q.id)).length;
  }, [displayedQuestions, selectedSet]);

  const allDisplayedSelected = displayedQuestions.length > 0 && displayedSelectedCount === displayedQuestions.length;
  const someDisplayedSelected = displayedSelectedCount > 0 && !allDisplayedSelected;

  const filteredSelectedCount = useMemo(() => {
    return filteredQuestions.filter(q => selectedSet.has(q.id)).length;
  }, [filteredQuestions, selectedSet]);

  // Update indeterminate state on master checkbox
  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someDisplayedSelected;
    }
  }, [someDisplayedSelected]);

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    if (selectedSet.has(id)) {
      onChangeSelectedIds(selectedQuestionIds.filter(x => x !== id));
    } else {
      onChangeSelectedIds([...selectedQuestionIds, id]);
    }
  };

  // Shift + Click Range Selection & Deselection handler
  const handleItemSelect = (e: React.MouseEvent, qId: string, index: number) => {
    if (e.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
      window.getSelection()?.removeAllRanges();

      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeQuestions = displayedQuestions.slice(start, end + 1);
      const rangeIds = rangeQuestions.map(q => q.id);
      const rangeSet = new Set(rangeIds);

      const isTargetSelected = selectedSet.has(qId);
      let nextIds: string[];
      if (isTargetSelected) {
        nextIds = selectedQuestionIds.filter(id => !rangeSet.has(id));
      } else {
        nextIds = Array.from(new Set([...selectedQuestionIds, ...rangeIds]));
      }

      onChangeSelectedIds(nextIds);
      setLastClickedIndex(index);
    } else {
      toggleSelect(qId);
      setLastClickedIndex(index);
    }
  };

  // Master checkbox toggle for displayed questions
  const handleToggleMasterCheckbox = () => {
    if (displayedQuestions.length === 0) return;
    const displayedIds = displayedQuestions.map(q => q.id);
    const displayedSet = new Set(displayedIds);

    if (allDisplayedSelected || someDisplayedSelected) {
      onChangeSelectedIds(selectedQuestionIds.filter(id => !displayedSet.has(id)));
    } else {
      onChangeSelectedIds(Array.from(new Set([...selectedQuestionIds, ...displayedIds])));
    }
  };

  // Bulk Add / Select all currently filtered questions
  const handleSelectAllFiltered = () => {
    const newIds = filteredQuestions.map(q => q.id);
    onChangeSelectedIds(Array.from(new Set([...selectedQuestionIds, ...newIds])));
  };

  // Bulk Deselect only the currently filtered questions
  const handleDeselectAllFiltered = () => {
    if (filteredSelectedCount === 0) return;
    const filteredSet = new Set(filteredQuestions.map(q => q.id));
    onChangeSelectedIds(selectedQuestionIds.filter(id => !filteredSet.has(id)));
  };

  // Auto Assign: Random Selection based strictly on currently filtered questions
  const handleAddRandomFromFiltered = (countToPick: number = bulkCount) => {
    const unselectedFiltered = filteredQuestions.filter(q => !selectedSet.has(q.id));
    if (unselectedFiltered.length === 0) return;

    const count = Math.min(countToPick, unselectedFiltered.length);
    const shuffled = shuffleArray(unselectedFiltered);
    const newIds = shuffled.slice(0, count).map(q => q.id);

    onChangeSelectedIds(Array.from(new Set([...selectedQuestionIds, ...newIds])));
  };

  // Auto Assign: Replace entire selection with random questions matching active filters
  const handleReplaceWithRandomFromFiltered = (countToPick: number = bulkCount) => {
    if (filteredQuestions.length === 0) return;

    const count = Math.min(countToPick, filteredQuestions.length);
    const shuffled = shuffleArray(filteredQuestions);
    const newIds = shuffled.slice(0, count).map(q => q.id);

    onChangeSelectedIds(newIds);
  };

  // Auto-fill up to target count randomly from filtered questions
  const handleFillToTarget = () => {
    if (!targetCount) return;
    const needed = targetCount - selectedQuestionIds.length;
    if (needed <= 0) return;

    const unselected = filteredQuestions.filter(q => !selectedSet.has(q.id));
    const shuffled = shuffleArray(unselected);
    const picked = shuffled.slice(0, needed).map(q => q.id);

    onChangeSelectedIds([...selectedQuestionIds, ...picked]);
  };

  // Clear entire selection
  const handleClearSelection = () => {
    if (selectedQuestionIds.length === 0) return;
    if (window.confirm(`Remove all ${selectedQuestionIds.length} selected questions?`)) {
      onChangeSelectedIds([]);
    }
  };

  // Multi-Category Toggles
  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories([...categories]);
  };

  const handleClearCategories = () => {
    setSelectedCategories([]);
  };

  // Multi-Year Toggles
  const handleYearToggle = (yr: string) => {
    setSelectedYears(prev =>
      prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]
    );
  };

  const handleSelectAllRecentYears = () => {
    setSelectedYears([...recentYears]);
  };

  const handleClearYears = () => {
    setSelectedYears([]);
  };

  const handleResetAllFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setSelectedYears([]);
    setDifficultyFilter('all');
    setHideOverlapping(false);
  };

  const requestShowLegacyYears = () => {
    if (showLegacyYears) {
      setShowLegacyYears(false);
      const legacySet = new Set(legacyYears);
      setSelectedYears(prev => prev.filter(y => !legacySet.has(y)));
    } else {
      setShowLegacyWarning(true);
    }
  };

  const confirmShowLegacyYears = () => {
    setShowLegacyYears(true);
    setShowLegacyWarning(false);
  };

  const hasActiveFilters = search || selectedCategories.length > 0 || selectedYears.length > 0 || difficultyFilter !== 'all' || hideOverlapping;

  return (
    <div className="space-y-4">
      {/* Search & Multi-Filter Controls */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search keywords, question text, options, or ITE ID (e.g. ITE2025Q14)..."
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Multi-Year & Quick Toggles */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Filter by Exam Year ({selectedYears.length > 0 ? `${selectedYears.length} selected` : 'All Recent Years'})
              </label>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              {selectedYears.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearYears}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear Years (Show All)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectAllRecentYears}
                  className="text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                >
                  Select Recent {RECENT_ITE_YEAR_WINDOW} Years
                </button>
              )}

              {legacyYears.length > 0 && (
                <button
                  type="button"
                  onClick={requestShowLegacyYears}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors border ${
                    showLegacyYears
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-600'
                  }`}
                  title="Toggle questions older than 3 years"
                >
                  {showLegacyYears ? 'Hide Legacy' : `+ Show Legacy (${legacyYears.length})`}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 p-0.5">
            <button
              type="button"
              onClick={handleClearYears}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                selectedYears.length === 0
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Recent
            </button>
            {recentYears.map(yr => {
              const active = selectedYears.includes(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleYearToggle(yr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-xs ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  <span>ITE {yr}</span>
                </button>
              );
            })}
            {showLegacyYears && legacyYears.map(yr => {
              const active = selectedYears.includes(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleYearToggle(yr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                    active
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-amber-700/80 dark:text-amber-400/80 border-amber-200 dark:border-amber-900 hover:bg-amber-50'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                  <span>ITE {yr} (Legacy)</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty & Overlap Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
          {/* Difficulty Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-indigo-500" />
              Difficulty:
            </span>
            {[
              { id: 'all', label: 'All Levels' },
              { id: 'hard', label: 'Hard (<50%)' },
              { id: 'moderate', label: 'Moderate (50-75%)' },
              { id: 'high_yield', label: 'High Yield (>75%)' },
            ].map(d => {
              const active = difficultyFilter === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficultyFilter(d.id as any)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Overlap Toggle */}
          {overlappingPoolCount > 0 && (
            <button
              type="button"
              onClick={() => setHideOverlapping(prev => !prev)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border self-start sm:self-auto ${
                hideOverlapping
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-amber-600'
              }`}
              title="Hide questions already used in other blocks"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{hideOverlapping ? 'Hiding Other Blocks Questions' : `Hide Questions in Other Blocks (${overlappingPoolCount})`}</span>
            </button>
          )}
        </div>

        {/* Multi-Category Filter Pills */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filter by Category ({selectedCategories.length > 0 ? `${selectedCategories.length} selected` : 'All Categories'})
            </label>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              {selectedCategories.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearCategories}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear Categories
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                >
                  Select All Categories
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-0.5">
            <button
              type="button"
              onClick={handleClearCategories}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                selectedCategories.length === 0
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Categories
            </button>
            {categories.map(cat => {
              const active = selectedCategories.includes(cat);
              const count = categoryCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-xs ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  <span>{cat}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-md ${
                    active ? 'bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        {hasActiveFilters && (
          <div className="pt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {filteredQuestions.length}
              </span>
              <span>questions match active filters:</span>
              {selectedCategories.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold text-[11px]">
                  {selectedCategories.length} categories
                </span>
              )}
              {selectedYears.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold text-[11px]">
                  {selectedYears.length} years
                </span>
              )}
              {difficultyFilter !== 'all' && (
                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold text-[11px] capitalize">
                  {difficultyFilter}
                </span>
              )}
              {hideOverlapping && (
                <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded font-semibold text-[11px]">
                  Unique to Block
                </span>
              )}
              {search && (
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[11px]">
                  &quot;{search}&quot;
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetAllFilters}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Live Category Blueprint Visualizer (Visible in Selected Tab or when questions selected) */}
      {selectedQuestionIds.length > 0 && (
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-500" />
              Category Blueprint ({selectedQuestionIds.length} Selected)
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {selectedCategoryBreakdown.length} Categories
            </span>
          </div>

          {/* Segmented Category Progress Bar */}
          <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 gap-0.5">
            {selectedCategoryBreakdown.map(([cat, count], idx) => {
              const pct = (count / selectedQuestionIds.length) * 100;
              const colors = [
                'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
                'bg-rose-500', 'bg-purple-500', 'bg-teal-500', 'bg-cyan-500', 'bg-orange-500'
              ];
              const color = colors[idx % colors.length];
              return (
                <div
                  key={cat}
                  className={`${color} h-full transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${cat}: ${count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          {/* Category Chips with percentage */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {selectedCategoryBreakdown.map(([cat, count]) => {
              const pct = Math.round((count / selectedQuestionIds.length) * 100);
              return (
                <span
                  key={cat}
                  className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold flex items-center gap-1.5"
                >
                  <span className="text-slate-700 dark:text-slate-200">{cat}</span>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {count} ({pct}%)
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs & Bulk Assignment Toolbar */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* View Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Matching Questions</span>
              <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px]">
                {filteredQuestions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('selected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'selected'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Selected Questions</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                targetCount && selectedQuestionIds.length === targetCount
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              }`}>
                {selectedQuestionIds.length} {targetCount ? `/ ${targetCount}` : ''}
              </span>
            </button>
          </div>

          {/* Quick Bulk Select / Deselect Filtered Actions */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredQuestions.length === 0 || filteredSelectedCount === filteredQuestions.length}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-indigo-700 dark:text-indigo-300 rounded-xl transition-colors disabled:opacity-40 border border-indigo-200/60 dark:border-indigo-800/60"
              title="Add all matching questions to selection"
            >
              Select All Filtered ({filteredQuestions.length})
            </button>

            {filteredSelectedCount > 0 && (
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold text-amber-700 dark:text-amber-300 rounded-xl transition-colors border border-amber-200 dark:border-amber-800/60"
                title="Remove all matching questions from selection"
              >
                Deselect Filtered ({filteredSelectedCount})
              </button>
            )}

            {selectedQuestionIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 font-bold text-red-600 dark:text-red-400 rounded-xl transition-colors flex items-center gap-1"
                title="Clear all selected questions"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All ({selectedQuestionIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Auto-Assign / Random Picker Bar */}
        <div className="bg-slate-100/70 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Dices className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Auto-Assign Random:
            </span>

            {/* Quick preset chips */}
            {[10, 20, 25, 40].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => setBulkCount(cnt)}
                className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all border ${
                  bulkCount === cnt
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {cnt} Qs
              </button>
            ))}

            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                min="1"
                max={filteredQuestions.length || 100}
                value={bulkCount}
                onChange={e => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 text-center font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                title="Custom number of questions"
              />
              <span className="text-[11px] text-slate-400 font-medium">questions</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleAddRandomFromFiltered(bulkCount)}
              disabled={filteredQuestions.length === 0}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-indigo-700 dark:text-indigo-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-2xs disabled:opacity-40 flex items-center gap-1.5"
              title="Add random unselected questions matching current filters"
            >
              <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
              + Add {bulkCount} Random
            </button>

            <button
              type="button"
              onClick={() => handleReplaceWithRandomFromFiltered(bulkCount)}
              disabled={filteredQuestions.length === 0}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-xl transition-all shadow-2xs disabled:opacity-40 flex items-center gap-1.5"
              title="Replace selection with random questions matching current filters"
            >
              <Dices className="w-3.5 h-3.5" />
              Pick {bulkCount} Random
            </button>

            {targetCount && selectedQuestionIds.length < targetCount && (
              <button
                type="button"
                onClick={handleFillToTarget}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 font-black text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                title={`Randomly fill remaining ${targetCount - selectedQuestionIds.length} questions from current filters`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill to {targetCount} ({targetCount - selectedQuestionIds.length} left)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Questions Container with Master Checkbox & Shift+Click Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs flex flex-col">
        {/* Master Selection Header Toolbar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                ref={masterCheckboxRef}
                type="checkbox"
                checked={allDisplayedSelected}
                onChange={handleToggleMasterCheckbox}
                disabled={displayedQuestions.length === 0}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
              />
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {allDisplayedSelected || someDisplayedSelected
                  ? `Deselect All in View (${displayedSelectedCount})`
                  : `Select All in View (${displayedQuestions.length})`}
              </span>
            </label>

            <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px]">
              • {displayedSelectedCount} of {displayedQuestions.length} selected
            </span>
          </div>

          {/* Keyboard Shortcut & Tip */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <kbd className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                Shift
              </kbd>
              + click row to select / deselect range
            </span>
          </div>
        </div>

        {/* Scrollable Questions List */}
        <div className={`${maxHeight} overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar p-1.5 space-y-1`}>
          {displayedQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <p className="font-bold text-sm">
                {activeTab === 'selected'
                  ? 'No questions selected yet. Switch to "Matching Questions" to add questions.'
                  : 'No questions match your current search and filters.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            displayedQuestions.map((q, idx) => {
              const isSelected = selectedSet.has(q.id);
              const isExpanded = expandedQuestionId === q.id;
              const isLegacy = legacyYears.includes(q.year);
              const overlappingBlocks = overlappingQuestionMap[q.id] || [];
              const stat = statsMap[q.id];

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border transition-all select-none ${
                    isSelected
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/70 shadow-xs ring-1 ring-indigo-500/10'
                      : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div
                    className="p-3.5 flex items-start gap-3 cursor-pointer"
                    onClick={(e) => handleItemSelect(e, q.id, idx)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const nativeEvent = e.nativeEvent as MouseEvent;
                        handleItemSelect(
                          { shiftKey: nativeEvent.shiftKey } as React.MouseEvent,
                          q.id,
                          idx
                        );
                      }}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                    />

                    <div className="min-w-0 flex-1">
                      <QuestionStemDisplay
                        text={q.question_text}
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isSelected ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'
                        }`}
                      />

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold uppercase tracking-wider">
                          {q.category}
                        </span>

                        {formatIteId(q) ? (
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono font-bold">
                            {formatIteId(q)}
                          </span>
                        ) : (
                          q.year && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-bold">
                              ITE {q.year}
                            </span>
                          )
                        )}

                        {/* Overlap Badge */}
                        {overlappingBlocks.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded text-[10px] font-black border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            Also in: {overlappingBlocks.join(', ')}
                          </span>
                        )}

                        {/* Difficulty / Accuracy Badge */}
                        {stat && stat.totalAttempts >= 3 && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                              stat.difficulty === 'hard'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                : stat.difficulty === 'moderate'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            }`}
                            title={`${stat.correctAttempts} / ${stat.totalAttempts} attempts correct across residency`}
                          >
                            {stat.difficulty === 'hard' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {stat.difficulty === 'hard'
                              ? `Hard (${stat.accuracyRate}%)`
                              : stat.difficulty === 'moderate'
                              ? `Mod (${stat.accuracyRate}%)`
                              : `High Yield (${stat.accuracyRate}%)`}
                          </span>
                        )}

                        {isLegacy && (
                          <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">
                            Legacy
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {q.options?.length || 0} options
                        </span>
                      </div>
                    </div>

                    {/* Preview Choices Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedQuestionId(isExpanded ? null : q.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
                      title={isExpanded ? 'Hide question choices' : 'View full choices & answer key'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded Choices Accordion */}
                  {isExpanded && q.options && q.options.length > 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-1">
                        Answer Choices:
                      </p>
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = optIdx === q.correct_index;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg flex items-start gap-2 border ${
                              isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                            {isCorrect && (
                              <span className="px-1.5 py-0.5 bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded text-[9px] font-black shrink-0">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legacy Warning Modal */}
      {showLegacyWarning && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {LEGACY_WARNING_TITLE}
                </h3>
              </div>
            </div>
            <div className="p-6 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              {LEGACY_WARNING_BODY}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLegacyWarning(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmShowLegacyYears}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 dark:shadow-none"
              >
                Yes, Show Legacy Years
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
