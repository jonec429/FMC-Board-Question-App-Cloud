'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, TrendingUp, Target, BarChartIcon, Users, Search, 
  ChevronRight, Mail, AlertTriangle, CheckCircle, Clock, 
  ExternalLink
} from './AppIcons';
import { ArrowUpRight, Award, ShieldAlert } from 'lucide-react';
import { formatDisplayName, formatLastNameFirst } from '@/lib/utils';
import { formatAcademicYear } from '@/lib/academicYear';
import { openEmailCompose, generateCheckInEmail } from '@/lib/emailHelper';

export type MetricType = 'program_avg' | 'board_readiness' | 'at_risk' | 'total_users';

export interface ResidentStat {
  userId: string | null;
  name: string;
  last_name: string;
  email: string;
  pgy: string;
  label: string;
  advisor: string;
  curriculumAttempts: number;
  independentAttempts: number;
  totalAttempts: number;
  curriculumAvg: number;
  independentAvg: number | null;
  overallAvg: number;
  blocksCompleted: number;
  onTimePct: number;
  totalPoints: number;
  totalAttendance: number;
  academicRisk: 'red' | 'yellow' | 'green' | 'gray';
  complianceRisk: 'red' | 'yellow' | 'green' | 'gray';
  overdueCount: number;
  trendDelta: number | null;
  declining: boolean;
  riskReasons: string[];
  [key: string]: any;
}

interface AdminMetricModalProps {
  type: MetricType | null;
  onClose: () => void;
  residentStats: ResidentStat[];
  selectedYear: number;
  onSelectResident: (resident: ResidentStat) => void;
  onJumpToTab?: (tab: string) => void;
}

