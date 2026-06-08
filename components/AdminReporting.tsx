'use client';

import React, { useState, useMemo } from 'react';
import { AdminData } from '@/lib/types';
import { FileText, Download, Printer, Users, CheckCircle, XCircle, TrendingDown } from './AppIcons';
import { isActiveResident, getCurrentAcademicYear } from '@/lib/academicYear';
import { getDueBlocks, getOverdueBlocks, getRiskLevel, getComplianceRisk, getRiskReasons, riskStatusLabel, computeTrend } from '@/lib/residentRisk';

interface AdminReportingProps {
  adminData: AdminData;
}

export default function AdminReporting({ adminData }: AdminReportingProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  // 1. Data Aggregation for Reports
  const reportData = useMemo(() => {
    if (!adminData) return [];

    // id -> email, so results that only carry user_id can be attributed by email.
    const profileEmail = new Map<string, string>();
    adminData.profiles.forEach((p: any) => {
      const e = (p?.email || '').toLowerCase();
      if (p?.id && e) profileEmail.set(p.id, e);
    });

    // Past-due required blocks for the current academic year (shared with the dashboard).
    const dueBlocks = getDueBlocks(adminData.blocks || [], adminData.block_schedule || [], getCurrentAcademicYear());

    const activeRoster = adminData.roster.filter(isActiveResident);

    return activeRoster.map(rosterEntry => {
      const email = (rosterEntry.email || '').toLowerCase();
      const userResults = adminData.results.filter((r: any) =>
        ((r.legacy_email || '').toLowerCase() === email || (r.user_id && profileEmail.get(r.user_id) === email)) &&
        !r.topic?.toLowerCase().includes('demo')
      );

      const assigned = userResults.filter((r: any) => (r.academic_points || 0) > 0);

      // Best points per block (dedupe by topic) -> blocks done + on-time rate.
      const topicBestPts = new Map<string, number>();
      assigned.forEach((r: any) => {
        topicBestPts.set(r.topic, Math.max(topicBestPts.get(r.topic) || 0, r.academic_points || 0));
      });
      const blocksCompleted = topicBestPts.size;
      const nonBonus = Array.from(topicBestPts.entries()).filter(([t]) => !t?.toLowerCase().includes('bonus'));
      const onTimeRate = nonBonus.length > 0
        ? Math.round((nonBonus.filter(([, p]) => p >= 2).length / nonBonus.length) * 100)
        : 100;

      const curriculumAvg = assigned.length > 0
        ? Math.round(assigned.reduce((s: number, r: any) => s + (r.percentage || 0), 0) / assigned.length)
        : 0;

      const completedTitles = new Set(Array.from(topicBestPts.keys()));
      const overdueCount = getOverdueBlocks(dueBlocks, completedTitles).length;
      const totalPoints = Array.from(topicBestPts.values()).reduce((s, p) => s + p, 0);

      const scoresChrono = [...userResults]
        .filter((r: any) => typeof r.percentage === 'number')
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((r: any) => r.percentage);
      const { delta: trendDelta, declining } = computeTrend(scoresChrono);

      const academicRisk = getRiskLevel(curriculumAvg, assigned.length);
      const complianceRisk = getComplianceRisk(onTimeRate, blocksCompleted, overdueCount);
      const riskStatus = riskStatusLabel(academicRisk, complianceRisk, declining);
      const reasons = getRiskReasons({ curriculumAvg, curriculumAttempts: assigned.length, onTimePct: onTimeRate, blocksCompleted, overdueCount, trendDelta });

      return {
        name: rosterEntry.name || `${rosterEntry.first_name} ${rosterEntry.last_name}`,
        email: rosterEntry.email,
        pgy: rosterEntry.pgy || 'Unknown',
        advisor: rosterEntry.advisor || 'Unassigned',
        blocksCompleted,
        curriculumAvg,
        onTimeRate,
        overdueCount,
        totalPoints,
        riskStatus,
        reasons,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [adminData]);

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = ['Name', 'Email', 'PGY', 'Advisor', 'Blocks Done', 'Curr Avg (%)', 'On-Time (%)', 'Overdue', 'Total Points', 'Risk Status', 'Flags'];
    const csvContent = [
      headers.join(','),
      ...reportData.map(r => [
        `"${r.name}"`,
        `"${r.email}"`,
        `"${r.pgy}"`,
        `"${r.advisor}"`,
        r.blocksCompleted,
        r.curriculumAvg,
        r.onTimeRate,
        r.overdueCount,
        r.totalPoints,
        `"${r.riskStatus}"`,
        `"${r.reasons.join('; ')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FMC_Resident_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500); // Give React time to render the print view before printing
  };

  // If we are printing, we override the normal UI with a clean print layout
  if (isPrinting) {
    return (
      <div className="absolute top-0 left-0 w-full bg-white text-black p-8 z-50 print-only">
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">FMC QBank Performance Report</h1>
            <p className="text-slate-500 font-medium mt-1">Generated: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800">Active Cohort</p>
            <p className="text-slate-500">{reportData.length} Residents</p>
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="pb-3 font-bold">Resident</th>
              <th className="pb-3 font-bold">PGY</th>
              <th className="pb-3 font-bold">Advisor</th>
              <th className="pb-3 font-bold text-center">Blocks</th>
              <th className="pb-3 font-bold text-center">Curr Avg</th>
              <th className="pb-3 font-bold text-center">On-Time</th>
              <th className="pb-3 font-bold text-center">Overdue</th>
              <th className="pb-3 font-bold text-center">Points</th>
              <th className="pb-3 font-bold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reportData.map((r, i) => (
              <tr key={i} className="print-avoid-break">
                <td className="py-3 font-medium text-slate-800">
                  {r.name}
                  {r.reasons.length > 0 && (
                    <span className="block text-[10px] font-bold text-red-600">⚠ {r.reasons.join(' · ')}</span>
                  )}
                </td>
                <td className="py-3 text-slate-600">{r.pgy}</td>
                <td className="py-3 text-slate-600">{r.advisor}</td>
                <td className="py-3 text-center font-medium">{r.blocksCompleted}</td>
                <td className="py-3 text-center">
                  <span className={`font-bold ${r.curriculumAvg <= 50 ? 'text-red-600' : r.curriculumAvg <= 65 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {r.blocksCompleted > 0 ? `${r.curriculumAvg}%` : '—'}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className={`font-bold ${r.onTimeRate < 50 ? 'text-red-600' : r.onTimeRate < 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {r.blocksCompleted > 0 ? `${r.onTimeRate}%` : '—'}
                  </span>
                </td>
                <td className="py-3 text-center font-bold">
                  <span className={r.overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}>{r.overdueCount}</span>
                </td>
                <td className="py-3 text-center font-bold text-slate-700">{r.totalPoints}</td>
                <td className="py-3 text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    r.riskStatus === 'At Risk' ? 'bg-red-100 text-red-800' :
                    r.riskStatus === 'Needs Attention' ? 'bg-amber-100 text-amber-800' :
                    r.riskStatus === 'On Track' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {r.riskStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
          <p>End of Report</p>
        </div>
      </div>
    );
  }

  // Normal UI
  return (
    <div className="space-y-6 print-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CSV Export Card */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col items-start hover-lift">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
            <Download className="w-7 h-7 text-indigo-600" />
          </div>
          <h3 className="font-black text-xl text-slate-800 mb-2">Export to CSV</h3>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed flex-1">
            Download raw performance data for all active residents. Can be imported into Excel, Google Sheets, or other tools.
          </p>
          <button 
            onClick={handleExportCSV}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl btn-gradient-indigo text-indigo-700 font-bold hover:shadow-lg transition-all"
          >
            <FileText className="w-5 h-5" />
            Download Spreadsheet
          </button>
        </div>

        {/* PDF Report Card */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col items-start hover-lift">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
            <Printer className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="font-black text-xl text-slate-800 mb-2">Printable Report</h3>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed flex-1">
            Generate a clean, printer-friendly PDF summarizing the entire program's performance and risk status.
          </p>
          <button 
            onClick={handlePrintReport}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 hover:shadow-lg transition-all"
          >
            <Printer className="w-5 h-5" />
            Print to PDF
          </button>
        </div>

      </div>
    </div>
  );
}
