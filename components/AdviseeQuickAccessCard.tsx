'use client';

import React, { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { User, Profile, RosterEntry, Result } from '@/lib/types';
import { getDueBlocks, getOverdueBlocks, getRiskLevel, getComplianceRisk, getRiskReasons, computeTrend } from '@/lib/residentRisk';
import { formatDisplayName } from '@/lib/utils';
import {
  Users, Mail, Copy, Sparkles, BarChartIcon, CheckCircle, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Check, ExternalLink
} from './AppIcons';

interface AdviseeQuickAccessCardProps {
  user?: User | null;
  profile?: Profile | null;
  selectedYear: number;
  onOpenAdmin: (tabId?: string) => void;
}

interface AdviseeStat {
  resident: RosterEntry;
  name: string;
  pgy: string;
  overallAvg: number;
  curriculumAvg: number;
  totalAttempts: number;
  curriculumAttempts: number;
  blocksCompleted: number;
  onTimePct: number;
  overdueCount: number;
  academicRisk: 'red' | 'yellow' | 'green' | 'gray';
  complianceRisk: 'red' | 'yellow' | 'green' | 'gray';
  isAtRisk: boolean;
  isAttention: boolean;
  riskReasons: string[];
  trendDelta?: number | null;
}

export default function AdviseeQuickAccessCard({
  user,
  profile,
  selectedYear,
  onOpenAdmin,
}: AdviseeQuickAccessCardProps) {
  const { data: adminData, loading } = useAdminData({ includeQuestions: false });
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const facultyName = useMemo(() => {
    if (!profile) return '';
    return profile.full_name || (profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '');
  }, [profile]);

  const adviseeStats = useMemo<AdviseeStat[]>(() => {
    if (!adminData || !adminData.roster || !facultyName) return [];

    const { roster, results, blocks, block_schedule, profiles } = adminData;

    // Filter roster to active non-graduated advisees for this faculty member
    const myAdvisees = roster.filter(
      (r) =>
        r.advisor?.trim().toLowerCase() === facultyName.trim().toLowerCase() &&
        r.status !== 'graduated' &&
        (r.role === 'resident' || r.role === 'chief' || !r.role)
    );

    if (myAdvisees.length === 0) return [];

    const emailToUserId = new Map<string, string>();
    (profiles || []).forEach((p) => {
      if (p.email && p.id) emailToUserId.set(p.email.toLowerCase(), p.id);
    });

    const dueBlocks = getDueBlocks(blocks || [], block_schedule || [], selectedYear);

    return myAdvisees.map((resident) => {
      const resResults = (results || []).filter(
        (r: Result & { email?: string | null }) =>
          (resident.email && r.legacy_email?.toLowerCase() === resident.email.toLowerCase()) ||
          (resident.email && r.email?.toLowerCase() === resident.email.toLowerCase()) ||
          (emailToUserId.get(resident.email?.toLowerCase() || '') && r.user_id === emailToUserId.get(resident.email?.toLowerCase() || ''))
      );

      const blockResults = resResults.filter(
        (r) => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]')
      );

      const assignedResults = blockResults.filter(
        (r) => (r.academic_points || 0) > 0 || r.timing_status != null
      );

      const topicBestPts = new Map<string, number>();
      assignedResults.forEach((r) => {
        const cur = topicBestPts.get(r.topic) || 0;
        if ((r.academic_points || 0) > cur || !topicBestPts.has(r.topic)) {
          topicBestPts.set(r.topic, r.academic_points || 0);
        }
      });

      const blocksCompleted = topicBestPts.size;
      const nonBonusBlocks = Array.from(topicBestPts.entries()).filter(
        ([topic]) => !topic?.toLowerCase().includes('bonus')
      );
      const onTimeBlocks = nonBonusBlocks.filter(([, pts]) => pts >= 2);
      const onTimePct =
        nonBonusBlocks.length > 0 ? (onTimeBlocks.length / nonBonusBlocks.length) * 100 : 100;

      const curriculumAvg =
        assignedResults.length > 0
          ? assignedResults.reduce((a, r) => a + (r.percentage || 0), 0) / assignedResults.length
          : 0;

      const overallAvg =
        blockResults.length > 0
          ? blockResults.reduce((a, r) => a + (r.percentage || 0), 0) / blockResults.length
          : 0;

      const completedTitles = new Set(Array.from(topicBestPts.keys()));
      const overdueCount = getOverdueBlocks(dueBlocks, completedTitles).length;

      const academicRisk = getRiskLevel(curriculumAvg, assignedResults.length);
      const complianceRisk = getComplianceRisk(onTimePct, blocksCompleted, overdueCount);

      // Chronological percentage array for trend detection
      const chronological = [...assignedResults]
        .filter((r) => r.percentage != null && r.created_at)
        .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
        .map((r) => r.percentage as number);

      const trend = computeTrend(chronological);
      const isDeclining = trend.declining;

      const riskReasons = getRiskReasons({
        curriculumAvg,
        curriculumAttempts: assignedResults.length,
        onTimePct,
        blocksCompleted,
        overdueCount,
        trendDelta: trend.delta,
      });

      const isAtRisk = academicRisk === 'red' || complianceRisk === 'red';
      const isAttention =
        !isAtRisk && (academicRisk === 'yellow' || complianceRisk === 'yellow' || isDeclining);

      return {
        resident,
        name: resident.name || resident.email,
        pgy: String(resident.pgy_override || resident.pgy || 'Resident'),
        overallAvg,
        curriculumAvg,
        totalAttempts: blockResults.length,
        curriculumAttempts: assignedResults.length,
        blocksCompleted,
        onTimePct,
        overdueCount,
        academicRisk,
        complianceRisk,
        isAtRisk,
        isAttention,
        riskReasons,
        trendDelta: trend.delta,
      };
    });
  }, [adminData, facultyName, selectedYear]);

  if (loading || adviseeStats.length === 0) {
    return null;
  }

  const atRiskCount = adviseeStats.filter((a) => a.isAtRisk).length;
  const attentionCount = adviseeStats.filter((a) => a.isAttention).length;
  const onTrackCount = adviseeStats.filter((a) => !a.isAtRisk && !a.isAttention).length;

  const handleCopySummary = () => {
    let summary = `## Advisee Performance Summary (${formatDisplayName(facultyName)})\n\n`;
    summary += `*Generated from FMC Board Review App*\n\n`;
    summary += `| Advisee | PGY | Core Avg | Blocks Done | On-Time % | Status | Risk Flags |\n`;
    summary += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    adviseeStats.forEach((a) => {
      const status = a.isAtRisk ? '🚨 AT RISK' : a.isAttention ? '⚠️ NEEDS ATTENTION' : '✅ ON TRACK';
      const flags = a.riskReasons.length > 0 ? a.riskReasons.join(', ') : 'None';
      summary += `| ${a.name} | ${a.pgy} | ${a.curriculumAvg.toFixed(1)}% | ${a.blocksCompleted} | ${a.onTimePct.toFixed(0)}% | ${status} | ${flags} |\n`;
    });

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleEmailAdvisees = () => {
    const subject = encodeURIComponent(`FMC Board Review App: Advisee Progress Update`);
    let bodyStr = `Hello,\r\n\r\nHere is your current progress summary in the FMC Board Review App:\r\n\r\n`;

    adviseeStats.forEach((a) => {
      const status = a.isAtRisk ? '🚨 AT RISK' : a.isAttention ? '⚠️ NEEDS ATTENTION' : '✅ ON TRACK';
      bodyStr += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n`;
      bodyStr += `👤 ${a.name} (${a.pgy})\r\n`;
      bodyStr += `   Status: ${status}\r\n`;
      bodyStr += `   Core Curriculum Avg: ${a.curriculumAvg.toFixed(1)}% (${a.curriculumAttempts} blocks completed)\r\n`;
      bodyStr += `   Compliance: ${a.onTimePct.toFixed(0)}% on time\r\n`;
      if (a.riskReasons.length > 0) {
        bodyStr += `   Flags: ${a.riskReasons.join(' | ')}\r\n`;
      }
      bodyStr += `\r\n`;
    });

    const appUrl = window.location.origin;
    bodyStr += `Log in to practice questions and review explanations:\r\n${appUrl}\r\n\r\nKeep up the great work!`;

    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyStr)}`;
  };

  return (
    <div className="w-full mb-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-indigo-500/20 relative overflow-hidden animate-fade-in">
      {/* Background glow accent */}
      <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-800/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/30 rounded-2xl text-indigo-300">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                My Advisees Hub
              </h2>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-400/20">
                {adviseeStats.length} {adviseeStats.length === 1 ? 'Resident' : 'Residents'}
              </span>
            </div>
            <p className="text-xs text-indigo-200/70 font-medium mt-0.5">
              Assigned to {formatDisplayName(facultyName)} • Live Performance & Risk Tracking
            </p>
          </div>
        </div>

        {/* Status Counts */}
        <div className="flex items-center gap-2 flex-wrap">
          {atRiskCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-full">
              <AlertCircle className="w-3.5 h-3.5" /> {atRiskCount} At Risk
            </span>
          )}
          {attentionCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> {attentionCount} Needs Attention
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
            <CheckCircle className="w-3.5 h-3.5" /> {onTrackCount} On Track
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-indigo-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Advisee List */}
      {isExpanded && (
        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {adviseeStats.map((a) => {
              const statusBg = a.isAtRisk
                ? 'bg-red-950/40 border-red-500/30'
                : a.isAttention
                ? 'bg-amber-950/40 border-amber-500/30'
                : 'bg-white/5 border-white/10 hover:border-white/20';

              const statusBadge = a.isAtRisk ? (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-bold rounded-md border border-red-500/30">
                  🚨 At Risk
                </span>
              ) : a.isAttention ? (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-md border border-amber-500/30">
                  ⚠️ Needs Attention
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30">
                  ✅ On Track
                </span>
              );

              return (
                <div
                  key={a.resident.email}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${statusBg}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-white">{a.name}</h4>
                      <p className="text-[11px] text-indigo-300 font-medium">{a.pgy}</p>
                    </div>
                    {statusBadge}
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-2 py-2 border-y border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-300/70 uppercase tracking-wider block">
                        Core Average
                      </span>
                      <span className="font-black text-sm text-white">
                        {a.curriculumAttempts > 0 ? `${a.curriculumAvg.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-indigo-300/70 uppercase tracking-wider block">
                        Completed
                      </span>
                      <span className="font-black text-sm text-white">
                        {a.blocksCompleted} Blocks ({a.onTimePct.toFixed(0)}% on time)
                      </span>
                    </div>
                  </div>

                  {a.riskReasons.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.riskReasons.map((reason, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-red-500/10 text-red-300 text-[10px] font-semibold rounded border border-red-500/20"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-emerald-400/80 font-medium mt-1">
                      All assignments up to date
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="mt-5 pt-4 border-t border-indigo-800/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleEmailAdvisees}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Compose an email update with advisee metrics"
          >
            <Mail className="w-3.5 h-3.5" /> Email Advisees
          </button>
          <button
            onClick={handleCopySummary}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-white/10 active:scale-95"
            title="Copy formatted summary to clipboard for CCC notes"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard!' : 'Copy CCC Notes'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenAdmin('assign')}
            className="px-3.5 py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-purple-400/30 active:scale-95"
            title="Create and assign targeted practice questions (0 APs)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" /> Assign Practice Quiz
            <span className="text-[9px] bg-purple-900/60 px-1.5 py-0.5 rounded text-purple-200 font-normal">
              0 AP
            </span>
          </button>
          <button
            onClick={() => onOpenAdmin('performance')}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-white/10 active:scale-95"
            title="Open complete Performance and Question-Level Analytics"
          >
            <BarChartIcon className="w-3.5 h-3.5 text-indigo-300" /> Full Faculty Console
            <ExternalLink className="w-3 h-3 text-indigo-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
