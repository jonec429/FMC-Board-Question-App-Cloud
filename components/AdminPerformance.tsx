'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName } from '@/lib/utils';
import { isAdmin, isFaculty, getFacultyAdviseeFilter } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear, deriveLabel, isActiveResident, isGraduated } from '@/lib/academicYear';
import { useSortState, sortItems, SortHeader, lastName } from '@/lib/sorting';
import { BarChartIcon, Users, Loader2, TrendingUp, Target, X, ChevronRight, Mail } from './AppIcons';
import QuestionHeatmap from './QuestionHeatmap';

const AT_RISK_AVG = 60;
const CONCERN_AVG = 70;
const AT_RISK_ONTIME = 50;
const CONCERN_ONTIME = 75;

interface ResidentStat {
  name: string;
  last_name: string;
  email: string;
  pgy: string;
  label: string;
  advisor: string;
  attempts: number;
  avgPct: number;
  blocksCompleted: number;
  onTimePct: number;
  totalPoints: number;
  risk: 'red' | 'yellow' | 'green';
  results: any[];
}

function getRisk(avgPct: number, onTimePct: number, attempts: number): 'red' | 'yellow' | 'green' {
  if (attempts === 0) return 'green';
  if (avgPct < AT_RISK_AVG || onTimePct < AT_RISK_ONTIME) return 'red';
  if (avgPct < CONCERN_AVG || onTimePct < CONCERN_ONTIME) return 'yellow';
  return 'green';
}

const riskColors = {
  red: { row: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  yellow: { row: 'bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  green: { row: '', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
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
      case 'attempts': return r.attempts;
      case 'avg': return r.avgPct;
      case 'blocks': return r.blocksCompleted;
      case 'ontime': return r.onTimePct;
      case 'points': return r.totalPoints;
      case 'status': return r.risk === 'red' ? 0 : r.risk === 'yellow' ? 1 : 2;
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

      const avgPct = resResults.length > 0
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
        attempts: resResults.length,
        avgPct,
        blocksCompleted,
        onTimePct,
        totalPoints,
        risk: getRisk(avgPct, onTimePct, resResults.length),
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

  const redFlagged = residentStats.filter(r => r.risk === 'red');
  const yellowFlagged = residentStats.filter(r => r.risk === 'yellow');
  const programAvg = residentStats.length > 0
    ? residentStats.filter(r => r.attempts > 0).reduce((a, r) => a + r.avgPct, 0) / (residentStats.filter(r => r.attempts > 0).length || 1)
    : 0;
  const boardReadiness = Math.round(residentStats.filter(r => r.attempts > 0 && r.avgPct >= 70).length / (residentStats.filter(r => r.attempts > 0).length || 1) * 100);
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
            <SortHeader label="Attempts" sortKey="attempts" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Avg %" sortKey="avg" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Blocks Done" sortKey="blocks" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="On-Time %" sortKey="ontime" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Points" sortKey="points" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle} className="text-center px-4 py-3" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {residents.map((r, i) => {
            const colors = riskColors[r.risk];
            return (
              <tr key={i} className={`border-b border-slate-50 transition-all hover:brightness-95 cursor-pointer ${colors.row}`} onClick={() => setSelectedResident(r)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                    <span className="font-bold text-slate-800 text-sm">{formatDisplayName(r.name)}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center text-xs font-bold text-slate-500">{r.label}</td>
                <td className="px-4 py-4 text-center font-bold text-slate-600 text-sm">{r.attempts}</td>
                <td className="px-4 py-4 text-center">
                  {r.attempts > 0 ? (
                    <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.avgPct >= 70 ? 'text-emerald-700' : r.avgPct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.avgPct.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center font-bold text-slate-600 text-sm">{r.blocksCompleted}</td>
                <td className="px-4 py-4 text-center">
                  {r.blocksCompleted > 0 ? (
                    <span className={`text-sm font-bold ${r.onTimePct >= 75 ? 'text-emerald-600' : r.onTimePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.onTimePct.toFixed(0)}%
                    </span>
                  ) : <span className="text-slate-300 font-bold">—</span>}
                </td>
                <td className="px-4 py-4 text-center font-black text-slate-700 text-sm">{r.totalPoints}</td>
                <td className="px-4 py-4 text-center">
                  {r.attempts > 0 ? (
                    <span className={`text-xs font-black px-2 py-1 rounded-full ${colors.badge}`}>
                      {r.risk === 'red' ? 'At Risk' : r.risk === 'yellow' ? 'Needs Attention' : 'On Track'}
                    </span>
                  ) : <span className="text-slate-300 text-xs font-bold">No Data</span>}
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
                      myAdvisees.map(r => `- ${r.name}: ${r.avgPct.toFixed(1)}% Avg | ${r.onTimePct.toFixed(0)}% On-Time | Status: ${r.risk === 'red' ? 'AT RISK' : r.risk === 'yellow' ? 'NEEDS ATTENTION' : 'ON TRACK'}`).join('\n') +
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
                    bodyStr += `- ${r.name}: ${r.avgPct.toFixed(1)}% Avg | ${r.onTimePct.toFixed(0)}% On-Time | Status: ${r.risk === 'red' ? 'AT RISK' : r.risk === 'yellow' ? 'NEEDS ATTENTION' : 'ON TRACK'}\n`;
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
            const groupAvg = residents.filter(r => r.attempts > 0).reduce((a, r) => a + r.avgPct, 0) / (residents.filter(r => r.attempts > 0).length || 1);
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
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-3 h-3 rounded-full ${riskColors[selectedResident.risk].dot}`} />
                  <h2 className="text-2xl font-black text-slate-800">{formatDisplayName(selectedResident.name)}</h2>
                </div>
                <p className="text-sm font-bold text-slate-400">{selectedResident.label} · Advisor: {selectedResident.advisor || '—'}</p>
                <div className="flex gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.avgPct.toFixed(1)}%</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.blocksCompleted}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blocks Done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.onTimePct.toFixed(0)}%</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On-Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.totalPoints}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points</div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedResident(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Assessment History</h3>
              {selectedResident.results.length > 0 ? (
                <div className="space-y-3">
                  {selectedResident.results.map((r: any, i: number) => {
                    const pts = r.academic_points || 0;
                    const timingLabel = pts >= 2 && !r.topic?.toLowerCase().includes('bonus') ? '✅ On Time'
                      : pts === 1 ? '⏰ Late'
                      : pts >= 2 ? '⚡ Bonus'
                      : '—';
                    return (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm">{r.topic}</p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'} · {timingLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {(r.percentage || 0).toFixed(1)}%
                          </span>
                          <span className="text-xs font-bold text-slate-400">{pts} pt{pts !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-12 font-bold">No assessments recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
