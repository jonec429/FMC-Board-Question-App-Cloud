'use client';

import React, { useState } from 'react';
import { Question } from '@/lib/types';
import { formatIteId } from '@/lib/iteQuestionMap';
import { X, CheckCircle } from './AppIcons';
import { Printer, FileText, Check, BookOpen } from 'lucide-react';
import QuestionStemDisplay from './QuestionStemDisplay';

interface PrintReviewModalProps {
  title: string;
  questions: Question[];
  onClose: () => void;
}

export default function PrintReviewModal({ title, questions, onClose }: PrintReviewModalProps) {
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [includeExplanations, setIncludeExplanations] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 print:hidden bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Export &amp; Print Review Packet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {title} • {questions.length} Questions
              </p>
            </div>
          </div>

          {/* Print Options */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeAnswers}
                onChange={e => {
                  setIncludeAnswers(e.target.checked);
                  if (!e.target.checked) setIncludeExplanations(false);
                }}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Include Answer Key</span>
            </label>

            {includeAnswers && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 animate-in fade-in">
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={e => setIncludeExplanations(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Include Explanations</span>
              </label>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 text-slate-900 bg-white print:p-0 print:overflow-visible">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {title}
                </h1>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  Family Medicine Residency Board Review • {questions.length} Questions
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                <span>Date: ____________________</span>
                <br />
                <span>Resident: ____________________</span>
              </div>
            </div>
            <div className="mt-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
              {includeAnswers
                ? includeExplanations
                  ? 'Faculty Teaching Guide & Full Answer Key'
                  : 'Teacher Answer Key'
                : 'Resident Review Worksheet (Answers Hidden)'}
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-6 divide-y divide-slate-200">
            {questions.map((q, idx) => {
              const iteId = formatIteId(q);
              return (
                <div key={q.id || idx} className="pt-5 space-y-3 break-inside-avoid">
                  <div className="flex items-start gap-2.5">
                    <span className="font-black text-base text-slate-900 min-w-6">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 space-y-1">
                      <QuestionStemDisplay
                        text={q.question_text}
                        className="text-sm font-medium leading-relaxed text-slate-900"
                      />
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider print:text-slate-400">
                        <span>Category: {q.category}</span>
                        {iteId && <span>• {iteId}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 gap-1.5 pl-8">
                    {q.options?.map((opt, optIdx) => {
                      const isCorrect = includeAnswers && optIdx === q.correct_index;
                      return (
                        <div
                          key={optIdx}
                          className={`text-xs p-2 rounded-lg flex items-start gap-2.5 border ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-950'
                              : 'bg-slate-50/50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 border ${
                              isCorrect
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="leading-snug flex-1">{opt}</span>
                          {isCorrect && (
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 shrink-0">
                              ✓ Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation if requested */}
                  {includeExplanations && q.explanation && (
                    <div className="ml-8 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                      <p className="font-bold text-[10px] uppercase tracking-wider text-slate-500">
                        Clinical Explanation &amp; Rationale:
                      </p>
                      <p className="leading-relaxed whitespace-pre-line">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
