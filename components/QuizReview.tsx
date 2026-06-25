'use client';

import React from 'react';

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
  if (!items || items.length === 0) {
    return <p className="text-center text-slate-400 text-sm italic py-6">No questions to review.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map(({ question: q, selected }, idx) => {
        if (!q) {
          return (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 italic">
              {idx + 1}. This question is no longer available.
            </div>
          );
        }
        const correct = q.correct_index;
        const skipped = selected === null || selected === undefined;
        const isCorrect = !skipped && selected === correct;
        const options: string[] = Array.isArray(q.options) ? q.options : [];
        return (
          <div
            key={q.id || idx}
            id={`review-question-${idx}`}
            className={`bg-white rounded-2xl border p-6 ${skipped ? 'border-slate-200' : isCorrect ? 'border-emerald-100' : 'border-red-100'}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-bold text-slate-800 text-sm">{idx + 1}. {q.question_text}</p>
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
