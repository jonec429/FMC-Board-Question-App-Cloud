'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName } from '@/lib/utils';
import { isAdmin, isFaculty, getFacultyAdviseeFilter } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear, deriveLabel, isActiveResident, isGraduated } from '@/lib/academicYear';
import { useSortState, sortItems, SortHeader, lastName } from '@/lib/sorting';
import { BarChartIcon, Users, Loader2, TrendingUp, Target, X, ChevronRight, Mail } from './AppIcons';
import QuestionHeatmap from './QuestionHeatmap';

type RiskLevel = 'red' | 'yellow' | 'green' | 'gray';

interface ResidentStat {
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

  academicRisk: RiskLevel;
  complianceRisk: RiskLevel;
  
  results: any[];
}

function getRiskLevel(pct: number, attempts: number): RiskLevel {
  if (attempts < 3) return 'gray';
  if (pct <= 50) return 'red';
  if (pct <= 65) return 'yellow';
  return 'green';
}

const riskColors: Record<RiskLevel, { row: string; badge: string; dot: string }> = {
  red: { row: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  yellow: { row: 'bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  green: { row: '', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  gray: { row: 'bg-slate-50/40', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

import { AdminData } from '@/lib/types';
import { useAdminData } from '@/hooks/useAdminData';

interface AdminPerformanceProps {
  user?: any;
  profile?: any;
}

type SubTab = 'overview' | 'at_risk' | 'by_pgy' | 'my_advisees' | 'heatmap';

export default function AdminPerformance({ user, profile }: AdminPerformanceProps) {
  const userIsAdmin = isAdmin(user, profile);
  const userIsFaculty = isFaculty(user, profile);
  const facultyName = getFacultyAdviseeFilter(user, profile);
  
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(
    !userIsAdmin && userIsFaculty && facultyName ? 'my_advisees' : 'overview'
  );

  const { data: adminData, loading, error } = useAdminData();
  const { roster, profiles, results: allResults } = adminData || { roster: [], profiles: [], results: [] };

  const [selectedResident, setSelectedResident] = useState<ResidentStat | null>(null);
  const [showGraduates, setShowGraduates] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());

  // Table sorting (shared across the resident tables; default = points desc)
  const { sortKey, sortDir, toggle } = useSortState({ key: 'points', dir: 'desc' });
  const residentAccessor = (r: ResidentStat, key: string): string | number => {
    switch (key) {
      case 'name': return r.last_name;
      case 'pgy': return r.label;
      case 'attempts': return r.totalAttempts;
      case 'avg': return r.overallAvg;
      case 'curriculumAvg': return r.curriculumAvg;
      case 'independentAvg': return r.independentAvg || 0;
      case 'blocks': return r.blocksCompleted;
      case 'ontime': return r.onTimePct;
      case 'points': return r.totalPoints;
      case 'academicRisk': return r.academicRisk === 'red' ? 0 : r.academicRisk === 'yellow' ? 1 : r.academicRisk === 'green' ? 2 : 3;
      case 'complianceRisk': return r.complianceRisk === 'red' ? 0 : r.complianceRisk === 'yellow' ? 1 : r.complianceRisk === 'green' ? 2 : 3;
      default: return 0;
    }
  };
  const sortRes = (list: ResidentStat[]) => sortItems(list, residentAccessor, sortKey, sortDir);

  const residentStats = useMemo(() => {
    if (!adminData) return [];
    const { results: allResults, profiles, roster } = adminData;
    const academicYear = selectedYear;

    const profileMap = new Map<string, string>();
    profiles.forEach((p: any) => {
      const email = p?.email || p?.user_email;
      if (p?.id && email) profileMap.set(p.id, email);
    });

    const enriched = allResults
      .filter((r: any) => (selectedYear === 0 || r.academic_year === selectedYear) && !r.topic?.toLowerCase().includes('demo'))
      .map((r: any) => ({
        ...r,
        email: r.legacy_email || (r.user_id ? profileMap.get(r.user_id) : null),
      }))
      .filter((r: any) => r.email);

    // Only active FM residents are scored. Faculty and fellows are excluded;
    // graduates are hidden unless the toggle is on.
    const scopedRoster = roster.filter((r: any) =>
      isActiveResident(r) || (showGraduates && isGraduated(r))
    );

    const stats: ResidentStat[] = scopedRoster.map((resident: any) => {
      const resResults = enriched.filter(
        (r: any) => r.email?.toLowerCase() === resident.email?.toLowerCase()
      );

      const assignedResults = resResults.filter((r: any) => (r.academic_points || 0) > 0);
      const independentResults = resResults.filter((r: any) => !r.academic_points || r.academic_points === 0);

      // Dedupe by topic — for each block, keep best timing (highest points)
      const topicBestPts = new Map<string, number>();
      assignedResults.forEach((r: any) => {
        const cur = topicBestPts.get(r.topic) || 0;
        topicBestPts.set(r.topic, Math.max(cur, r.academic_points || 0));
      });
      const blocksCompleted = topicBestPts.size;

      const nonBonusBlocks = Array.from(topicBestPts.entries()).filter(([topic]) => !topic?.toLowerCase().includes('bonus'));
      const onTimeBlocks = nonBonusBlocks.filter(([, pts]) => pts >= 2);
      const onTimePct = nonBonusBlocks.length > 0
        ? (onTimeBlocks.length / nonBonusBlocks.length) * 100
        : 100;

      const curriculumAvg = assignedResults.length > 0
        ? assignedResults.reduce((a: number, r: any) => a + (r.percentage || 0), 0) / assignedResults.length
        : 0;

      const independentAvg = independentResults.length > 0
        ? independentResults.reduce((a: number, r: any) => a + (r.percentage || 0), 0) / independentResults.length
        : null;

      const overallAvg = resResults.length > 0
        ? resResults.reduce((a: number, r: any) => a + (r.percentage || 0), 0) / resResults.length
        : 0;

      const totalPoints = Array.from(topicBestPts.values()).reduce((a, b) => a + b, 0);

      return {
        name: resident.name,
        last_name: resident.last_name || lastName(resident.name),
        email: resident.email,
        pgy: resident.pgy,
        label: deriveLabel(resident, academicYear),
        advisor: resident.advisor,
        
        curriculumAttempts: assignedResults.length,
        independentAttempts: independentResults.length,
        totalAttempts: resResults.length,

        curriculumAvg,
        independentAvg,
        overallAvg,

        blocksCompleted,
        onTimePct,
        totalPoints,
        
        academicRisk: getRiskLevel(curriculumAvg, assignedResults.length),
        complianceRisk: getRiskLevel(onTimePct, blocksCompleted),
        results: resResults.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      };
    });

    return stats.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [adminData, showGraduates, selectedYear]);

  // Residents this faculty advises — matched by `authorized_roster.advisor == profile.full_name`
  const myAdvisees = useMemo(() => {
    if (!facultyName) return [] as ResidentStat[];
    const needle = facultyName.toLowerCase().trim();
    return residentStats.filter(r => (r.advisor || '').toLowerCase().trim() === needle);
  }, [residentStats, facultyName]);

  const redFlagged = residentStats.filter(r => r.academicRisk === 'red' || r.complianceRisk === 'red');
  const yellowFlagged = residentStats.filter(r => r.academicRisk === 'yellow' || r.complianceRisk === 'yellow');
  const programAvg = residentStats.length > 0
    ? residentStats.filter(r => r.totalAttempts > 0).reduce((a, r) => a + r.overallAvg, 0) / (residentStats.filter(r => r.totalAttempts > 0).length || 1)
    : 0;
  const boardReadiness = Math.round(residentStats.filter(r => r.curriculumAttempts > 0 && r.curriculumAvg >= 65).length / (residentStats.filter(r => r.curriculumAttempts > 0).length || 1) * 100);
  const onTimeProgramAvg = residentStats.length > 0
    ? residentStats.filter(r => r.blocksCompleted > 0).reduce((a, r) => a + r.onTimePct, 0) / (residentStats.filter(r => r.blocksCompleted > 0).length || 1)
    : 0;

  const pgyGroups: Record<string, ResidentStat[]> = {};
  residentStats.forEach(r => {
    if (!pgyGroups[r.label]) pgyGroups[r.label] = [];
    pgyGroups[r.label].push(r);
  });

  const ResidentTable = ({ residents }: { residents: ResidentStat[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <SortHeader label="Resident" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-left px-6 py-3" />
            <SortHeader label="PGY" sortKey="pgy" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Pts" sortKey="points" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Curr Avg" sortKey="curriculumAvg" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Indep Avg" sortKey="independentAvg" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Total Avg" sortKey="avg" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="On-Time" sortKey="ontime" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Academic" sortKey="academicRisk" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Compliance" sortKey="complianceRisk" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {residents.map((r, i) => {
            // Overall row color uses the worse of the two risks
            let rowColor = riskColors.green.row;
            if (r.academicRisk === 'red' || r.complianceRisk === 'red') rowColor = riskColors.red.row;
            else if (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow') rowColor = riskColors.yellow.row;
            else if (r.academicRisk === 'gray' || r.complianceRisk === 'gray') rowColor = riskColors.gray.row;

            return (
              <tr key={i} className={`border-b border-slate-50 transition-all hover:brightness-95 cursor-pointer ${rowColor}`} onClick={() => setSelectedResident(r)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{formatDisplayName(r.name)}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center text-xs font-bold text-slate-500">{r.label}</td>
                <td className="px-4 py-4 text-center font-black text-slate-700 text-sm">{r.totalPoints}</td>
                <td className="px-4 py-4 text-center">
                  {r.curriculumAttempts > 0 ? (
                    <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.curriculumAvg > 65 ? 'text-emerald-700' : r.curriculumAvg > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.curriculumAvg.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center">
                  {r.independentAttempts > 0 && r.independentAvg !== null ? (
                    <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.independentAvg > 65 ? 'text-emerald-700' : r.independentAvg > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.independentAvg.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center">
                  {r.totalAttempts > 0 ? (
                    <span className="text-sm font-black text-slate-600">
                      {r.overallAvg.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center">
                  {r.blocksCompleted > 0 ? (
                    <span className={`text-sm font-bold ${r.onTimePct > 65 ? 'text-emerald-600' : r.onTimePct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.onTimePct.toFixed(0)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full ${riskColors[r.academicRisk].badge}`}>
                    {r.academicRisk === 'red' ? 'At Risk' : r.academicRisk === 'yellow' ? 'Attention' : r.academicRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full ${riskColors[r.complianceRisk].badge}`}>
                    {r.complianceRisk === 'red' ? 'At Risk' : r.complianceRisk === 'yellow' ? 'Attention' : r.complianceRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Performance Data...</p>
      </div>
    );
  }

  if (error || !adminData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-red-100 bg-red-50 shadow-sm">
        <p className="text-red-500 font-bold">{error?.toString() || 'Failed to load data.'}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Program Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800">{programAvg.toFixed(1)}%</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Program Avg</span>
        </div>
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3">
            <Target className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800">{boardReadiness}%</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Above 70%</span>
        </div>
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-3">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800">{redFlagged.length}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">At Risk</span>
        </div>
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800">{residentStats.length}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Residents</span>
        </div>
      </div>

      {/* Sub Tabs — faculty see a "My Advisees" tab unique to their account */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50 overflow-x-auto">
        {(() => {
          const baseTabs: [SubTab, string][] = [
            ['overview', 'Program Overview'],
            ['at_risk', `At Risk (${redFlagged.length + yellowFlagged.length})`],
            ['by_pgy', 'By Class Year'],
            ['heatmap', 'Trend Analysis'],
          ];
          // Faculty-only tab: appears first when user is faculty (admins can also pull it up if they have advisees)
          const tabs: [SubTab, string][] = userIsFaculty && facultyName
            ? [['my_advisees', `My Advisees (${myAdvisees.length})`], ...baseTabs]
            : baseTabs;
          return tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeSubTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ));
        })()}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value={0}>All Time (YoY Trend)</option>
            {getAvailableAcademicYears().map(year => (
              <option key={year} value={year}>{formatAcademicYear(year)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showGraduates}
              onChange={e => setShowGraduates(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            Show Graduates
          </label>
        </div>
      </div>

      {/* My Advisees Tab (faculty-focused view) */}
      {activeSubTab === 'my_advisees' && (
        <div className="bg-white rounded-[32px] border border-emerald-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-emerald-50 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <h3 className="font-black text-emerald-700">My Advisees</h3>
              <p className="text-xs font-bold text-emerald-600/70 mt-0.5">
                Residents assigned to {formatDisplayName(facultyName || '')} — click any row to view block history
              </p>
            </div>
            <div className="flex items-center gap-6">
              {myAdvisees.length > 0 && (
                <button 
                  onClick={() => {
                    const subject = encodeURIComponent("FMC QBank: Advisee Performance Update");
                    const body = encodeURIComponent(
                      "Hello,\n\nHere is a summary of your advisees' current performance in the FMC QBank:\n\n" + 
                      myAdvisees.map(r => {
                        const risk = (r.academicRisk === 'red' || r.complianceRisk === 'red') ? 'red' : (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow') ? 'yellow' : 'green';
                        return `- ${r.name}: ${r.overallAvg.toFixed(1)}% Avg | ${r.onTimePct.toFixed(0)}% On-Time | Status: ${risk === 'red' ? 'AT RISK' : risk === 'yellow' ? 'NEEDS ATTENTION' : 'ON TRACK'}`;
                      }).join('\n') +
                      "\n\nPlease reach out if you have any questions.\n\nThank you!"
                    );
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
                >
                  <Mail className="w-4 h-4" /> Email Report
                </button>
              )}
              <div className="text-right hidden sm:block">
                <div className="text-2xl font-black text-emerald-700">{myAdvisees.length}</div>
                <div className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest">Advisees</div>
              </div>
            </div>
          </div>
          {myAdvisees.length > 0 ? (
            <ResidentTable residents={sortRes(myAdvisees)} />
          ) : (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">No advisees assigned</p>
              <p className="text-xs text-slate-400 mt-1">
                Residents are mapped to faculty via the <code>advisor</code> column in the authorized roster.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {activeSubTab === 'overview' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800">All Residents</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Click a resident to view their block history</p>
            </div>
            <button 
              onClick={() => {
                // Group all residents by advisor
                const groups: Record<string, ResidentStat[]> = {};
                residentStats.forEach(r => {
                  const adv = r.advisor || 'Unassigned';
                  if (!groups[adv]) groups[adv] = [];
                  groups[adv].push(r);
                });
                
                let bodyStr = "Hello Faculty,\n\nHere is a summary of resident performance in the FMC QBank grouped by advisor:\n\n";
                Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([adv, resList]) => {
                  bodyStr += `\n=== ${adv} ===\n`;
                  resList.forEach(r => {
                    const risk = (r.academicRisk === 'red' || r.complianceRisk === 'red') ? 'red' : (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow') ? 'yellow' : 'green';
                    bodyStr += `- ${r.name}: ${r.overallAvg.toFixed(1)}% Avg | ${r.onTimePct.toFixed(0)}% On-Time | Status: ${risk === 'red' ? 'AT RISK' : risk === 'yellow' ? 'NEEDS ATTENTION' : 'ON TRACK'}\n`;
                  });
                });
                bodyStr += "\n\nLog in to the Admin Console for more details.\n\nThank you!";
                
                const subject = encodeURIComponent("FMC QBank: Program Performance Update");
                window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyStr)}`;
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <Mail className="w-4 h-4" /> Email Advisors
            </button>
          </div>
          <ResidentTable residents={sortRes(residentStats)} />
        </div>
      )}

      {/* At Risk Tab */}
      {activeSubTab === 'at_risk' && (
        <div className="space-y-6">
          {redFlagged.length > 0 && (
            <div className="bg-white rounded-[32px] border border-red-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-red-50 bg-red-50/40">
                <h3 className="font-black text-red-700">🔴 At Risk — Avg below 60% or On-Time below 50%</h3>
              </div>
              <ResidentTable residents={sortRes(redFlagged)} />
            </div>
          )}
          {yellowFlagged.length > 0 && (
            <div className="bg-white rounded-[32px] border border-amber-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-amber-50 bg-amber-50/40">
                <h3 className="font-black text-amber-700">🟡 Needs Attention — Avg below 70% or On-Time below 75%</h3>
              </div>
              <ResidentTable residents={sortRes(yellowFlagged)} />
            </div>
          )}
          {redFlagged.length === 0 && yellowFlagged.length === 0 && (
            <div className="bg-white rounded-[32px] border border-emerald-100 p-16 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="font-black text-emerald-700 text-xl">All Residents On Track</h3>
              <p className="text-slate-400 text-sm mt-2">No residents are currently flagged as at-risk.</p>
            </div>
          )}
        </div>
      )}

      {/* By PGY Tab */}
      {activeSubTab === 'by_pgy' && (
        <div className="space-y-6">
          {Object.entries(pgyGroups).sort(([a], [b]) => a.localeCompare(b)).map(([pgy, residents]) => {
            const groupAvg = residents.filter(r => r.totalAttempts > 0).reduce((a, r) => a + r.overallAvg, 0) / (residents.filter(r => r.totalAttempts > 0).length || 1);
            const groupPts = residents.reduce((a, r) => a + r.totalPoints, 0);
            return (
              <div key={pgy} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-800">{pgy}</h3>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-lg font-black text-slate-800">{groupAvg.toFixed(1)}%</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Avg</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-slate-800">{groupPts}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pts</div>
                    </div>
                  </div>
                </div>
                <ResidentTable residents={sortRes(residents)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Heatmap Tab */}
      {activeSubTab === 'heatmap' && adminData && (
        <QuestionHeatmap adminData={adminData} />
      )}

      {/* Individual Resident Modal */}
      {selectedResident && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start">
              <div className="w-full">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-black text-slate-800">{formatDisplayName(selectedResident.name)}</h2>
                </div>
                <p className="text-sm font-bold text-slate-400 mb-6">{selectedResident.label} · Advisor: {selectedResident.advisor || '—'}</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.curriculumAttempts > 0 ? `${selectedResident.curriculumAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Curr Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.independentAttempts > 0 && selectedResident.independentAvg !== null ? `${selectedResident.independentAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Indep Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.totalAttempts > 0 ? `${selectedResident.overallAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.blocksCompleted}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Blocks Done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.blocksCompleted > 0 ? `${selectedResident.onTimePct.toFixed(0)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">On-Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.totalPoints}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Points</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.academicRisk].badge}`}>
                    Academic: {selectedResident.academicRisk === 'red' ? 'At Risk' : selectedResident.academicRisk === 'yellow' ? 'Attention' : selectedResident.academicRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.complianceRisk].badge}`}>
                    Compliance: {selectedResident.complianceRisk === 'red' ? 'At Risk' : selectedResident.complianceRisk === 'yellow' ? 'Attention' : selectedResident.complianceRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedResident(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all ml-4 shrink-0">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {(() => {
                const assigned = selectedResident.results.filter(r => (r.academic_points || 0) > 0);
                const custom = selectedResident.results.filter(r => !r.academic_points || r.academic_points === 0);

                return (
                  <>
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Core Curriculum ({assigned.length})</h3>
                      {assigned.length > 0 ? (
                        <div className="space-y-3">
                          {assigned.map((r: any, i: number) => {
                            const pts = r.academic_points || 0;
                            const timingLabel = pts >= 2 && !r.topic?.toLowerCase().includes('bonus') ? '✅ On Time'
                              : pts === 1 ? '⏰ Late'
                              : pts >= 2 ? '⚡ Bonus'
                              : '—';
                            return (
                              <div key={`curr-${i}`} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100/50">
                                <div className="flex-1">
                                  <p className="font-bold text-slate-800 text-sm">{r.topic}</p>
                                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'} · {timingLabel}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 text-emerald-700' : (r.percentage || 0) > 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                    {(r.percentage || 0).toFixed(1)}%
                                  </span>
                                  <span className="text-xs font-bold text-slate-400 w-12 text-right">{pts} pt{pts !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-400 font-bold text-sm bg-slate-50 p-4 rounded-xl">No curriculum blocks completed.</p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Independent Study ({custom.length})</h3>
                      {custom.length > 0 ? (
                        <div className="space-y-3">
                          {custom.map((r: any, i: number) => (
                            <div key={`ind-${i}`} className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50 transition-all border border-indigo-50/50">
                              <div className="flex-1">
                                <p className="font-bold text-slate-800 text-sm">{r.topic}</p>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">
                                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 text-emerald-700' : (r.percentage || 0) > 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                  {(r.percentage || 0).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 font-bold text-sm bg-slate-50 p-4 rounded-xl">No independent study recorded.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
