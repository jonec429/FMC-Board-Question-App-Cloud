'use client';

import React, { useState, useMemo } from 'react';
import { KNOWN_REPEAT_IDS } from './QuestionCard';
import { formatIteId } from '@/lib/iteQuestionMap';
import QuestionStemDisplay from './QuestionStemDisplay';
import { CheckCircle, XCircle } from './AppIcons';
import { ChevronLeft, ChevronRight, BarChart2, Layers, LayoutGrid } from 'lucide-react';

export interface QuizReviewItem {
  question: any;
  selected: number | null | undefined;
}

export interface SectionScoreSummary {
  sectionIndex: number;
  score: number;
  total: number;
  percentage: number;
  timeSpentSeconds?: number;
}

export interface QuizReviewProps {
  items: QuizReviewItem[];
  sectionSummaries?: SectionScoreSummary[];
  questionsPerSection?: number;
}

const PAGE_SIZE = 25;

/**
 * Read-only review of a completed quiz: every question with its options (the
 * correct answer and the resident's pick both marked) and the explanation.
 * Supports Section-by-Section breakdown cards, section filtering, and pagination.
 */
export default function QuizReview({
  items,
  sectionSummaries,
  questionsPerSection,
}: QuizReviewProps) {
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [selectedSection, setSelectedSection] = useState<'all' | number>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMatrix, setShowMatrix] = useState<boolean>(false);

  const safeItems = useMemo(() => items || [], [items]);

  const handleTileClick = (originalIndex: number) => {
    const item = safeItems[originalIndex];
    if (!item) return;

    const isCorrect = item.selected === item.question?.correct_index;

    // If current filter excludes this item, reset filter to 'all' so the card is visible
    if (filter === 'incorrect' && isCorrect) {
      setFilter('all');
    } else if (filter === 'correct' && !isCorrect) {
      setFilter('all');
    }

    // If current section filter excludes this item, reset section to 'all'
    if (selectedSection !== 'all' && questionsPerSection && questionsPerSection > 0) {
      const itemSection = Math.floor(originalIndex / questionsPerSection) + 1;
      if (itemSection !== selectedSection) {
        setSelectedSection('all');
      }
    }

    setTimeout(() => {
      // Find position of this originalIndex in filtered items
      const targetIndex = filteredItems.findIndex(it => it.originalIndex === originalIndex);
      if (targetIndex !== -1) {
        const targetPage = Math.floor(targetIndex / PAGE_SIZE) + 1;
        setCurrentPage(targetPage);
      } else {
        const targetPage = Math.floor(originalIndex / PAGE_SIZE) + 1;
        setCurrentPage(targetPage);
      }

      setTimeout(() => {
        const el = document.getElementById(`review-question-${originalIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-indigo-500/50');
          setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500/50'), 1500);
        }
      }, 100);
    }, 50);
  };

  // Derive sections if questionsPerSection is provided but sectionSummaries wasn't passed
  const derivedSummaries = useMemo<SectionScoreSummary[]>(() => {
    if (sectionSummaries && sectionSummaries.length > 0) return sectionSummaries;
    if (!questionsPerSection || questionsPerSection <= 0 || safeItems.length === 0) return [];

    const numSections = Math.ceil(safeItems.length / questionsPerSection);
    const summaries: SectionScoreSummary[] = [];

    for (let s = 1; s <= numSections; s++) {
      const start = (s - 1) * questionsPerSection;
      const end = Math.min(start + questionsPerSection, safeItems.length);
      const sectionItems = safeItems.slice(start, end);
      const total = sectionItems.length;
      const score = sectionItems.filter(
        ({ question: q, selected }) => q && selected === q.correct_index
      ).length;
      const percentage = total > 0 ? parseFloat(((score / total) * 100).toFixed(1)) : 0;

      summaries.push({
        sectionIndex: s,
        score,
        total,
        percentage,
      });
    }

    return summaries;
  }, [sectionSummaries, questionsPerSection, safeItems]);

  const incorrectCount = useMemo(
    () => safeItems.filter(({ question: q, selected }) => q && selected !== q.correct_index).length,
    [safeItems]
  );

  const correctCount = useMemo(
    () => safeItems.filter(({ question: q, selected }) => q && selected === q.correct_index).length,
    [safeItems]
  );

  // Filter items by section and correctness
  const filteredItems = useMemo(() => {
    return safeItems
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter(({ question: q, selected, originalIndex }) => {
        if (!q) return true;

        // Section filter
        if (selectedSection !== 'all' && questionsPerSection && questionsPerSection > 0) {
          const itemSection = Math.floor(originalIndex / questionsPerSection) + 1;
          if (itemSection !== selectedSection) return false;
        }

        // Correctness filter
        const isCorrect = selected === q.correct_index;
        if (filter === 'incorrect') return !isCorrect;
        if (filter === 'correct') return isCorrect;
        return true;
      });
  }, [safeItems, selectedSection, questionsPerSection, filter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const effectivePage = Math.min(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (effectivePage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, effectivePage]);

  const handleFilterChange = (newFilter: 'all' | 'incorrect' | 'correct') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSectionChange = (sec: 'all' | number) => {
    setSelectedSection(sec);
    setCurrentPage(1);
  };

  if (!items || items.length === 0) {
    return <p className="text-center text-slate-400 dark:text-slate-500 text-sm italic py-6">No questions to review.</p>;
  }

  return (
    <div className="space-y-6">
      {/* SECTION-BY-SECTION SCORE BREAKDOWN HERO (For Mock Exams & Sectioned Quizzes) */}
      {derivedSummaries.length > 1 && (
        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 p-5 sm:p-6 rounded-3xl border border-indigo-100 dark:border-indigo-950/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Section Performance Trajectory</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {derivedSummaries.length} Exam Blocks
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {derivedSummaries.map((s) => {
              const isPassing = s.percentage >= 60;
              const isSelected = selectedSection === s.sectionIndex;
              return (
                <button
                  key={s.sectionIndex}
                  type="button"
                  onClick={() => handleSectionChange(isSelected ? 'all' : s.sectionIndex)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all relative ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Block {s.sectionIndex}
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                        isPassing
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {s.percentage}%
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {s.score} <span className="text-xs text-slate-400 font-normal">/ {s.total}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        s.percentage >= 75
                          ? 'bg-emerald-500'
                          : s.percentage >= 60
                          ? 'bg-indigo-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        {/* Correctness Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-slate-800 dark:bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Questions
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                filter === 'all'
                  ? 'bg-slate-700 dark:bg-indigo-700 text-slate-200'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('incorrect')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === 'incorrect'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200 dark:shadow-none'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100'
            }`}
          >
            Missed / Incorrect
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                filter === 'incorrect'
                  ? 'bg-red-700 text-white'
                  : 'bg-red-200/80 dark:bg-red-900/60 text-red-800 dark:text-red-200'
              }`}
            >
              {incorrectCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange('correct')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === 'correct'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200 dark:shadow-none'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            Correct
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                filter === 'correct'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {correctCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowMatrix(!showMatrix)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              showMatrix
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title="Toggle micro-box question navigator matrix"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Navigator Matrix</span>
            <span className="text-[10px] font-black opacity-80">
              {showMatrix ? 'Hide' : 'Show'}
            </span>
          </button>
        </div>

        {/* Section Filter Pills (if multiple sections exist) */}
        {derivedSummaries.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            <span className="text-[11px] text-slate-400 mr-1 uppercase font-black tracking-wider">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => handleSectionChange('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedSection === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
            {derivedSummaries.map((s) => (
              <button
                key={s.sectionIndex}
                type="button"
                onClick={() => handleSectionChange(s.sectionIndex)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedSection === s.sectionIndex
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Sec {s.sectionIndex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Micro-Box Question Matrix */}
      {showMatrix && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-base">🗂️</span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Question Navigator Matrix
              </h4>
              <span className="text-[10px] font-bold text-slate-400">
                ({safeItems.length} questions)
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-[10px] font-black">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Correct ({correctCount})
              </span>
              <span className="flex items-center gap-1 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                <XCircle className="w-3 h-3 text-red-600" /> Missed ({incorrectCount})
              </span>
            </div>
          </div>

          {/* Micro-Box Matrix Grid */}
          <div className="space-y-3">
            {derivedSummaries.length > 1 && selectedSection === 'all' ? (
              derivedSummaries.map((sec) => {
                const secStart = (sec.sectionIndex - 1) * (questionsPerSection || 75);
                const secEnd = Math.min(secStart + (questionsPerSection || 75), safeItems.length);
                const secItems = safeItems.slice(secStart, secEnd);

                return (
                  <div key={sec.sectionIndex} className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Block {sec.sectionIndex} (Q{secStart + 1}–Q{secEnd})</span>
                      <span className={sec.percentage >= 60 ? 'text-emerald-600 font-black' : 'text-amber-600 font-black'}>
                        {sec.score} / {sec.total} ({sec.percentage}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-1.5">
                      {secItems.map((item, idx) => {
                        const originalIndex = secStart + idx;
                        const isCorrect = item.selected === item.question?.correct_index;
                        const isSkipped = item.selected === null || item.selected === undefined;
                        const questionNum = originalIndex + 1;

                        let tileStyle = 'h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all relative select-none cursor-pointer ';
                        if (isSkipped) {
                          tileStyle += 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-400';
                        } else if (isCorrect) {
                          tileStyle += 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 hover:scale-105';
                        } else {
                          tileStyle += 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-2 border-red-300 dark:border-red-800 hover:bg-red-100 hover:scale-105';
                        }

                        return (
                          <button
                            key={originalIndex}
                            type="button"
                            onClick={() => handleTileClick(originalIndex)}
                            className={tileStyle}
                            title={`Jump to Q${questionNum} (${isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'})`}
                          >
                            <span>{questionNum}</span>
                            {!isSkipped && (
                              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                                {isCorrect ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1.5">
                {safeItems
                  .map((item, originalIndex) => ({ item, originalIndex }))
                  .filter(({ originalIndex }) => {
                    if (selectedSection === 'all' || !questionsPerSection || questionsPerSection <= 0) return true;
                    const itemSec = Math.floor(originalIndex / questionsPerSection) + 1;
                    return itemSec === selectedSection;
                  })
                  .map(({ item, originalIndex }) => {
                    const isCorrect = item.selected === item.question?.correct_index;
                    const isSkipped = item.selected === null || item.selected === undefined;
                    const questionNum = originalIndex + 1;

                    let tileStyle = 'h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all relative select-none cursor-pointer ';
                    if (isSkipped) {
                      tileStyle += 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-400';
                    } else if (isCorrect) {
                      tileStyle += 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 hover:scale-105';
                    } else {
                      tileStyle += 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-2 border-red-300 dark:border-red-800 hover:bg-red-100 hover:scale-105';
                    }

                    return (
                      <button
                        key={originalIndex}
                        type="button"
                        onClick={() => handleTileClick(originalIndex)}
                        className={tileStyle}
                        title={`Jump to Q${questionNum} (${isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'})`}
                      >
                        <span>{questionNum}</span>
                        {!isSkipped && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                            {isCorrect ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
            {filter === 'incorrect'
              ? '🎉 Perfect Score! No missed questions in this selection to review.'
              : 'No matching questions found.'}
          </p>
        </div>
      )}

      {/* Paginated Question Cards */}
      <div className="space-y-4">
        {pagedItems.map(({ question: q, selected, originalIndex }) => {
          if (!q) {
            return (
              <div
                key={originalIndex}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-400 dark:text-slate-500 italic"
              >
                {originalIndex + 1}. This question is no longer available.
              </div>
            );
          }
          const correct = q.correct_index;
          const skipped = selected === null || selected === undefined;
          const isCorrect = !skipped && selected === correct;
          const options: string[] = Array.isArray(q.options) ? q.options : [];
          const sectionNum = questionsPerSection ? Math.floor(originalIndex / questionsPerSection) + 1 : undefined;

          return (
            <div
              key={q.id || originalIndex}
              id={`review-question-${originalIndex}`}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 transition-colors shadow-xs ${
                skipped
                  ? 'border-slate-200 dark:border-slate-800'
                  : isCorrect
                  ? 'border-emerald-200 dark:border-emerald-900/50'
                  : 'border-red-200 dark:border-red-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  {(Boolean(q.is_repeat) || (q.id && KNOWN_REPEAT_IDS.has(q.id))) && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black rounded-full uppercase tracking-wider cursor-help"
                      title="This question appears in multiple ITEs"
                    >
                      <span aria-hidden="true">🔁</span>
                      <span>High Yield Repeat Question</span>
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {sectionNum && <span className="text-indigo-600 dark:text-indigo-400">Section {sectionNum} · </span>}
                    {q.category && <span>{q.category}</span>}
                    {formatIteId(q) ? (
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400">· {formatIteId(q)}</span>
                    ) : (
                      q.year && <span>· ITE {q.year}</span>
                    )}
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm shrink-0">
                      {originalIndex + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <QuestionStemDisplay
                        text={q.question_text}
                        className="font-bold text-slate-800 dark:text-slate-100 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    skipped
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      : isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {skipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </div>
              <div className="space-y-1.5">
                {options.map((opt, oi) => {
                  const isAns = oi === correct;
                  const isPicked = oi === selected;
                  return (
                    <div
                      key={oi}
                      className={`px-3 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${
                        isAns
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800'
                          : isPicked
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="shrink-0 font-bold">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isAns && (
                        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                          Correct
                        </span>
                      )}
                      {isPicked && !isAns && (
                        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-200/80 dark:bg-red-800 text-red-900 dark:text-red-100">
                          Your Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="mt-4 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">
                  <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                    Critique &amp; Explanation
                  </span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
          <div>
            Showing {(effectivePage - 1) * PAGE_SIZE + 1}–
            {Math.min(effectivePage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length} questions
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={effectivePage <= 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="px-2">
              Page {effectivePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={effectivePage >= totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
