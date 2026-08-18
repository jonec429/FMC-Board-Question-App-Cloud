'use client';

import React, { useState } from 'react';

export interface QuizReviewItem {
  question: any;
  selected: number | null | undefined;
}

/**
 * Read-only review of a completed quiz: every question with its options (the
 * correct answer and the resident's pick both marked) and the explanation.
 * Reused by Quiz-mode's end-of-quiz screen and the "Past Quizzes" review under
 * My Performance.
 */
export default function QuizReview({ items }: { items: QuizReviewItem[] }) {
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  if (!items || items.length === 0) {
    return <p className="text-center text-slate-400 text-sm italic py-6">No questions to review.</p>;
  }

  const incorrectCount = items.filter(({ question: q, selected }) => {
    if (!q) return false;
    return selected !== q.correct_index;
  }).length;

  const correctCount = items.filter(({ question: q, selected }) => {
    if (!q) return false;
    return selected === q.correct_index;
  }).length;

  const filteredItems = items.map((item, originalIndex) => ({ ...item, originalIndex })).filter(({ question: q, selected }) => {
    if (!q) return true;
    const isCorrect = selected === q.correct_index;
    if (filter === 'incorrect') return !isCorrect;
    if (filter === 'correct') return isCorrect;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Review Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Questions
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${filter === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'}`}>
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('incorrect')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filter === 'incorrect'
              ? 'bg-red-600 text-white shadow-sm shadow-red-200'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          Missed / Incorrect
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${filter === 'incorrect' ? 'bg-red-700 text-white' : 'bg-red-200/80 text-red-800'}`}>
            {incorrectCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('correct')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filter === 'correct'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          Correct
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${filter === 'correct' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/80 text-emerald-800'}`}>
            {correctCount}
          </span>
        </button>
      </div>

      {filteredItems.length === 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center">
          <p className="text-sm font-bold text-slate-600">
            {filter === 'incorrect' ? '🎉 Perfect Score! No missed questions to review.' : 'No matching questions found.'}
          </p>
        </div>
      )}

      {filteredItems.map(({ question: q, selected, originalIndex }) => {
        if (!q) {
          return (
            <div key={originalIndex} className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 italic">
              {originalIndex + 1}. This question is no longer available.
            </div>
          );
        }
        const correct = q.correct_index;
        const skipped = selected === null || selected === undefined;
        const isCorrect = !skipped && selected === correct;
        const options: string[] = Array.isArray(q.options) ? q.options : [];
        return (
          <div
            key={q.id || originalIndex}
            id={`review-question-${originalIndex}`}
            className={`bg-white rounded-2xl border p-6 ${skipped ? 'border-slate-200' : isCorrect ? 'border-emerald-100' : 'border-red-100'}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-bold text-slate-800 text-sm">{originalIndex + 1}. {q.question_text}</p>
              <span
                className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${skipped ? 'bg-slate-100 text-slate-500' : isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}
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
                    className={`px-3 py-2 rounded-xl text-sm font-medium flex items-start gap-2 ${isAns ? 'bg-emerald-50 text-emerald-700 font-bold' : isPicked ? 'bg-red-50 text-red-600' : 'text-slate-500'}`}
                  >
                    <span className="shrink-0">{String.fromCharCode(65 + oi)}.</span>
                    <span className="flex-1">{opt}</span>
                    {isAns && <span className="shrink-0 text-[9px] font-black uppercase tracking-widest mt-0.5">Correct</span>}
                    {isPicked && !isAns && <span className="shrink-0 text-[9px] font-black uppercase tracking-widest mt-0.5">Your answer</span>}
                  </div>
                );
              })}
            </div>
            {q.explanation && (
              <div className="mt-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">{q.explanation}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

