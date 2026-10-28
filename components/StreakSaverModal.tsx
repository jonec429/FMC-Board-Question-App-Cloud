'use client';

import React from 'react';
import { StreakSaverStatus } from '@/lib/streakSaver';
import { X, Sparkles, CheckCircle, AlertTriangle } from './AppIcons';
import { Shield, Flame, RotateCcw, Award, Check, Lock, BookOpen } from 'lucide-react';

interface StreakSaverModalProps {
  status: StreakSaverStatus;
  onClose: () => void;
  onStartChallenge: () => void;
}

export default function StreakSaverModal({
  status,
  onClose,
  onStartChallenge,
}: StreakSaverModalProps) {
  const passingQuestionsCount = Math.ceil(status.nextSaveQuestionCount * 0.65);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white relative overflow-hidden flex items-start justify-between">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 text-white shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight">Streak Saver</h3>
                <span className="px-2 py-0.5 bg-black/20 backdrop-blur-sm text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                  {status.academicYearLabel}
                </span>
              </div>
              <p className="text-xs text-amber-100 font-medium">
                Save your streak after a missed day with a rapid review challenge.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="relative z-10 p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-600 dark:text-slate-300">
          {/* Annual Saves Quota (3 Shields) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Annual Saves ({status.savesRemaining} of {status.maxSavesPerYear} remaining)
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Resets July 1
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { saveNum: 1, qCount: 5 },
                { saveNum: 2, qCount: 10 },
                { saveNum: 3, qCount: 15 },
              ].map(tier => {
                const isUsed = tier.saveNum <= status.savesUsedThisYear;
                const isNext = tier.saveNum === status.savesUsedThisYear + 1;

                return (
                  <div
                    key={tier.saveNum}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition-all ${
                      isUsed
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60'
                        : isNext
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 shadow-xs ring-1 ring-amber-400/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {isUsed ? (
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                      ) : isNext ? (
                        <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="font-black text-xs">Save #{tier.saveNum}</span>
                    </div>
                    <span className="text-[10px] font-bold">
                      {isUsed ? 'Used' : `${tier.qCount} Questions`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Streak Situation */}
          {status.isStreakBroken ? (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/80 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-orange-900 dark:text-orange-100">
                  Streak Broken ({status.brokenStreakLength} Days)
                </h4>
                <p className="text-orange-800 dark:text-orange-200 leading-relaxed text-[11px]">
                  You missed your QOTD on <strong className="font-bold">{status.missedDate || 'a recent weekday'}</strong>. Complete the review challenge below to restore your full <strong className="font-bold">{status.brokenStreakLength}-day streak</strong>!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                  Your Streak is Active!
                </h4>
                <p className="text-emerald-800 dark:text-emerald-200 leading-relaxed text-[11px]">
                  You have not missed a QOTD day. If you ever miss one in the future, Streak Saver will be right here to restore it!
                </p>
              </div>
            </div>
          )}

          {/* Challenge Requirements */}
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Challenge Requirements:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    {status.nextSaveQuestionCount} Random Questions
                  </span>
                  <span className="text-[10px] text-slate-400">
                    From latest ITE ({status.mostRecentYear})
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Score ≥ 65% Required
                  </span>
                  <span className="text-[10px] text-slate-400">
                    At least {passingQuestionsCount} of {status.nextSaveQuestionCount} correct
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
          {status.savesRemaining === 0 ? (
            <div className="text-center py-2 text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>All 3 streak saves used for {status.academicYearLabel}. Resets July 1.</span>
            </div>
          ) : status.isStreakBroken ? (
            <button
              type="button"
              onClick={onStartChallenge}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.01] active:scale-95"
            >
              <Shield className="w-5 h-5" />
              <span>Start Streak Saver ({status.nextSaveQuestionCount} Questions)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all text-center"
            >
              Got It
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
