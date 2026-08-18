import React, { useEffect, useRef } from 'react';
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
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeButtonRef.current) {
      activeButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  // Find next unanswered question starting from currentIndex + 1
  let nextUnansweredIndex = -1;
  let unansweredCount = 0;
  for (let i = 0; i < totalQuestions; i++) {
    if (answers[i] === undefined && stagedAnswers[i] === undefined) {
      unansweredCount++;
    }
  }

  if (unansweredCount > 0) {
    for (let i = 1; i < totalQuestions; i++) {
      const candidate = (currentIndex + i) % totalQuestions;
      if (answers[candidate] === undefined && stagedAnswers[candidate] === undefined) {
        nextUnansweredIndex = candidate;
        break;
      }
    }
  }

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-3xl shadow-xl border border-slate-100 max-h-[calc(100vh-14rem)] sm:max-h-[75vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-slate-800 text-sm sm:text-base">Questions</h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="sr-only">Close</span>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {!reviewMode && nextUnansweredIndex !== -1 && (
        <button
          type="button"
          onClick={() => {
            onSelect(nextUnansweredIndex);
            if (onClose) onClose();
          }}
          className="w-full mb-3 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black rounded-xl transition-all flex items-center justify-between shadow-xs"
        >
          <span>Next Unanswered (Q{nextUnansweredIndex + 1})</span>
          <span className="bg-blue-200/80 text-blue-800 text-[10px] px-1.5 py-0.5 rounded-md font-black">
            {unansweredCount} left
          </span>
        </button>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const isCurrent = currentIndex === idx;
          const hasAnswered = answers[idx] !== undefined;
          const hasStaged = stagedAnswers[idx] !== undefined;
          const isViewed = viewedQuestions.has(idx);

          let buttonStyle = "h-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all ";

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
              buttonStyle += "bg-blue-600 text-white shadow-sm shadow-blue-200";
            } else if (isViewed) {
              buttonStyle += "bg-orange-50 text-orange-600 border-2 border-orange-200";
            } else {
              buttonStyle += "bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-slate-600";
            }
          }

          if (isCurrent && !reviewMode) {
            buttonStyle += " ring-2 ring-offset-1 ring-blue-600 font-black scale-105 z-10";
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
            >
              {reviewMode && questions[idx] ? (
                <div className="flex items-center justify-center gap-1">
                  <span>{idx + 1}</span>
                  {answers[idx] === questions[idx].correct_index ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : answers[idx] !== undefined ? (
                    <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  ) : null}
                </div>
              ) : (
                <span>{idx + 1}</span>
              )}
            </button>
          );
        })}
      </div>
      
      {!reviewMode && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500 justify-center">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-blue-600"></div> Answered</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-orange-50 border border-orange-200"></div> Viewed</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm border border-slate-200"></div> Unviewed</div>
        </div>
      )}
    </div>
  );
}

