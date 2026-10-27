'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, CheckCircle, AlertTriangle, Sparkles, X, Clock,
  ChevronDown, ChevronUp
} from './AppIcons';
import { Layers, RotateCcw } from 'lucide-react';
import { partitionYears, RECENT_ITE_YEAR_WINDOW, LEGACY_WARNING_TITLE, LEGACY_WARNING_BODY } from '@/lib/questionFilters';
import { formatIteId } from '@/lib/iteQuestionMap';
import { Question } from '@/lib/types';

export interface QuestionPickerProps {
  allQuestions: Question[];
  selectedQuestionIds: string[];
  onChangeSelectedIds: (newIds: string[]) => void;
  targetCount?: number;
  initialCategoryFilters?: string[];
  maxHeight?: string;
  title?: string;
}

export default function QuestionPicker({
  allQuestions,
  selectedQuestionIds,
  onChangeSelectedIds,
  targetCount,
  initialCategoryFilters = [],
  maxHeight = 'max-h-[580px]',
  title = 'Select Questions',
}: QuestionPickerProps) {
  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategoryFilters);
  const [filterYear, setFilterYear] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'selected'>('all');
  const [bulkCount, setBulkCount] = useState<number>(10);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Legacy ITE opt-in
  const [showLegacyYears, setShowLegacyYears] = useState(false);
  const [showLegacyWarning, setShowLegacyWarning] = useState(false);

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

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const legacySet = new Set(legacyYears);

    return allQuestions.filter(q => {
      if (q.category === 'Demo') return false;

      // Category filter (multi-select)
      if (selectedCategories.length > 0 && !selectedCategories.includes(q.category)) {
        return false;
      }

      // Year filter
      if (filterYear && q.year !== filterYear) {
        return false;
      }

      // Hide legacy unless explicitly shown
      if (!showLegacyYears && legacySet.has(q.year)) {
        return false;
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
  }, [allQuestions, selectedCategories, filterYear, showLegacyYears, legacyYears, search]);

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

  // Toggle single selection
  const toggleSelect = (id: string) => {
    if (selectedSet.has(id)) {
      onChangeSelectedIds(selectedQuestionIds.filter(x => x !== id));
    } else {
      onChangeSelectedIds([...selectedQuestionIds, id]);
    }
  };

  // Bulk actions
  const handleSelectRandom = () => {
    // Pick from currently filtered questions that are not yet selected
    const unselectedFiltered = filteredQuestions.filter(q => !selectedSet.has(q.id));
    if (unselectedFiltered.length === 0) return;

    const count = Math.min(bulkCount, unselectedFiltered.length);
    const shuffled = [...unselectedFiltered].sort(() => Math.random() - 0.5);
    const newIds = shuffled.slice(0, count).map(q => q.id);

    onChangeSelectedIds(Array.from(new Set([...selectedQuestionIds, ...newIds])));
  };

  const handleSelectAllFiltered = () => {
    const newIds = filteredQuestions.map(q => q.id);
    onChangeSelectedIds(Array.from(new Set([...selectedQuestionIds, ...newIds])));
  };

  const handleFillToTarget = () => {
    if (!targetCount) return;
    const needed = targetCount - selectedQuestionIds.length;
    if (needed <= 0) return;

    // Pick from filtered first (or all valid non-legacy questions if filtered is empty)
    const legacySet = new Set(legacyYears);
    let pool = filteredQuestions.filter(q => !selectedSet.has(q.id));
    if (pool.length === 0) {
      pool = allQuestions.filter(q => {
        if (q.category === 'Demo') return false;
        if (!showLegacyYears && legacySet.has(q.year)) return false;
        return !selectedSet.has(q.id);
      });
    }

    // Sort by recent year first
    const sorted = [...pool].sort((a, b) => (b.year || '').localeCompare(a.year || ''));
    const picked = sorted.slice(0, needed).map(q => q.id);

    onChangeSelectedIds([...selectedQuestionIds, ...picked]);
  };

  const handleClearSelection = () => {
    if (selectedQuestionIds.length === 0) return;
    if (window.confirm(`Remove all ${selectedQuestionIds.length} selected questions?`)) {
      onChangeSelectedIds([]);
    }
  };

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const requestShowLegacyYears = () => {
    if (showLegacyYears) {
      setShowLegacyYears(false);
      if (legacyYears.includes(filterYear)) setFilterYear('');
    } else {
      setShowLegacyWarning(true);
    }
  };

  const confirmShowLegacyYears = () => {
    setShowLegacyYears(true);
    setShowLegacyWarning(false);
  };

  return (
    <div className="space-y-4">
      {/* Search and Year Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by keywords, text, or ITE ID (e.g. ITE2025Q14)..."
              className="w-full pl-10 pr-9 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{showLegacyYears ? 'All Years' : `Recent ${RECENT_ITE_YEAR_WINDOW} Years`}</option>
              {recentYears.map(y => (
                <option key={y} value={y}>ITE {y}</option>
              ))}
              {showLegacyYears && legacyYears.map(y => (
                <option key={y} value={y}>ITE {y} (Legacy)</option>
              ))}
            </select>

            {legacyYears.length > 0 && (
              <button
                type="button"
                onClick={requestShowLegacyYears}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border ${
                  showLegacyYears
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-600'
                }`}
                title="Toggle questions older than 3 years"
              >
                <Clock className="w-3 h-3" />
                {showLegacyYears ? 'Hide Legacy' : `Legacy (${legacyYears.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Category Pills (Multi-Select) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Filter by Category ({selectedCategories.length > 0 ? `${selectedCategories.length} active` : 'All'})
            </label>
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear Categories
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar p-0.5">
            <button
              onClick={() => setSelectedCategories([])}
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
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-md ${
                    active ? 'bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs & Bulk Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
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

        {/* Bulk Actions */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="number"
              min="1"
              max={filteredQuestions.length || 40}
              value={bulkCount}
              onChange={e => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 px-2 py-1 text-center font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
              title="Number of random questions to add"
            />
            <button
              type="button"
              onClick={handleSelectRandom}
              disabled={filteredQuestions.length === 0}
              className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              + Add Random
            </button>
          </div>

          <button
            type="button"
            onClick={handleSelectAllFiltered}
            disabled={filteredQuestions.length === 0}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-40"
          >
            Add All Filtered
          </button>

          {targetCount && selectedQuestionIds.length < targetCount && (
            <button
              type="button"
              onClick={handleFillToTarget}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-black text-indigo-700 dark:text-indigo-300 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-Fill to {targetCount}
            </button>
          )}

          {selectedQuestionIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 font-bold text-red-600 dark:text-red-400 rounded-xl transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Questions Scrollable List */}
      <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs flex flex-col`}>
        <div className={`${maxHeight} overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar p-1.5 space-y-1`}>
          {displayedQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <p className="font-bold text-sm">
                {activeTab === 'selected'
                  ? 'No questions selected yet. Switch to "Matching Questions" to add questions.'
                  : 'No questions match your current search and filters.'}
              </p>
              {(search || selectedCategories.length > 0 || filterYear) && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSelectedCategories([]); setFilterYear(''); }}
                  className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            displayedQuestions.map(q => {
              const isSelected = selectedSet.has(q.id);
              const isExpanded = expandedQuestionId === q.id;
              const isLegacy = legacyYears.includes(q.year);

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/70 shadow-xs ring-1 ring-indigo-500/10'
                      : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                    />

                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleSelect(q.id)}>
                      <p className={`text-xs sm:text-sm leading-relaxed ${
                        isSelected ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'
                      }`}>
                        {q.question_text}
                      </p>

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
