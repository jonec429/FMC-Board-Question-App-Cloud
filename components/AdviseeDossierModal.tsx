'use client';

import React, { useState } from 'react';
import { RosterEntry } from '@/lib/types';
import { formatDisplayName } from '@/lib/utils';
import { formatAcademicYear } from '@/lib/academicYear';
import { Printer, X, Check, Users, Sparkles, AlertCircle, AlertTriangle, CheckCircle, Calendar } from './AppIcons';

export interface DossierAdviseeData {
  resident: RosterEntry;
  name: string;
  pgy: string;
  overallAvg: number;
  curriculumAvg: number;
  totalAttempts: number;
  curriculumAttempts: number;
  blocksCompleted: number;
  totalPoints: number;
  onTimePct: number;
  overdueCount: number;
  isAtRisk: boolean;
  isAttention: boolean;
  riskReasons: string[];
  weakCategories: Array<{ category: string; correct: number; total: number; percentage: number }>;
  blockHistory: Array<{ topic: string; score: number; total: number; percentage: number; points: number; date: string }>;
  meetingHistory: Array<{ topic: string; date: string }>;
}

interface AdviseeDossierModalProps {
  facultyName: string;
  selectedYear: number;
  advisees: DossierAdviseeData[];
  initialSelectedEmail?: string;
  onClose: () => void;
}

