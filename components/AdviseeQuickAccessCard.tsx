'use client';

import React, { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { User, Profile, RosterEntry, Result, Block } from '@/lib/types';
import { getDueBlocks, getOverdueBlocks, getRiskLevel, getComplianceRisk, getRiskReasons, computeTrend } from '@/lib/residentRisk';
import { formatDisplayName } from '@/lib/utils';
import { getCurrentAcademicYear } from '@/lib/academicYear';
import { supabase } from '@/lib/supabase';
import AdviseeDossierModal, { DossierAdviseeData } from './AdviseeDossierModal';
import { openEmailCompose, generateIndividualAdviseeEmail, generateAllAdviseesEmail } from '@/lib/emailHelper';
import {
  Users, Mail, Copy, Sparkles, BarChartIcon, CheckCircle, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, Check, ExternalLink, Printer, Target, Clock, Loader2, X
} from './AppIcons';

interface AdviseeQuickAccessCardProps {
  user?: User | null;
  profile?: Profile | null;
  selectedYear: number;
  onOpenAdmin: (tabId?: string) => void;
  currentBlock?: Block | null;
}

interface AdviseeStat {
  resident: RosterEntry;
  name: string;
  surname?: string;
  pgy: string;
  overallAvg: number;
  curriculumAvg: number;
  totalAttempts: number;
  curriculumAttempts: number;
  blocksCompleted: number;
  totalPoints: number;
  onTimePct: number;
  overdueCount: number;
  academicRisk: 'red' | 'yellow' | 'green' | 'gray';
  complianceRisk: 'red' | 'yellow' | 'green' | 'gray';
  isAtRisk: boolean;
  isAttention: boolean;
  riskReasons: string[];
  trendDelta?: number | null;
  weakCategories: Array<{ category: string; correct: number; total: number; percentage: number }>;
  meetingLogged: boolean;
  meetingDate?: string | null;
  blockHistory: Array<{ topic: string; score: number; total: number; percentage: number; points: number; date: string }>;
  meetingHistory: Array<{ topic: string; date: string }>;
}

export default function AdviseeQuickAccessCard({
  user,
  profile,
  selectedYear,
  onOpenAdmin,
  currentBlock,
}: AdviseeQuickAccessCardProps) {
  const { data: adminData, loading, refetch } = useAdminData({ includeQuestions: false });
  const [copied, setCopied] = useState(false);

  // Persistent collapsed state (defaulting to collapsed / false)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fmc_advisee_hub_expanded');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return false;
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('fmc_advisee_hub_expanded', String(next));
      }
      return next;
    });
  };

  // Dossier modal state
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierSelectedEmail, setDossierSelectedEmail] = useState<string | undefined>(undefined);

  // Advisor meeting modal state
  const [meetingModalAdvisee, setMeetingModalAdvisee] = useState<AdviseeStat | null>(null);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [loggingMeeting, setLoggingMeeting] = useState(false);
  const [meetingErrorMsg, setMeetingErrorMsg] = useState<string | null>(null);
  const [meetingSuccessToast, setMeetingSuccessToast] = useState<string | null>(null);

  const facultyName = useMemo(() => {
    if (!profile) return '';
    return profile.full_name || (profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '');
  }, [profile]);

  const adviseeStats = useMemo<AdviseeStat[]>(() => {
    if (!adminData || !adminData.roster || !facultyName) return [];

    const { roster, results, blocks, block_schedule, profiles, attendance } = adminData;

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

    // Active block meeting search token
    const activeBlockTitle = currentBlock?.title || '';

    return myAdvisees.map((resident) => {
      const resEmailLower = resident.email?.toLowerCase() || '';
      const resUserId = emailToUserId.get(resEmailLower);

      const resResults = (results || []).filter(
        (r: Result & { email?: string | null }) =>
          (resEmailLower && r.legacy_email?.toLowerCase() === resEmailLower) ||
          (resEmailLower && r.email?.toLowerCase() === resEmailLower) ||
          (resUserId && r.user_id === resUserId)
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

      // Calculate total academic points
      const totalPoints = resResults.reduce((acc, r) => acc + (r.academic_points || 0), 0);

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

      // 1. Compute Category Breakdown & Weak Areas from category_stats
      const catMap = new Map<string, { correct: number; total: number }>();
      resResults.forEach((r: any) => {
        if (r.category_stats) {
          let statsObj = r.category_stats;
          if (typeof statsObj === 'string') {
            try {
              statsObj = JSON.parse(statsObj);
            } catch {
              statsObj = null;
            }
          }
          if (statsObj && typeof statsObj === 'object') {
            Object.entries(statsObj).forEach(([cat, s]: [string, any]) => {
              if (s && typeof s === 'object' && typeof s.total === 'number' && s.total > 0) {
                const existing = catMap.get(cat) || { correct: 0, total: 0 };
                catMap.set(cat, {
                  correct: existing.correct + (s.correct || 0),
                  total: existing.total + s.total,
                });
              }
            });
          }
        }
      });

      const weakCategories = Array.from(catMap.entries())
        .map(([category, stats]) => ({
          category,
          correct: stats.correct,
          total: stats.total,
          percentage: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        }))
        .sort((a, b) => a.percentage - b.percentage);

      // 2. Advisor Meeting Status for Current Block
      let meetingLogged = false;
      let meetingDate: string | null = null;

      if (activeBlockTitle) {
        // Check results table for meeting record
        const matchingResult = resResults.find(
          (r) => r.topic?.includes('Advisor Meeting') && r.topic?.includes(activeBlockTitle)
        );
        if (matchingResult) {
          meetingLogged = true;
          meetingDate = matchingResult.created_at ? new Date(matchingResult.created_at).toLocaleDateString() : null;
        }

        // Also check attendance table
        if (!meetingLogged && attendance) {
          const matchingAtt = attendance.find(
            (a) =>
              (a.resident_email?.toLowerCase() === resEmailLower || a.user_id === resUserId) &&
              a.topic?.includes('Advisor Meeting') &&
              a.topic?.includes(activeBlockTitle)
          );
          if (matchingAtt) {
            meetingLogged = true;
            meetingDate = matchingAtt.date || null;
          }
        }
      }

      // 3. Block history for dossier
      const blockHistory = assignedResults
        .filter((r) => r.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .map((r) => ({
          topic: r.topic || 'Curriculum Block',
          score: r.score || 0,
          total: r.total || 0,
          percentage: r.percentage || 0,
          points: r.academic_points || 0,
          date: new Date(r.created_at!).toLocaleDateString(),
        }));

      // 4. Meeting history for dossier
      const meetingHistory: Array<{ topic: string; date: string }> = [];
      resResults
        .filter((r) => r.topic?.includes('Advisor Meeting'))
        .forEach((r) => {
          meetingHistory.push({
            topic: r.topic || 'Advisor Meeting',
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
          });
        });

      return {
        resident,
        name: resident.name || resident.email,
        surname: resident.last_name || (resident.name ? resident.name.split(' ').slice(-1)[0] : 'Resident'),
        pgy: String(resident.pgy_override || resident.pgy || 'Resident'),
        overallAvg,
        curriculumAvg,
        totalAttempts: blockResults.length,
        curriculumAttempts: assignedResults.length,
        blocksCompleted,
        totalPoints,
        onTimePct,
        overdueCount,
        academicRisk,
        complianceRisk,
        isAtRisk,
        isAttention,
        riskReasons,
        trendDelta: trend.delta,
        weakCategories,
        meetingLogged,
        meetingDate,
        blockHistory,
        meetingHistory,
      };
    });
  }, [adminData, facultyName, selectedYear, currentBlock]);

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
    if (adviseeStats.length === 0) return;
    const advisorName = profile?.full_name || user?.user_metadata?.full_name || '';
    const emailData = generateAllAdviseesEmail({
      advisees: adviseeStats.map((a) => ({
        name: a.name,
        pgy: a.pgy,
        email: a.resident.email,
        curriculumAvg: a.curriculumAvg,
        curriculumAttempts: a.curriculumAttempts,
        onTimePct: a.onTimePct,
        isAtRisk: a.isAtRisk,
        isAttention: a.isAttention,
        riskReasons: a.riskReasons,
        weakCategories: a.weakCategories,
      })),
      advisorName,
    });
    openEmailCompose(emailData);
  };

  const handleEmailIndividualAdvisee = (advisee: AdviseeStat) => {
    const advisorName = profile?.full_name || user?.user_metadata?.full_name || '';
    const emailData = generateIndividualAdviseeEmail({
      name: advisee.name,
      surname: advisee.surname,
      email: advisee.resident.email,
      curriculumAvg: advisee.curriculumAvg,
      curriculumAttempts: advisee.curriculumAttempts,
      onTimePct: advisee.onTimePct,
      overdueCount: advisee.overdueCount,
      riskReasons: advisee.riskReasons,
      weakCategories: advisee.weakCategories,
      advisorName,
    });
    openEmailCompose(emailData);
  };

  const handleLogMeetingSubmit = async () => {
    if (!meetingModalAdvisee) return;
    setLoggingMeeting(true);
    setMeetingErrorMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const blockTitle = currentBlock?.title || 'Current Block';
      const yearToUse = currentBlock?.academic_year || selectedYear || getCurrentAcademicYear();

      const res = await fetch('/api/faculty/advisor-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          residentEmail: meetingModalAdvisee.resident.email,
          blockTitle,
          selectedYear: yearToUse,
          notes: meetingNotes.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Failed to log advisor meeting');
      }

      // Refetch queries
      await refetch();
      setMeetingModalAdvisee(null);
      setMeetingNotes('');
      setMeetingSuccessToast(`Meeting logged for ${meetingModalAdvisee.name} (+1 AP awarded)!`);
      setTimeout(() => setMeetingSuccessToast(null), 3500);
    } catch (err: any) {
      setMeetingErrorMsg(err.message || 'Failed to log meeting');
    } finally {
      setLoggingMeeting(false);
    }
  };

  // Prepare dossier data
  const dossierAdvisees: DossierAdviseeData[] = adviseeStats.map((a) => ({
    resident: a.resident,
    name: a.name,
    pgy: a.pgy,
    overallAvg: a.overallAvg,
    curriculumAvg: a.curriculumAvg,
    totalAttempts: a.totalAttempts,
    curriculumAttempts: a.curriculumAttempts,
    blocksCompleted: a.blocksCompleted,
    totalPoints: a.totalPoints,
    onTimePct: a.onTimePct,
    overdueCount: a.overdueCount,
    isAtRisk: a.isAtRisk,
    isAttention: a.isAttention,
    riskReasons: a.riskReasons,
    weakCategories: a.weakCategories,
    blockHistory: a.blockHistory,
    meetingHistory: a.meetingHistory,
  }));

  return (
    <>
      <div className="w-full mb-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-500/20 relative overflow-hidden animate-fade-in transition-all">
        {/* Background glow accent */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  My Advisees Hub
                </h2>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[11px] font-bold rounded-full border border-indigo-400/20">
                  {adviseeStats.length} {adviseeStats.length === 1 ? 'Resident' : 'Residents'}
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/70 font-medium truncate">
                Assigned to {formatDisplayName(facultyName)} • Live Performance Tracking
              </p>
            </div>
          </div>

          {/* Status Counts & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {atRiskCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-full">
                <AlertCircle className="w-3.5 h-3.5" /> {atRiskCount} At Risk
              </span>
            )}
            {attentionCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" /> {attentionCount} Attention
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> {onTrackCount} On Track
            </span>

            {/* Quick Actions on Collapsed Banner */}
            <button
              onClick={() => {
                setDossierSelectedEmail('all');
                setShowDossierModal(true);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-indigo-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1 border border-white/10"
              title="Print Semi-Annual Advisee Dossier (PDF)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" />
              <span className="hidden sm:inline">Dossier</span>
            </button>

            <button
              onClick={toggleExpanded}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-0.5"
              title={isExpanded ? 'Collapse Advisee Hub' : 'Expand Advisee Hub'}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {meetingSuccessToast && (
          <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            {meetingSuccessToast}
          </div>
        )}

        {/* Expanded Advisee Details */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-indigo-800/40 space-y-3">
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
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${statusBg}`}
                  >
                    <div>
                      {/* Resident Info & Status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-white">{a.name}</h4>
                          <p className="text-[11px] text-indigo-300 font-medium">{a.pgy}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {statusBadge}
                          <button
                            onClick={() => handleEmailIndividualAdvisee(a)}
                            className="p-1 text-indigo-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                            title={`Email Dr. ${a.surname || a.name}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDossierSelectedEmail(a.resident.email);
                              setShowDossierModal(true);
                            }}
                            className="p-1 text-indigo-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                            title={`Print Dossier for ${a.name}`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Performance Grid */}
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

                      {/* Weak Areas & 1-Click Remediation */}
                      <div className="mt-2">
                        <span className="text-[10px] font-bold text-indigo-300/70 uppercase tracking-wider block mb-1">
                          Weak Areas (Remediation)
                        </span>
                        {a.weakCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {a.weakCategories.slice(0, 3).map((w, idx) => {
                              const isLow = w.percentage < 50;
                              const isMid = w.percentage >= 50 && w.percentage < 65;
                              return (
                                <div
                                  key={idx}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border ${
                                    isLow
                                      ? 'bg-red-500/20 text-red-200 border-red-500/30'
                                      : isMid
                                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                                  }`}
                                  title={`${w.category}: ${w.percentage.toFixed(0)}% (${w.correct}/${w.total})`}
                                >
                                  <span className="truncate max-w-[85px]">{w.category}</span>
                                  <span className="font-black">{w.percentage.toFixed(0)}%</span>
                                  <button
                                    onClick={() => onOpenAdmin('assign')}
                                    className="hover:scale-125 transition-transform text-white"
                                    title={`Assign targeted quiz in ${w.category}`}
                                  >
                                    <Target className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-indigo-300/60 italic">
                            No question breakdown logged yet
                          </span>
                        )}
                      </div>

                      {/* Advisor Meeting Status for Active Block */}
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <div className="text-[10px] flex items-center gap-1 truncate">
                          {a.meetingLogged ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 truncate">
                              <CheckCircle className="w-3 h-3 shrink-0" />
                              Meeting Logged {a.meetingDate ? `(${a.meetingDate})` : ''}
                            </span>
                          ) : (
                            <span className="text-amber-300/90 font-medium flex items-center gap-1 truncate">
                              <Clock className="w-3 h-3 shrink-0" />
                              {currentBlock ? `Block meeting pending` : 'Meeting pending'}
                            </span>
                          )}
                        </div>

                        {!a.meetingLogged && (
                          <button
                            onClick={() => {
                              setMeetingModalAdvisee(a);
                              setMeetingNotes('');
                              setMeetingErrorMsg(null);
                            }}
                            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30 transition-all shrink-0 active:scale-95"
                          >
                            Log Meeting (+1 AP)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Expanded Action Toolbar */}
            <div className="pt-3 border-t border-indigo-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleEmailAdvisees}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Advisees
                </button>
                <button
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all flex items-center gap-1 border border-white/10 active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy CCC Notes'}
                </button>
                <button
                  onClick={() => {
                    setDossierSelectedEmail('all');
                    setShowDossierModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all flex items-center gap-1 border border-white/10 active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-300" /> Print Advisee Dossier (PDF)
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onOpenAdmin('assign')}
                  className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center gap-1 border border-purple-400/30 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" /> Assign Practice Quiz
                  <span className="text-[9px] bg-purple-900/60 px-1 py-0.5 rounded text-purple-200">0 AP</span>
                </button>
                <button
                  onClick={() => onOpenAdmin('performance')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all flex items-center gap-1 border border-white/10 active:scale-95"
                >
                  <BarChartIcon className="w-3.5 h-3.5 text-indigo-300" /> Faculty Console
                  <ExternalLink className="w-3 h-3 text-indigo-300" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advisor Meeting Modal */}
      {meetingModalAdvisee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Log Advisor Meeting</h3>
              </div>
              <button
                onClick={() => setMeetingModalAdvisee(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1">
                <p>
                  <strong className="text-slate-300">Advisee:</strong> {meetingModalAdvisee.name} ({meetingModalAdvisee.pgy})
                </p>
                <p>
                  <strong className="text-slate-300">Block:</strong> {currentBlock?.title || 'Current Block'}
                </p>
                <p>
                  <strong className="text-slate-300">Credit Awarded:</strong> <span className="text-amber-400 font-bold">+1 Academic Point (AP)</span>
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Discussion Notes & Goals (Optional):
                </label>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="e.g. Reviewed Cardiology weak areas, established study schedule for ITE review..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {meetingErrorMsg && (
                <p className="text-red-400 text-xs font-semibold">{meetingErrorMsg}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setMeetingModalAdvisee(null)}
                disabled={loggingMeeting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogMeetingSubmit}
                disabled={loggingMeeting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {loggingMeeting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {loggingMeeting ? 'Saving...' : 'Confirm & Award 1 AP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier Modal */}
      {showDossierModal && (
        <AdviseeDossierModal
          facultyName={facultyName}
          selectedYear={selectedYear}
          advisees={dossierAdvisees}
          initialSelectedEmail={dossierSelectedEmail}
          onClose={() => setShowDossierModal(false)}
        />
      )}
    </>
  );
}
