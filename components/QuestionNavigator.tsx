import React from 'react';
import { CheckCircle, XCircle } from './AppIcons';

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
}

export default function QuestionNavigator({
  totalQuestions,
  currentIndex,
  answers,
  stagedAnswers,
  viewedQuestions,
  onSelect,
  reviewMode = false,
  questions = [],
  onClose
}: QuestionNavigatorProps) {
  return (
    <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100 max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-slate-800">Questions</h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="sr-only">Close</span>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const isCurrent = currentIndex === idx;
          const hasAnswered = answers[idx] !== undefined;
          const hasStaged = stagedAnswers[idx] !== undefined;
          const isViewed = viewedQuestions.has(idx);

          let buttonStyle = "w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center transition-all ";

          if (reviewMode && questions[idx]) {
            // Review Mode
            const isCorrect = answers[idx] === questions[idx].correct_index;
            const skipped = answers[idx] === undefined;
            if (skipped) {
              buttonStyle += "bg-slate-100 text-slate-400 border-2 border-slate-200";
            } else if (isCorrect) {
              buttonStyle += "bg-emerald-100 text-emerald-800 border-2 border-emerald-200";
            } else {
              buttonStyle += "bg-red-100 text-red-800 border-2 border-red-200";
            }
          } else {
            // Exam Mode
            if (hasAnswered || hasStaged) {
              buttonStyle += "bg-blue-600 text-white shadow-md shadow-blue-200";
            } else if (isViewed) {
              buttonStyle += "bg-orange-50 text-orange-600 border-2 border-orange-200";
            } else {
              buttonStyle += "bg-white text-slate-400 border-2 border-slate-100 hover:border-slate-300 hover:text-slate-600";
            }
          }

          if (isCurrent && !reviewMode) {
            buttonStyle += " ring-2 ring-offset-2 ring-blue-600 scale-110 z-10";
          }

          return (
            <button
              key={idx}
              onClick={() => {
                onSelect(idx);
                if (onClose) onClose();
              }}
              className={buttonStyle}
            >
              {reviewMode && questions[idx] ? (
                answers[idx] === questions[idx].correct_index ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : answers[idx] !== undefined ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )
              ) : (
                idx + 1
              )}
            </button>
          );
        })}
      </div>
      
      {!reviewMode && (
        <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-500 justify-center">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-blue-600"></div> Answered</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-orange-50 border-2 border-orange-200"></div> Viewed</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md border-2 border-slate-100"></div> Unviewed</div>
        </div>
      )}
    </div>
  );
}
