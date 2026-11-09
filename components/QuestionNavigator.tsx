'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle, XCircle } from './AppIcons';
import { Flag, Eye, Check, X } from 'lucide-react';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<number, number>;
  stagedAnswers: Record<number, number>;
  viewedQuestions: Set<number>;
  onSelect: (index: number) => void;
  reviewMode?: boolean;
  questions?: any[];
  onClose?: () => void;
  flaggedQuestionIds?: Set<string>;
  displayOffset?: number; // e.g. 75 for Section 2 (questions 76–150)
  sectionLabel?: string;  // e.g. "Section 2 of 4"
}

export default function QuestionNavigator({
  totalQuestions = 0,
  currentIndex = 0,
  answers = {},
  stagedAnswers = {},
  viewedQuestions = new Set(),
  onSelect,
  reviewMode = false,
  questions = [],
  onClose,
  flaggedQuestionIds,
  displayOffset = 0,
  sectionLabel,
}: QuestionNavigatorProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'unanswered' | 'flagged'>('all');
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeButtonRef.current) {
      activeButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  // Compute status counts
  const { unansweredIndices, flaggedIndices, answeredCount } = useMemo(() => {
    const unans: number[] = [];
    const flg: number[] = [];
    let ans = 0;

    for (let i = 0; i < totalQuestions; i++) {
      const actualIndex = i + displayOffset;
      const isAnswered = answers?.[actualIndex] !== undefined || stagedAnswers?.[actualIndex] !== undefined;
      if (isAnswered) ans++;
      else unans.push(actualIndex);

      const q = questions[actualIndex];
      if (q && flaggedQuestionIds && flaggedQuestionIds.has(q.id)) {
        flg.push(actualIndex);
      }
    }

    return { unansweredIndices: unans, flaggedIndices: flg, answeredCount: ans };
  }, [totalQuestions, answers, stagedAnswers, questions, flaggedQuestionIds, displayOffset]);

  // Pinned Next Unanswered
  const nextUnanswered = useMemo(() => {
    if (unansweredIndices.length === 0) return null;
    const next = unansweredIndices.find((idx) => idx > currentIndex);
    return next !== undefined ? next : unansweredIndices[0];
  }, [unansweredIndices, currentIndex]);

  // Pinned Next Flagged
  const nextFlagged = useMemo(() => {
    if (flaggedIndices.length === 0) return null;
    const next = flaggedIndices.find((idx) => idx > currentIndex);
    return next !== undefined ? next : flaggedIndices[0];
  }, [flaggedIndices, currentIndex]);

  // Filter items to display based on active tab
  const visibleIndices = useMemo(() => {
    const all = Array.from({ length: totalQuestions }, (_, i) => i + displayOffset);
    if (filterTab === 'unanswered') {
      return all.filter((i) => answers?.[i] === undefined && stagedAnswers?.[i] === undefined);
    }
    if (filterTab === 'flagged') {
      return all.filter((i) => {
        const q = questions[i];
        return q && flaggedQuestionIds && flaggedQuestionIds.has(q.id);
      });
    }
    return all;
  }, [totalQuestions, filterTab, answers, stagedAnswers, questions, flaggedQuestionIds, displayOffset]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[calc(100vh-12rem)] sm:max-h-[78vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 transition-colors w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
            <span>Questions</span>
            {sectionLabel && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {sectionLabel}
              </span>
            )}
          </h3>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {answeredCount} of {totalQuestions} answered
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      {!reviewMode && (
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-3 text-xs font-black">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              filterTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All ({totalQuestions})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('unanswered')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              filterTab === 'unanswered'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Unanswered ({unansweredIndices.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('flagged')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              filterTab === 'flagged'
                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Flagged ({flaggedIndices.length})
          </button>
        </div>
      )}

      {/* Quick Jump Buttons */}
      {!reviewMode && (
        <div className="flex gap-2 mb-3">
          {nextUnanswered !== null && (
            <button
              type="button"
              onClick={() => {
                onSelect(nextUnanswered);
                if (onClose) onClose();
              }}
              className="flex-1 py-2 px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-[11px] font-black rounded-xl transition-all flex items-center justify-between"
            >
              <span>Next Unanswered</span>
              <span className="font-mono bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] px-1.5 py-0.2 rounded-md">
                Q{nextUnanswered + 1}
              </span>
            </button>
          )}

          {nextFlagged !== null && (
            <button
              type="button"
              onClick={() => {
                onSelect(nextFlagged);
                if (onClose) onClose();
              }}
              className="flex-1 py-2 px-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/60 text-[11px] font-black rounded-xl transition-all flex items-center justify-between"
            >
              <span className="flex items-center gap-1">
                <Flag className="w-3 h-3 fill-current" /> Flagged
              </span>
              <span className="font-mono bg-red-200/80 dark:bg-red-900 text-red-900 dark:text-red-100 text-[10px] px-1.5 py-0.2 rounded-md">
                Q{nextFlagged + 1}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Micro-Box Matrix Grid */}
      {visibleIndices.length === 0 ? (
        <div className="py-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500 italic">
          No questions in this filter tab.
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
          {visibleIndices.map((idx) => {
            const isCurrent = currentIndex === idx;
            const hasAnswered = answers[idx] !== undefined || stagedAnswers[idx] !== undefined;
            const isViewed = viewedQuestions.has(idx);
            const q = questions[idx];
            const isFlagged = Boolean(q && flaggedQuestionIds && flaggedQuestionIds.has(q.id));
            const questionNumber = idx + 1;

            let buttonStyle =
              'h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all relative select-none ';

            if (reviewMode && questions[idx]) {
              // Review Mode
              const isCorrect = answers[idx] === questions[idx].correct_index;
              const skipped = answers[idx] === undefined;
              if (skipped) {
                buttonStyle +=
                  'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700';
              } else if (isCorrect) {
                buttonStyle +=
                  'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800';
              } else {
                buttonStyle +=
                  'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-2 border-red-300 dark:border-red-800';
              }
            } else {
              // Exam / Simulation Mode
              if (hasAnswered) {
                buttonStyle += 'bg-indigo-600 text-white font-black shadow-xs shadow-indigo-200 dark:shadow-none hover:bg-indigo-700';
              } else if (isViewed) {
                buttonStyle +=
                  'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-2 border-amber-200 dark:border-amber-800/70 hover:border-amber-400';
              } else {
                buttonStyle +=
                  'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600';
              }
            }

            if (isCurrent && !reviewMode) {
              buttonStyle += ' ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-900 font-black scale-105 z-10 shadow-md';
            }

            return (
              <button
                key={idx}
                ref={isCurrent ? activeButtonRef : undefined}
                onClick={() => {
                  onSelect(idx);
                  if (onClose) onClose();
                }}
                className={buttonStyle}
                title={`Question ${questionNumber}${isFlagged ? ' (Flagged)' : ''}${hasAnswered ? ' (Answered)' : ''}`}
              >
                <span>{questionNumber}</span>

                {/* Flagged Tag Pin in Top-Right Corner */}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}

                {/* Check/X icons in review mode */}
                {reviewMode && questions[idx] && answers[idx] !== undefined && (
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    {answers[idx] === questions[idx].correct_index ? (
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

      {/* Legend Footer */}
      {!reviewMode && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-xs bg-indigo-600" /> Answered
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800" /> Viewed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" /> Unanswered
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Flagged
          </div>
        </div>
      )}
    </div>
  );
}