export default function AdviseeDossierModal({
  facultyName,
  selectedYear,
  advisees,
  initialSelectedEmail,
  onClose,
}: AdviseeDossierModalProps) {
  const [filterEmail, setFilterEmail] = useState<string>(initialSelectedEmail || 'all');

  const displayedAdvisees = filterEmail === 'all'
    ? advisees
    : advisees.filter((a) => a.resident.email.toLowerCase() === filterEmail.toLowerCase());

  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Toolbar (hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Advisee Performance Dossier (CCC Printout)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Semi-Annual Review & Clinical Competency Committee Summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter by advisee */}
            <select
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Advisees ({advisees.length})</option>
              {advisees.map((a) => (
                <option key={a.resident.email} value={a.resident.email}>
                  {a.name} ({a.pgy})
                </option>
              ))}
            </select>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 print:overflow-visible print:p-0 print:space-y-6 print:text-black print:bg-white">
          
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 print:border-black">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 print:text-blue-900 block">
                Ascension St. Vincent&apos;s Family Medicine Residency
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white print:text-black mt-0.5">
                Semi-Annual Advisee Academic & Performance Dossier
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 print:text-gray-600 mt-1">
                Faculty Advisor: <strong className="text-slate-900 dark:text-white print:text-black">{formatDisplayName(facultyName)}</strong> • Academic Year: <strong className="text-slate-900 dark:text-white print:text-black">{selectedYear ? formatAcademicYear(selectedYear) : 'All Time'}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400 print:text-gray-500">
              <p>Generated: {todayStr}</p>
              <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Confidential • For CCC Review</p>
            </div>
          </div>

          {/* Section 1: Cohort Overview Matrix (if printing all advisees) */}
          {filterEmail === 'all' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black">
                  Cohort Performance Matrix ({advisees.length} Advisees)
                </h3>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl print:rounded-none print:border-black">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 print:bg-gray-100 print:text-black print:border-black">
                    <tr>
                      <th className="py-2.5 px-3">Advisee Name</th>
                      <th className="py-2.5 px-2">PGY</th>
                      <th className="py-2.5 px-2 text-right">Core Avg</th>
                      <th className="py-2.5 px-2 text-center">Blocks</th>
                      <th className="py-2.5 px-2 text-right">On-Time</th>
                      <th className="py-2.5 px-2 text-right">Total AP</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-gray-300">
                    {advisees.map((a) => (
                      <tr key={a.resident.email} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 print:hover:bg-transparent">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white print:text-black">
                          {a.name}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 print:text-black">
                          {a.pgy}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900 dark:text-white print:text-black">
                          {a.curriculumAttempts > 0 ? `${a.curriculumAvg.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-medium">
                          {a.blocksCompleted}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">
                          {a.onTimePct.toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-amber-600 dark:text-amber-400 print:text-black">
                          {a.totalPoints} AP
                        </td>
                        <td className="py-2.5 px-3">
                          {a.isAtRisk ? (
                            <span className="font-bold text-red-600 print:text-black">🚨 At Risk</span>
                          ) : a.isAttention ? (
                            <span className="font-bold text-amber-600 print:text-black">⚠️ Needs Attention</span>
                          ) : (
                            <span className="font-bold text-emerald-600 print:text-black">✅ On Track</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: Individual Advisee Dossier Sheets */}
          <div className="space-y-10">
            {displayedAdvisees.map((a, idx) => (
              <div
                key={a.resident.email}
                className="border border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50/50 dark:bg-slate-900/50 space-y-6 print:border-black print:rounded-none print:p-4 print:bg-white print:break-after-page print:mb-6"
              >
                {/* Individual Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 print:border-black">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white print:text-black">
                        {a.name}
                      </h2>
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 print:bg-gray-200 print:text-black text-xs font-bold rounded-full">
                        {a.pgy}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 mt-0.5">
                      {a.resident.email} • Advisor: {formatDisplayName(facultyName)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.isAtRisk ? (
                      <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 print:border print:border-black print:text-black text-xs font-bold rounded-lg">
                        🚨 AT RISK
                      </span>
                    ) : a.isAttention ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 print:border print:border-black print:text-black text-xs font-bold rounded-lg">
                        ⚠️ NEEDS ATTENTION
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 print:border print:border-black print:text-black text-xs font-bold rounded-lg">
                        ✅ ON TRACK
                      </span>
                    )}
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 print:text-gray-600 block">
                      Core Avg Score
                    </span>
                    <span className="text-xl font-black text-slate-900 dark:text-white print:text-black">
                      {a.curriculumAttempts > 0 ? `${a.curriculumAvg.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 print:text-gray-600 block">
                      Blocks Completed
                    </span>
                    <span className="text-xl font-black text-slate-900 dark:text-white print:text-black">
                      {a.blocksCompleted}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 print:text-gray-600 block">
                      On-Time Compliance
                    </span>
                    <span className="text-xl font-black text-slate-900 dark:text-white print:text-black">
                      {a.onTimePct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 print:text-gray-600 block">
                      Academic Points
                    </span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 print:text-black">
                      {a.totalPoints} AP
                    </span>
                  </div>
                </div>

                {/* Risk Flags if any */}
                {a.riskReasons.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl print:border-black print:bg-white">
                    <span className="text-xs font-bold text-red-800 dark:text-red-300 print:text-black block mb-1">
                      Academic & Compliance Warning Flags:
                    </span>
                    <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-400 print:text-black space-y-0.5">
                      {a.riskReasons.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Category Breakdown / Weak Areas */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2">
                    Top Remediation & Weak Areas
                  </h4>
                  {a.weakCategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {a.weakCategories.slice(0, 3).map((w, wIdx) => {
                        const isLow = w.percentage < 50;
                        const isMid = w.percentage >= 50 && w.percentage < 65;
                        return (
                          <div
                            key={wIdx}
                            className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                              isLow
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 print:border-black print:bg-white'
                                : isMid
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 print:border-black print:bg-white'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 print:border-black print:bg-white'
                            }`}
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black truncate pr-2">
                              {w.category}
                            </span>
                            <span className="font-black whitespace-nowrap text-slate-900 dark:text-white print:text-black">
                              {w.percentage.toFixed(0)}% ({w.correct}/{w.total})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No question breakdown data logged yet.</p>
                  )}
                </div>

                {/* Block History & Advisor Meetings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Block History */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2">
                      Curriculum Block Submissions ({a.blockHistory.length})
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden print:border-black text-xs">
                      {a.blockHistory.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 font-bold print:bg-gray-100">
                            <tr>
                              <th className="py-1.5 px-2">Block</th>
                              <th className="py-1.5 px-2 text-right">Score</th>
                              <th className="py-1.5 px-2 text-right">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-gray-200">
                            {a.blockHistory.map((b, bIdx) => (
                              <tr key={bIdx}>
                                <td className="py-1.5 px-2 truncate max-w-[160px]" title={b.topic}>{b.topic}</td>
                                <td className="py-1.5 px-2 text-right font-black">{b.percentage.toFixed(0)}%</td>
                                <td className="py-1.5 px-2 text-right font-bold text-amber-600 print:text-black">{b.points} AP</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-3 text-slate-400 italic">No curriculum blocks recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* Advisor Meetings */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2">
                      Advisor Meetings ({a.meetingHistory.length})
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden print:border-black text-xs">
                      {a.meetingHistory.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 font-bold print:bg-gray-100">
                            <tr>
                              <th className="py-1.5 px-2">Meeting Record</th>
                              <th className="py-1.5 px-2 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-gray-200">
                            {a.meetingHistory.map((m, mIdx) => (
                              <tr key={mIdx}>
                                <td className="py-1.5 px-2 truncate max-w-[180px]" title={m.topic}>{m.topic}</td>
                                <td className="py-1.5 px-2 text-right text-slate-500 print:text-black">{m.date || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-3 text-slate-400 italic">No advisor meetings logged for this cycle.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Semi-Annual Review Action Plan & Signature Block */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 print:border-black space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-1">
                      Semi-Annual Meeting Action Plan & Goals:
                    </h4>
                    <div className="h-20 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-400 italic print:border-black print:h-24">
                      Document strengths, targeted study goals, and remediation commitments...
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-4">
                    <div>
                      <div className="border-b border-slate-400 dark:border-slate-600 print:border-black pb-1"></div>
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-black mt-1">
                        Resident Signature &amp; Date
                      </p>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 dark:border-slate-600 print:border-black pb-1"></div>
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-black mt-1">
                        Faculty Advisor Signature &amp; Date ({formatDisplayName(facultyName)})
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Document Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 text-center print:border-black print:text-gray-600">
            FMC Board Review App • Official Clinical Competency Committee (CCC) Academic Summary
          </div>
        </div>
      </div>
    </div>
  );
}
