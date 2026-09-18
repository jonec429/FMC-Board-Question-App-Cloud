'use client';

import React, { useState, useMemo } from 'react';
import { RosterEntry, AdminData } from '@/lib/types';
import { formatDisplayName } from '@/lib/utils';
import { formatAcademicYear, getCurrentAcademicYear } from '@/lib/academicYear';
import {
  computeCccReportData,
  getDateRangePreset,
  DateRangePreset,
  DateRangeConfig,
  CccResidentReportItem,
  formatPgyFull,
  exportCccCsv,
} from '@/lib/cccReporting';
import {
  Printer,
  X,
  Check,
  Users,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Calendar,
  FileText,
  Download,
  Info,
} from './AppIcons';

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
  adminData?: AdminData | null;
  initialSelectedEmail?: string;
  onClose: () => void;
}

export default function AdviseeDossierModal({
  facultyName,
  selectedYear,
  advisees,
  adminData,
  initialSelectedEmail,
  onClose,
}: AdviseeDossierModalProps) {
  const [filterEmail, setFilterEmail] = useState<string>(initialSelectedEmail || 'all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('6m');
  const [reportLayout, setReportLayout] = useState<'combined' | 'matrix' | 'dossiers'>('combined');

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Derive active date range
  const activeDateRange: DateRangeConfig = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        preset: 'custom',
        startDate: customStartDate,
        endDate: customEndDate,
        label: `Custom Evaluation Window (${customStartDate} to ${customEndDate})`,
      };
    }
    return getDateRangePreset(datePreset, selectedYear || getCurrentAcademicYear());
  }, [datePreset, customStartDate, customEndDate, selectedYear]);

  // Compute date-bounded reports if adminData is available; otherwise adapt advisees array
  const reportItems = useMemo<CccResidentReportItem[]>(() => {
    const adviseeEmails = advisees.map((a) => (a.resident.email || '').toLowerCase());
    const targetEmails = filterEmail === 'all' ? adviseeEmails : [filterEmail.toLowerCase()];

    if (adminData) {
      return computeCccReportData({
        adminData,
        selectedEmails: targetEmails,
        dateRange: activeDateRange,
        academicYear: selectedYear || getCurrentAcademicYear(),
      });
    }

    // Fallback if adminData is not directly passed
    const filtered = filterEmail === 'all'
      ? advisees
      : advisees.filter((a) => (a.resident.email || '').toLowerCase() === filterEmail.toLowerCase());

    return filtered.map((a) => {
      const standing = a.isAtRisk
        ? 'Remediation / Review Needed'
        : a.isAttention
        ? 'Academic Monitoring'
        : 'Satisfactory Progress';

      return {
        id: a.resident.email,
        name: a.name,
        formattedName: formatDisplayName(a.name),
        lastNameFirst: a.name,
        email: a.resident.email,
        pgy: a.pgy,
        pgyLabel: formatPgyFull(a.pgy),
        advisor: facultyName,
        curriculumAvg: Math.round(a.curriculumAvg),
        curriculumAttempts: a.curriculumAttempts,
        blocksCompleted: a.blocksCompleted,
        requiredBlocksTotal: a.blocksCompleted + a.overdueCount,
        onTimeRate: Math.round(a.onTimePct),
        onTimeCount: Math.round((a.onTimePct / 100) * a.blocksCompleted),
        overdueCount: a.overdueCount,
        overdueBlockTitles: [],
        totalPoints: a.totalPoints,
        attendanceCount: 0,
        standing,
        standingColor: a.isAtRisk ? 'red' : a.isAttention ? 'amber' : 'emerald',
        academicRisk: a.isAtRisk ? 'red' : a.isAttention ? 'yellow' : 'green',
        complianceRisk: a.overdueCount >= 2 ? 'red' : a.overdueCount === 1 ? 'yellow' : 'green',
        trendDirection: 'stable',
        trendDelta: null,
        flags: a.riskReasons,
        narrativeSummary: `${formatDisplayName(a.name)} (${formatPgyFull(a.pgy)}) is in ${standing}. The resident maintains a curriculum exam average of ${Math.round(a.curriculumAvg)}% (${a.curriculumAvg >= 70 ? 'meets 70% program standard' : 'below 70% passing standard'}) with ${a.blocksCompleted} completed blocks and an on-time submission rate of ${Math.round(a.onTimePct)}%. Total academic engagement credit is ${a.totalPoints} points.`,
        weakCategories: a.weakCategories.map((w) => ({ ...w, percentage: Math.round(w.percentage) })),
        strongCategories: [],
        blockSubmissions: a.blockHistory.map((b) => ({
          topic: b.topic,
          score: b.score,
          total: b.total,
          percentage: Math.round(b.percentage),
          points: b.points,
          date: b.date,
          timingStatus: b.points >= 2 ? 'On-Time' : 'Late',
        })),
        meetings: a.meetingHistory.map((m) => ({ topic: m.topic, date: m.date })),
      };
    });
  }, [adminData, advisees, filterEmail, activeDateRange, selectedYear, facultyName]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    exportCccCsv(reportItems, activeDateRange.label);
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Toolbar (hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 print:hidden text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Advisee Performance Dossier (CCC Review Packet)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Semi-Annual Review & Clinical Competency Committee Summary
              </p>
            </div>
          </div>

          {/* Controls: Advisee selector, Date Range, Format, Actions */}
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Date Range Preset */}
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="6m">Past 6 Months (Semi-Annual CCC)</option>
              <option value="3m">Past 3 Months (Quarterly Review)</option>
              <option value="ay">Academic Year ({formatAcademicYear(selectedYear || getCurrentAcademicYear())})</option>
              <option value="all">All-Time Residency Record</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {/* Format toggle */}
            <div className="flex items-center rounded-xl bg-slate-200 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
              <button
                onClick={() => setReportLayout('combined')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  reportLayout === 'combined'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setReportLayout('matrix')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  reportLayout === 'matrix'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Matrix
              </button>
              <button
                onClick={() => setReportLayout('dossiers')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  reportLayout === 'dossiers'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Dossiers
              </button>
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1 active:scale-95"
              title="Download advisee report as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> CSV
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker (if chosen) */}
        {datePreset === 'custom' && (
          <div className="px-5 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 text-xs print:hidden">
            <span className="font-bold text-slate-700 dark:text-slate-300">Custom Evaluation Window:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
          </div>
        )}

        {/* Printable Document Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-white text-slate-900 print:overflow-visible print:p-0 print:space-y-6 print:text-black print:bg-white">
          
          {/* Institutional Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 print:border-black">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 print:text-blue-900 block">
                Ascension St. Vincent&apos;s Family Medicine Residency
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 print:text-black mt-0.5">
                Semi-Annual Advisee Academic & Performance Dossier
              </h1>
              <p className="text-xs text-slate-600 print:text-gray-700 mt-1">
                Faculty Advisor: <strong className="text-slate-900 print:text-black">{formatDisplayName(facultyName)}</strong> • Evaluation Window: <strong className="text-slate-900 print:text-black">{activeDateRange.label}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 print:text-gray-600">
              <p>Generated: {todayStr}</p>
              <p className="font-semibold text-slate-700 print:text-black">Confidential • For CCC Review</p>
            </div>
          </div>

          {/* Section 1: Cohort Overview Matrix */}
          {(reportLayout === 'matrix' || reportLayout === 'combined') && reportItems.length > 0 && (
            <div className="space-y-3 print-avoid-break">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 print:text-black">
                  Advisee Cohort Performance Matrix ({reportItems.length} Advisees)
                </h3>
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded-2xl print:rounded-none print:border-black">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider border-b-2 border-slate-300 print:bg-gray-100 print:text-black print:border-black">
                    <tr>
                      <th className="py-2.5 px-3">Advisee Name</th>
                      <th className="py-2.5 px-2">Training Level</th>
                      <th className="py-2.5 px-2 text-center">Curriculum Exam Avg</th>
                      <th className="py-2.5 px-2 text-center">Blocks Finished</th>
                      <th className="py-2.5 px-2 text-center">On-Time Rate</th>
                      <th className="py-2.5 px-2 text-center">Academic Points</th>
                      <th className="py-2.5 px-3 text-right">Committee Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-gray-300">
                    {reportItems.map((a) => (
                      <tr key={a.email} className="hover:bg-slate-50 print:hover:bg-transparent print-avoid-break">
                        <td className="py-2.5 px-3 font-bold text-slate-900 print:text-black">
                          {a.formattedName}
                          {a.flags.length > 0 && (
                            <span className="block text-[10px] font-bold text-red-700 print:text-black">
                              ⚠️ {a.flags[0]}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 print:text-black font-semibold">
                          {a.pgy}
                        </td>
                        <td className="py-2.5 px-2 text-center font-black text-slate-900 print:text-black">
                          <span className={a.curriculumAvg >= 70 ? 'text-emerald-700 print:text-black' : 'text-red-700 print:text-black'}>
                            {a.curriculumAttempts > 0 ? `${a.curriculumAvg}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800 print:text-black">
                          {a.blocksCompleted} of {a.requiredBlocksTotal}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold">
                          <span className={a.onTimeRate >= 75 ? 'text-emerald-700 print:text-black' : 'text-amber-700 print:text-black'}>
                            {a.blocksCompleted > 0 ? `${a.onTimeRate}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-black text-amber-700 print:text-black">
                          {a.totalPoints} pts
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              a.standing === 'Satisfactory Progress'
                                ? 'bg-emerald-100 text-emerald-800 print:border print:border-black print:bg-white print:text-black'
                                : a.standing === 'Academic Monitoring'
                                ? 'bg-amber-100 text-amber-800 print:border print:border-black print:bg-white print:text-black'
                                : 'bg-red-100 text-red-800 print:border-2 print:border-black print:bg-white print:text-black'
                            }`}
                          >
                            {a.standing}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Committee Glossary & Standing Parameters */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl print:rounded-none print:border-black print:bg-white text-xs space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 print:text-black uppercase tracking-wider text-[11px]">
                  <Info className="w-4 h-4 text-blue-600 print:text-black" />
                  <span>Clinical Competency Committee Guide & Metric Reference Key</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-600 print:text-gray-800 text-[11px]">
                  <div>
                    <strong className="text-slate-900 print:text-black block">Exam Avg Benchmark:</strong>
                    Goal is <strong>≥ 70%</strong> passing standard across monthly board preparation modules.
                  </div>
                  <div>
                    <strong className="text-slate-900 print:text-black block">On-Time Compliance:</strong>
                    Goal is <strong>≥ 75%</strong> on-time submission rate prior to module deadline.
                  </div>
                  <div>
                    <strong className="text-slate-900 print:text-black block">Curriculum Blocks:</strong>
                    Standardized monthly question modules aligned with ABFM blueprint.
                  </div>
                  <div>
                    <strong className="text-slate-900 print:text-black block">Academic Points:</strong>
                    Credit for timely module completions, didactic conferences, and advising sessions.
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 print:border-black">
                  <span className="font-bold text-slate-900 print:text-black block mb-1 text-[11px] uppercase tracking-wide">
                    Standing Parameter Criteria & Thresholds:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div className="p-2 bg-red-50 border border-red-200 rounded-xl print:border-black print:bg-white">
                      <span className="font-bold text-red-900 print:text-black block">🚨 Remediation Needed (At Risk)</span>
                      <ul className="list-disc list-inside text-slate-700 print:text-black space-y-0.5 mt-0.5">
                        <li>Exam average ≤ 50%</li>
                        <li>2+ past-due blocks</li>
                        <li>On-time compliance ≤ 50%</li>
                      </ul>
                    </div>
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl print:border-black print:bg-white">
                      <span className="font-bold text-amber-900 print:text-black block">⚠️ Academic Monitoring (Needs Attention)</span>
                      <ul className="list-disc list-inside text-slate-700 print:text-black space-y-0.5 mt-0.5">
                        <li>Exam average 51% – 65%</li>
                        <li>1 past-due block</li>
                        <li>On-time compliance 51% – 75%</li>
                        <li>Score trajectory drop ≥ 10%</li>
                      </ul>
                    </div>
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl print:border-black print:bg-white">
                      <span className="font-bold text-emerald-900 print:text-black block">✅ Satisfactory Progress (On Track)</span>
                      <ul className="list-disc list-inside text-slate-700 print:text-black space-y-0.5 mt-0.5">
                        <li>Exam average &gt; 65% (Goal: ≥ 70%)</li>
                        <li>0 past-due blocks</li>
                        <li>On-time compliance &gt; 75%</li>
                        <li>Stable/upward trajectory</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Individual Advisee Dossier Sheets */}
          {(reportLayout === 'dossiers' || reportLayout === 'combined') && (
            <div className="space-y-10">
              {reportItems.map((a) => (
                <div
                  key={a.email}
                  className="border-2 border-slate-300 rounded-3xl p-6 bg-white space-y-6 print:border-black print:rounded-none print:p-0 print:space-y-5 print-page-break"
                >
                  {/* Individual Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b-2 border-slate-900 print:border-black">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-slate-900 print:text-black">
                          {a.formattedName}
                        </h2>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 print:border print:border-black print:bg-white print:text-black text-xs font-bold rounded-full">
                          {a.pgyLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
                        {a.email} • Faculty Advisor: <strong className="text-slate-900 print:text-black">{formatDisplayName(facultyName)}</strong>
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                          a.standing === 'Satisfactory Progress'
                            ? 'bg-emerald-100 text-emerald-800 print:border print:border-black print:bg-white print:text-black'
                            : a.standing === 'Academic Monitoring'
                            ? 'bg-amber-100 text-amber-800 print:border print:border-black print:bg-white print:text-black'
                            : 'bg-red-100 text-red-800 print:border-2 print:border-black print:bg-white print:text-black'
                        }`}
                      >
                        {a.standing}
                      </span>
                    </div>
                  </div>

                  {/* Executive Narrative */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print:border print:border-black print:bg-white text-xs text-slate-800 print:text-black font-medium leading-relaxed">
                    {a.narrativeSummary}
                  </div>

                  {/* KPI Metrics with Stated Benchmarks */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center print-avoid-break">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 print:border-black print:bg-white">
                      <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                        Curriculum Exam Avg
                      </span>
                      <span className={`text-xl font-black block mt-0.5 ${a.curriculumAvg >= 70 ? 'text-emerald-700 print:text-black' : 'text-red-700 print:text-black'}`}>
                        {a.curriculumAttempts > 0 ? `${a.curriculumAvg}%` : '—'}
                      </span>
                      <span className="text-[9px] text-slate-400 print:text-gray-600 block">Target: ≥ 70%</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 print:border-black print:bg-white">
                      <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                        Blocks Completed
                      </span>
                      <span className="text-xl font-black text-slate-900 print:text-black block mt-0.5">
                        {a.blocksCompleted} of {a.requiredBlocksTotal}
                      </span>
                      <span className="text-[9px] text-slate-400 print:text-gray-600 block">
                        {a.overdueCount > 0 ? `${a.overdueCount} Past-Due` : 'Up to Date'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 print:border-black print:bg-white">
                      <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                        On-Time Submission Rate
                      </span>
                      <span className={`text-xl font-black block mt-0.5 ${a.onTimeRate >= 75 ? 'text-emerald-700 print:text-black' : 'text-amber-700 print:text-black'}`}>
                        {a.blocksCompleted > 0 ? `${a.onTimeRate}%` : '—'}
                      </span>
                      <span className="text-[9px] text-slate-400 print:text-gray-600 block">Target: ≥ 75%</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 print:border-black print:bg-white">
                      <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                        Academic Engagement Points
                      </span>
                      <span className="text-xl font-black text-amber-700 print:text-black block mt-0.5">
                        {a.totalPoints} Points
                      </span>
                      <span className="text-[9px] text-slate-400 print:text-gray-600 block">Quizzes, Didactics, Advising</span>
                    </div>
                  </div>

                  {/* Warning Flags if any */}
                  {a.flags.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl print:border-black print:bg-white print-avoid-break">
                      <span className="text-xs font-bold text-red-900 print:text-black block mb-1">
                        Academic & Compliance Warning Flags:
                      </span>
                      <ul className="list-disc list-inside text-xs text-red-800 print:text-black space-y-0.5">
                        {a.flags.map((rFlag, rIdx) => (
                          <li key={rIdx}>{rFlag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Category Breakdown / Weak Areas */}
                  <div className="print-avoid-break">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 print:text-black mb-2">
                      Identified Subject Growth Areas (Board Preparation Focus)
                    </h4>
                    {a.weakCategories.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {a.weakCategories.slice(0, 3).map((w, wIdx) => {
                          const isLow = w.percentage < 60;
                          return (
                            <div
                              key={wIdx}
                              className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
                                isLow
                                  ? 'bg-red-50 border-red-200 print:border-black print:bg-white'
                                  : 'bg-amber-50 border-amber-200 print:border-black print:bg-white'
                              }`}
                            >
                              <span className="font-bold text-slate-800 print:text-black truncate pr-2">
                                {w.category}
                              </span>
                              <span className="font-black whitespace-nowrap text-slate-900 print:text-black">
                                {w.percentage}% ({w.correct}/{w.total})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No subject category question breakdown data recorded.</p>
                    )}
                  </div>

                  {/* Block History & Advisor Meetings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-avoid-break">
                    {/* Block History */}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 print:text-black mb-2">
                        Curriculum Block Submissions ({a.blockSubmissions.length})
                      </h4>
                      <div className="border border-slate-300 rounded-xl overflow-hidden print:border-black text-xs">
                        {a.blockSubmissions.length > 0 ? (
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold print:bg-gray-100">
                              <tr>
                                <th className="py-1.5 px-2">Block</th>
                                <th className="py-1.5 px-2 text-right">Score</th>
                                <th className="py-1.5 px-2 text-center">Status</th>
                                <th className="py-1.5 px-2 text-right">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 print:divide-gray-200">
                              {a.blockSubmissions.slice(0, 8).map((b, bIdx) => (
                                <tr key={bIdx}>
                                  <td className="py-1.5 px-2 truncate max-w-[150px]" title={b.topic}>{b.topic}</td>
                                  <td className="py-1.5 px-2 text-right font-black">{b.percentage}%</td>
                                  <td className="py-1.5 px-2 text-center text-[10px] font-bold">{b.timingStatus}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-500 print:text-black">{b.date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="p-3 text-slate-400 italic">No curriculum blocks recorded in this window.</p>
                        )}
                      </div>
                    </div>

                    {/* Advisor Meetings */}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 print:text-black mb-2">
                        Advisor Meetings & Didactics ({a.meetings.length})
                      </h4>
                      <div className="border border-slate-300 rounded-xl overflow-hidden print:border-black text-xs">
                        {a.meetings.length > 0 ? (
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-bold print:bg-gray-100">
                              <tr>
                                <th className="py-1.5 px-2">Meeting Record</th>
                                <th className="py-1.5 px-2 text-right">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 print:divide-gray-200">
                              {a.meetings.map((m, mIdx) => (
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
                  <div className="pt-4 border-t-2 border-slate-900 print:border-black space-y-4 print-avoid-break">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 print:text-black mb-1">
                        Semi-Annual Meeting Action Plan & Goals:
                      </h4>
                      <div className="h-20 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-400 italic print:border-black print:h-24 print:text-gray-500">
                        Document strengths, targeted study goals, and remediation commitments...
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-3">
                      <div>
                        <div className="border-b border-slate-500 print:border-black pb-1"></div>
                        <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                          Resident Physician Signature &amp; Date
                        </p>
                      </div>
                      <div>
                        <div className="border-b border-slate-500 print:border-black pb-1"></div>
                        <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                          Faculty Advisor Signature &amp; Date ({formatDisplayName(facultyName)})
                        </p>
                      </div>
                      <div>
                        <div className="border-b border-slate-500 print:border-black pb-1"></div>
                        <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                          CCC Chairperson Signature &amp; Date
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Document Footer */}
          <div className="pt-4 border-t-2 border-slate-900 text-[10px] text-slate-500 text-center print:border-black print:text-gray-600">
            FMC Board Review App • Official Clinical Competency Committee (CCC) Academic Summary
          </div>
        </div>
      </div>
    </div>
  );
}