export default function AdminMetricModal({
  type,
  onClose,
  residentStats,
  selectedYear,
  onSelectResident,
  onJumpToTab,
}: AdminMetricModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'above70' | 'borderline' | 'below65' | 'red' | 'yellow'>('all');

  // Cohort computations
  const totalResidents = residentStats.length;
  const activeResidents = residentStats.filter(r => r.totalAttempts > 0);
  const activeCount = activeResidents.length;
  
  const programAvg = activeCount > 0
    ? activeResidents.reduce((a, r) => a + r.overallAvg, 0) / activeCount
    : 0;

  const curriculumResidents = residentStats.filter(r => r.curriculumAttempts > 0);
  const curriculumProgramAvg = curriculumResidents.length > 0
    ? curriculumResidents.reduce((a, r) => a + r.curriculumAvg, 0) / curriculumResidents.length
    : 0;

  const independentResidents = residentStats.filter(r => r.independentAttempts > 0 && r.independentAvg !== null);
  const indepProgramAvg = independentResidents.length > 0
    ? independentResidents.reduce((a, r) => a + (r.independentAvg || 0), 0) / independentResidents.length
    : 0;

  const onTimeAvg = residentStats.filter(r => r.blocksCompleted > 0).length > 0
    ? residentStats.filter(r => r.blocksCompleted > 0).reduce((a, r) => a + r.onTimePct, 0) / residentStats.filter(r => r.blocksCompleted > 0).length
    : 0;

  const above70Residents = residentStats.filter(r => r.curriculumAttempts > 0 && r.curriculumAvg >= 70);
  const borderlineResidents = residentStats.filter(r => r.curriculumAttempts > 0 && r.curriculumAvg >= 65 && r.curriculumAvg < 70);
  const below65Residents = residentStats.filter(r => r.curriculumAttempts > 0 && r.curriculumAvg < 65);

  const redFlagged = residentStats.filter(r => r.academicRisk === 'red' || r.complianceRisk === 'red');
  const yellowFlagged = residentStats.filter(r =>
    r.academicRisk !== 'red' && r.complianceRisk !== 'red' &&
    (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining)
  );

  // Group by PGY class
  const pgyBreakdown = useMemo(() => {
    const groups: Record<string, ResidentStat[]> = {};
    residentStats.forEach(r => {
      const p = r.label || 'Other';
      if (!groups[p]) groups[p] = [];
      groups[p].push(r);
    });
    return Object.entries(groups).map(([label, list]) => {
      const active = list.filter(r => r.totalAttempts > 0);
      const avg = active.length > 0 ? active.reduce((a, r) => a + r.overallAvg, 0) / active.length : 0;
      const onTarget = list.filter(r => r.curriculumAttempts > 0 && r.curriculumAvg >= 70).length;
      return {
        label,
        count: list.length,
        activeCount: active.length,
        avg,
        onTarget,
        onTargetPct: list.length > 0 ? Math.round((onTarget / list.length) * 100) : 0,
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [residentStats]);

  // Score distribution tiers
  const distributionTiers = useMemo(() => {
    const t80 = activeResidents.filter(r => r.overallAvg >= 80).length;
    const t70 = activeResidents.filter(r => r.overallAvg >= 70 && r.overallAvg < 80).length;
    const t60 = activeResidents.filter(r => r.overallAvg >= 60 && r.overallAvg < 70).length;
    const tBelow = activeResidents.filter(r => r.overallAvg < 60).length;
    return [
      { label: 'Mastery (≥ 80%)', count: t80, pct: activeCount > 0 ? Math.round((t80 / activeCount) * 100) : 0, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
      { label: 'Target (70% - 79%)', count: t70, pct: activeCount > 0 ? Math.round((t70 / activeCount) * 100) : 0, color: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
      { label: 'Borderline (60% - 69%)', count: t60, pct: activeCount > 0 ? Math.round((t60 / activeCount) * 100) : 0, color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
      { label: 'At Risk (< 60%)', count: tBelow, pct: activeCount > 0 ? Math.round((tBelow / activeCount) * 100) : 0, color: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
    ];
  }, [activeResidents, activeCount]);

  // Filtered resident list for display inside modal
  const filteredResidents = useMemo(() => {
    let base = residentStats;

    if (type === 'board_readiness') {
      if (filterCategory === 'above70') base = above70Residents;
      else if (filterCategory === 'borderline') base = borderlineResidents;
      else if (filterCategory === 'below65') base = below65Residents;
    } else if (type === 'at_risk') {
      if (filterCategory === 'red') base = redFlagged;
      else if (filterCategory === 'yellow') base = yellowFlagged;
      else base = [...redFlagged, ...yellowFlagged];
    }

    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.advisor || '').toLowerCase().includes(q) ||
      r.label.toLowerCase().includes(q)
    );
  }, [type, residentStats, filterCategory, searchTerm, above70Residents, borderlineResidents, below65Residents, redFlagged, yellowFlagged]);

  if (!type) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-3.5 min-w-0">
            {type === 'program_avg' && (
              <div className="w-12 h-12 bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
            )}
            {type === 'board_readiness' && (
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                <Target className="w-6 h-6" />
              </div>
            )}
            {type === 'at_risk' && (
              <div className="w-12 h-12 bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                <BarChartIcon className="w-6 h-6" />
              </div>
            )}
            {type === 'total_users' && (
              <div className="w-12 h-12 bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                <Users className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight truncate">
                  {type === 'program_avg' && 'Program Performance & Distribution'}
                  {type === 'board_readiness' && 'Board Readiness & 70% Benchmark'}
                  {type === 'at_risk' && 'Flagged & At-Risk Resident Cohort'}
                  {type === 'total_users' && 'Cohort Demographics & Engagement'}
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                {selectedYear === 0 ? 'All-Time Cumulative Data' : `${formatAcademicYear(selectedYear)} Academic Year`} · {residentStats.length} Residents Evaluated
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all shrink-0 cursor-pointer"
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* VIEW 1: PROGRAM AVG */}
          {type === 'program_avg' && (
            <div className="space-y-6">
              {/* Highlight KPI Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
                  <div className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300">{programAvg.toFixed(1)}%</div>
                  <div className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-1">Overall Avg</div>
                </div>
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300">{curriculumProgramAvg.toFixed(1)}%</div>
                  <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">Curriculum Avg</div>
                </div>
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">{onTimeAvg.toFixed(0)}%</div>
                  <div className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mt-1">On-Time Rate</div>
                </div>
                <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
                  <div className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300">{indepProgramAvg > 0 ? `${indepProgramAvg.toFixed(1)}%` : '—'}</div>
                  <div className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest mt-1">Independent Avg</div>
                </div>
              </div>

              {/* Score Distribution Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Cohort Score Distribution</h3>
                  <span className="text-[11px] font-bold text-slate-400">{activeCount} Active Residents</span>
                </div>
                <div className="space-y-2.5">
                  {distributionTiers.map(tier => (
                    <div key={tier.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className={tier.text}>{tier.label}</span>
                        <span className="text-slate-600 dark:text-slate-300">{tier.count} residents ({tier.pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${tier.color} transition-all duration-500`} style={{ width: `${tier.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PGY Class Averages */}
              <div>
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">Average By Class Year</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {pgyBreakdown.map(p => (
                    <div key={p.label} className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-800 dark:text-white">{p.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-md">
                          {p.count} residents
                        </span>
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {p.avg > 0 ? `${p.avg.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {p.onTarget} on target (≥70%) · {p.onTargetPct}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: BOARD READINESS (ABOVE 70%) */}
          {type === 'board_readiness' && (
            <div className="space-y-6">
              {/* Benchmark Summary Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                    {Math.round((above70Residents.length / (curriculumResidents.length || 1)) * 100)}%
                  </div>
                  <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Above 70% Target</div>
                  <p className="text-xs font-bold text-emerald-800/80 dark:text-emerald-300/80 mt-1">{above70Residents.length} of {curriculumResidents.length} residents</p>
                </div>
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-blue-700 dark:text-blue-300">
                    {Math.round(((above70Residents.length + borderlineResidents.length) / (curriculumResidents.length || 1)) * 100)}%
                  </div>
                  <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Passing Threshold (≥65%)</div>
                  <p className="text-xs font-bold text-blue-800/80 dark:text-blue-300/80 mt-1">{above70Residents.length + borderlineResidents.length} meeting standard</p>
                </div>
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-amber-700 dark:text-amber-400">
                    {below65Residents.length}
                  </div>
                  <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1">Below Standard (&lt;65%)</div>
                  <p className="text-xs font-bold text-amber-800/80 dark:text-amber-300/80 mt-1">Requires academic reinforcement</p>
                </div>
              </div>

              {/* Class-by-Class Readiness Progress */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Class Year Readiness Rate</h3>
                <div className="space-y-3">
                  {pgyBreakdown.map(p => (
                    <div key={p.label} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-800 dark:text-slate-200">{p.label}</span>
                        <span className="text-slate-600 dark:text-slate-400">{p.onTarget} of {p.count} residents on track ({p.onTargetPct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${p.onTargetPct >= 70 ? 'bg-emerald-500' : p.onTargetPct >= 50 ? 'bg-amber-500' : 'bg-red-500'} transition-all duration-500`} style={{ width: `${p.onTargetPct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filter Tabs for resident table */}
              <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  All Evaluated ({curriculumResidents.length})
                </button>
                <button
                  onClick={() => setFilterCategory('above70')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'above70' ? 'bg-emerald-600 text-white' : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'}`}
                >
                  Target ≥70% ({above70Residents.length})
                </button>
                <button
                  onClick={() => setFilterCategory('borderline')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'borderline' ? 'bg-amber-600 text-white' : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'}`}
                >
                  Borderline 65–69% ({borderlineResidents.length})
                </button>
                <button
                  onClick={() => setFilterCategory('below65')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'below65' ? 'bg-red-600 text-white' : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'}`}
                >
                  Below 65% ({below65Residents.length})
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: AT RISK */}
          {type === 'at_risk' && (
            <div className="space-y-6">
              {/* Alert Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-red-50/80 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-red-600 dark:text-red-400">{redFlagged.length}</div>
                  <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-1">High Risk (Red Flag)</div>
                  <p className="text-xs font-bold text-red-700/80 dark:text-red-300/80 mt-1">Immediate intervention needed</p>
                </div>
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{yellowFlagged.length}</div>
                  <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Needs Attention (Yellow Flag)</div>
                  <p className="text-xs font-bold text-amber-700/80 dark:text-amber-300/80 mt-1">Borderline score or overdue block</p>
                </div>
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="text-base font-black text-blue-900 dark:text-blue-100">Advisor Actions</div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-bold mt-1">One-click check-in or review</p>
                  </div>
                  {onJumpToTab && (
                    <button
                      onClick={() => {
                        onClose();
                        onJumpToTab('at_risk');
                      }}
                      className="mt-3 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      Open Flagged Tab <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  All Flagged ({redFlagged.length + yellowFlagged.length})
                </button>
                <button
                  onClick={() => setFilterCategory('red')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'red' ? 'bg-red-600 text-white' : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'}`}
                >
                  Critical Red ({redFlagged.length})
                </button>
                <button
                  onClick={() => setFilterCategory('yellow')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterCategory === 'yellow' ? 'bg-amber-600 text-white' : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'}`}
                >
                  Warning Yellow ({yellowFlagged.length})
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: TOTAL USERS */}
          {type === 'total_users' && (
            <div className="space-y-6">
              {/* Cohort Stats Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-purple-700 dark:text-purple-300">{totalResidents}</div>
                  <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest mt-1">Total Residents</div>
                </div>
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{activeCount}</div>
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Active Users</div>
                  <p className="text-[10px] font-bold text-emerald-700/80 mt-0.5">{Math.round((activeCount / (totalResidents || 1)) * 100)}% participation</p>
                </div>
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-blue-700 dark:text-blue-300">
                    {residentStats.reduce((sum, r) => sum + r.blocksCompleted, 0)}
                  </div>
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Blocks Completed</div>
                </div>
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
                  <div className="text-3xl font-black text-amber-700 dark:text-amber-400">
                    {residentStats.reduce((sum, r) => sum + r.totalAttendance, 0)}
                  </div>
                  <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Attendance Points</div>
                </div>
              </div>

              {/* Class Demographics */}
              <div>
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">Class Distribution</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {pgyBreakdown.map(p => (
                    <div key={p.label} className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-800 dark:text-white">{p.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-md">
                          {p.count} residents
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                        {p.activeCount} active ({Math.round((p.activeCount / (p.count || 1)) * 100)}%)
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                        Class Avg: {p.avg > 0 ? `${p.avg.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Search & Filterable Resident List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {type === 'at_risk' ? 'Flagged Residents' : 'Resident Roster & Standings'} ({filteredResidents.length})
              </h3>
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search resident..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {filteredResidents.slice(0, 50).map(r => {
                const isRed = r.academicRisk === 'red' || r.complianceRisk === 'red';
                const isYellow = !isRed && (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining);
                return (
                  <div
                    key={r.email}
                    onClick={() => onSelectResident(r)}
                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRed ? 'bg-red-500' : isYellow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {formatLastNameFirst(r.name, r.last_name)}
                          </p>
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            {r.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {r.advisor ? `Advisor: ${r.advisor} · ` : ''}
                          {r.blocksCompleted} blocks done · {r.totalAttempts} total attempts
                        </p>
                        {r.riskReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.riskReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${reason.includes('overdue') ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'}`}
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {r.totalAttempts > 0 ? `${r.overallAvg.toFixed(1)}%` : '—'}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400">Total Avg</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const mailData = generateCheckInEmail({
                            residentName: r.name,
                            residentEmail: r.email,
                            senderName: 'Faculty Advisor',
                            statsSummary: `Overall Score: ${r.overallAvg.toFixed(1)}%, Blocks Done: ${r.blocksCompleted}`,
                          });
                          openEmailCompose(mailData);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={`Send check-in email to ${r.name}`}
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
                    </div>
                  </div>
                );
              })}
              {filteredResidents.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs">
                  No residents match your search or filter.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-400">
            Click any resident to view their full Clinical Competency Dossier
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
