'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName, formatLastNameFirst, formatTopicDisplay } from '@/lib/utils';
import { isAdmin, isFaculty, getFacultyAdviseeFilter } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear, deriveLabel, isActiveResident, isGraduated } from '@/lib/academicYear';
import { useSortState, sortItems, SortHeader, lastName } from '@/lib/sorting';
import { BarChartIcon, Users, Loader2, TrendingUp, Target, X, ChevronRight, ChevronLeft, Mail, Search, Check, Download } from './AppIcons';
import QuestionHeatmap from './QuestionHeatmap';
import RiskLegend from './RiskLegend';
import QuizReview from './QuizReview';
import { RiskLevel, getRiskLevel, getDueBlocks, getOverdueBlocks, getComplianceRisk, getRiskReasons, computeTrend } from '@/lib/residentRisk';
import { DataTable } from './DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface ResidentStat {
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
  onTimePoints: number;
  latePoints: number;
  bonusPoints: number;

  academicRisk: RiskLevel;
  complianceRisk: RiskLevel;
  overdueCount: number;
  trendDelta: number | null;
  declining: boolean;
  riskReasons: string[];

  results: Result[];
  totalAttendance: number;
}

// RiskLevel + getRiskLevel + the overdue/reasons helpers live in lib/residentRisk.ts.

const riskColors: Record<RiskLevel, { row: string; badge: string; dot: string }> = {
  red: { row: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  yellow: { row: 'bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  green: { row: '', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  gray: { row: 'bg-slate-50/40', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

import { AdminData, User, Profile, Result, RosterEntry } from '@/lib/types';
import { useAdminData } from '@/hooks/useAdminData';

interface AdminPerformanceProps {
  user?: User | null;
  profile?: Profile | null;
}

type SubTab = 'overview' | 'at_risk' | 'by_pgy' | 'by_block' | 'my_advisees' | 'heatmap';

export default function AdminPerformance({ user, profile }: AdminPerformanceProps) {
  const userIsAdmin = isAdmin(user, profile);
  const userIsFaculty = isFaculty(user, profile);
  const facultyName = getFacultyAdviseeFilter(user, profile);
  
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(
    !userIsAdmin && userIsFaculty && facultyName ? 'my_advisees' : 'overview'
  );

  const { data: adminData, loading, error } = useAdminData();
  const { roster, profiles, results: allResults, blocks, block_schedule } = adminData || { roster: [], profiles: [], results: [], blocks: [], block_schedule: [] };

  const [selectedResident, setSelectedResident] = useState<ResidentStat | null>(null);
  const [showGraduates, setShowGraduates] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());

  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [adjustPointsValue, setAdjustPointsValue] = useState<number>(1);
  const [adjustPointsReason, setAdjustPointsReason] = useState('Noon Conference');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);

  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [reviewItems, setReviewItems] = useState<any[] | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  
  const [selectedBlockDrilldown, setSelectedBlockDrilldown] = useState<any | null>(null);
  const [blockDrilldownSearch, setBlockDrilldownSearch] = useState('');
  
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewPgyFilter, setOverviewPgyFilter] = useState<'ALL' | 'PGY-1' | 'PGY-2' | 'PGY-3'>('ALL');

  const [activeListTab, setActiveListTab] = useState<'questions' | 'attendance'>('questions');

  const openReview = async (r: import('@/lib/types').Result & { review_data?: unknown }) => {
    setSelectedQuiz(r);
    setLoadingReview(true);
    setReviewItems(null);
    
    try {
      const rd = Array.isArray(r.review_data) ? r.review_data : null;
      if (!rd || rd.length === 0) {
        setReviewItems([]);
        setLoadingReview(false);
        return;
      }
      
      const qIds = rd.map((item: { q: string }) => item.q);
      const { data, error } = await supabase.from('questions').select('*').in('id', qIds);
      if (error) throw error;
      
      const hydrated = rd.map((item: { q: string; status: string; explanation?: string; submitted_answer?: string; a?: string }) => {
        const qData = data?.find(x => x.id === item.q);
        return qData ? { question: qData, selected: item.a } : null;
      }).filter(Boolean);
      
      setReviewItems(hydrated);
    } catch (e) {
      console.error(e);
      setReviewItems([]);
    } finally {
      setLoadingReview(false);
    }
  };

  const handleAddManualPoints = async () => {
    if (!selectedResident || !selectedResident.userId) return;
    setIsSubmittingPoints(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/manual-points', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          userId: selectedResident.userId,
          email: selectedResident.email,
          points: adjustPointsValue,
          reason: adjustPointsReason,
        })
      });
      if (res.ok) {
        setIsAdjustingPoints(false);
        alert('Points added successfully!');
        window.location.reload();
      } else {
        alert('Failed to add points');
      }
    } catch (e) {
      alert('Error adding points');
    } finally {
      setIsSubmittingPoints(false);
    }
  };

  // Table sorting (shared across the resident tables; default = points desc)
  const columns: ColumnDef<ResidentStat>[] = useMemo(() => [
    {
      id: 'name',
      accessorFn: row => `${row.name}`,
      header: 'Resident',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">{formatLastNameFirst(r.name, r.last_name)}</span>
            </div>
            {r.riskReasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {r.riskReasons.map((reason, ri) => (
                  <span
                    key={ri}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${reason.includes('overdue') ? 'bg-red-100 text-red-700' : reason.includes('Trending') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
      sortingFn: (rowA, rowB, columnId) => {
        const a = rowA.original.last_name;
        const b = rowB.original.last_name;
        return a.localeCompare(b);
      },
    },
    {
      accessorKey: 'label',
      header: 'PGY',
      cell: info => <div className="text-center text-xs font-bold text-slate-500">{info.getValue() as string}</div>,
    },
    {
      id: 'quizPoints',
      accessorFn: row => (row.totalPoints - row.totalAttendance),
      header: 'Block Pts',
      cell: info => <div className="text-center font-black text-slate-700 text-sm">{info.getValue() as number}</div>,
      sortingFn: (rowA, rowB, columnId) => {
        const a = rowA.original.totalPoints - rowA.original.totalAttendance;
        const b = rowB.original.totalPoints - rowB.original.totalAttendance;
        return a - b;
      },
    },
    {
      accessorKey: 'totalAttendance',
      header: 'Attend Pts',
      cell: info => <div className="text-center font-black text-indigo-600 text-sm">{info.getValue() as number}</div>,
    },
    {
      accessorKey: 'totalPoints',
      header: 'Total Pts',
      cell: info => <div className="text-center font-black text-slate-900 text-sm bg-slate-100 rounded px-2 py-0.5 inline-block">{info.getValue() as number}</div>,
    },
    {
      accessorKey: 'curriculumAvg',
      header: 'Curr Avg',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="text-center">
            {r.curriculumAttempts > 0 ? (
              <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.curriculumAvg > 65 ? 'text-emerald-700' : r.curriculumAvg > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {r.curriculumAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 font-bold">—</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'independentAvg',
      header: 'Indep Avg',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="text-center">
            {r.independentAttempts > 0 && r.independentAvg !== null ? (
              <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.independentAvg > 65 ? 'text-emerald-700' : r.independentAvg > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {r.independentAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 font-bold">—</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'overallAvg',
      header: 'Total Avg',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="text-center">
            {r.totalAttempts > 0 ? (
              <span className="text-sm font-black text-slate-600">
                {r.overallAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 font-bold">—</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'onTimePct',
      header: 'On-Time',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="text-center">
            {r.blocksCompleted > 0 ? (
              <span className={`text-sm font-bold ${r.onTimePct > 65 ? 'text-emerald-600' : r.onTimePct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {r.onTimePct.toFixed(0)}%
              </span>
            ) : <span className="text-slate-300 font-bold">—</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'academicRisk',
      header: 'Academic',
      cell: info => {
        const val = info.getValue() as RiskLevel;
        return (
          <div className="text-center">
            <span className={`text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full ${riskColors[val].badge}`}>
              {val === 'red' ? 'At Risk' : val === 'yellow' ? 'Attention' : val === 'green' ? 'On Track' : 'Evaluating'}
            </span>
          </div>
        );
      },
      sortingFn: (rowA, rowB, columnId) => {
        const rank = { red: 0, yellow: 1, green: 2, gray: 3 };
        return rank[rowA.original.academicRisk] - rank[rowB.original.academicRisk];
      },
    },
    {
      accessorKey: 'complianceRisk',
      header: 'Participation',
      cell: info => {
        const val = info.getValue() as RiskLevel;
        return (
          <div className="text-center">
            <span className={`text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full ${riskColors[val].badge}`}>
              {val === 'red' ? 'At Risk' : val === 'yellow' ? 'Attention' : val === 'green' ? 'On Track' : 'Evaluating'}
            </span>
          </div>
        );
      },
      sortingFn: (rowA, rowB, columnId) => {
        const rank = { red: 0, yellow: 1, green: 2, gray: 3 };
        return rank[rowA.original.complianceRisk] - rank[rowB.original.complianceRisk];
      },
    },
    {
      id: 'actions',
      header: '',
      cell: info => (
        <div className="text-center">
          <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
    },
  ], []);

  const { enriched, allEnriched, scopedRoster, emailToUserId } = useMemo(() => {
    if (!adminData) return { enriched: [], allEnriched: [], scopedRoster: [], emailToUserId: new Map<string, string>() };

    const profileMap = new Map<string, string>();
    const emailToUserIdMap = new Map<string, string>();
    const facultyProfiles: RosterEntry[] = [];

    profiles.forEach((p: Profile) => {
      const email = p?.email || p?.email;
      if (p?.id && email) {
        profileMap.set(p.id, email);
        emailToUserIdMap.set(email.toLowerCase(), p.id);
        
        if (p.role === 'faculty') {
          facultyProfiles.push({
            email: email,
            name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || email,
            last_name: p.last_name || p.full_name?.split(' ').pop() || '',
            pgy: 'Faculty',
            track: 'faculty',
            status: 'active',
            advisor: null,
            role: 'faculty',
          } as RosterEntry);
        }
      }
    });

    const allEnrichedResults = allResults
      .filter((r: Result & { email?: string | null }) => !r.topic?.toLowerCase().includes('demo'))
      .map((r: Result & { email?: string | null }) => ({
        ...r,
        email: r.legacy_email || (r.user_id ? profileMap.get(r.user_id) : null),
      }))
      .filter((r: Result & { email?: string | null }) => r.email);

    const enrichedResults = allEnrichedResults
      .filter((r: Result & { email?: string | null }) => (selectedYear === 0 || r.academic_year === selectedYear));

    // Merge faculty from profiles who might not be in authorized_roster
    const rosterEmails = new Set(roster.map((r: RosterEntry) => r.email?.toLowerCase()));
    const missingFaculty = facultyProfiles.filter(f => f.email && !rosterEmails.has(f.email.toLowerCase()));
    const combinedRoster = [...roster, ...missingFaculty];

    // Only active FM residents are scored. Faculty and fellows are excluded (except faculty when requested);
    // graduates are hidden unless the toggle is on.
    const scopedRosterList = combinedRoster.filter((r: RosterEntry) =>
      isActiveResident(r) || (showGraduates && isGraduated(r)) || r.track === 'faculty' || r.pgy === 'Faculty' || r.role === 'faculty'
    );

    return { enriched: enrichedResults, allEnriched: allEnrichedResults, scopedRoster: scopedRosterList, emailToUserId: emailToUserIdMap };
  }, [adminData, selectedYear, showGraduates, profiles, allResults, roster]);

  const rawResidentStats = useMemo(() => {
    if (!adminData) return [];
    
    const academicYear = selectedYear;
    // Required curriculum blocks for this year whose due date has already passed.
    const dueBlocks = getDueBlocks(blocks || [], block_schedule || [], academicYear);

    const stats: ResidentStat[] = scopedRoster.map((resident: RosterEntry) => {
      const resResults = enriched.filter(
        (r: Result & { email?: string | null }) => r.email?.toLowerCase() === resident.email?.toLowerCase()
      );

      const blockResults = resResults.filter((r: Result & { email?: string | null }) => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));

      const assignedResults = blockResults.filter((r: Result & { email?: string | null }) => (r.academic_points || 0) > 0 || r.timing_status != null);
      const independentResults = blockResults.filter((r: Result & { email?: string | null }) => (!r.academic_points || r.academic_points === 0) && r.timing_status == null);

      // Dedupe by topic — for each block, keep best timing (highest points)
      let onTimePoints = 0;
      let latePoints = 0;
      let bonusPoints = 0;
      let attendancePoints = 0;
      let manualPoints = 0;

      const topicBestPts = new Map<string, number>();

      resResults
        .filter((r: Result & { email?: string | null }) => (r.academic_points || 0) > 0 || r.timing_status != null)
        .forEach((r: Result & { email?: string | null }) => {
          if (r.topic?.includes('[Attendance]')) {
            attendancePoints += (r.academic_points || 1);
          } else if (r.topic?.includes('[Manual]')) {
            manualPoints += (r.academic_points || 0);
          } else {
            const cur = topicBestPts.get(r.topic) || 0;
            if ((r.academic_points || 0) > cur || !topicBestPts.has(r.topic)) {
              topicBestPts.set(r.topic, r.academic_points || 0);
            }
          }
        });
        
      const totalPoints = Array.from(topicBestPts.values()).reduce((a, b) => a + b, 0) + attendancePoints + manualPoints;

      Array.from(topicBestPts.entries()).forEach(([topic, pts]) => {
        if (topic.toLowerCase().includes('bonus')) {
          bonusPoints += pts;
        } else if (pts === 2) {
          onTimePoints += pts;
        } else if (pts === 1) {
          latePoints += pts;
        } else {
          // Catch-all if points are somehow > 2 or some edge case, default to onTimePoints
          onTimePoints += pts;
        }
      });

      const blocksCompleted = topicBestPts.size;

      const nonBonusBlocks = Array.from(topicBestPts.entries()).filter(([topic]) => !topic?.toLowerCase().includes('bonus'));
      const onTimeBlocks = nonBonusBlocks.filter(([, pts]) => pts >= 2);
      const onTimePct = nonBonusBlocks.length > 0
        ? (onTimeBlocks.length / nonBonusBlocks.length) * 100
        : 100;

      const curriculumQuizzes = assignedResults.filter((r: Result & { email?: string | null }) => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));
      const curriculumAvg = curriculumQuizzes.length > 0
        ? curriculumQuizzes.reduce((a: number, r: Result & { email?: string | null }) => a + (r.percentage || 0), 0) / curriculumQuizzes.length
        : 0;

      const independentQuizzes = independentResults.filter((r: Result & { email?: string | null }) => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));
      const independentAvg = independentQuizzes.length > 0
        ? independentQuizzes.reduce((a: number, r: Result & { email?: string | null }) => a + (r.percentage || 0), 0) / independentQuizzes.length
        : null;

      const resQuizzes = resResults.filter((r: Result & { email?: string | null }) => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));
      const overallAvg = resQuizzes.length > 0
        ? resQuizzes.reduce((a: number, r: Result & { email?: string | null }) => a + (r.percentage || 0), 0) / resQuizzes.length
        : 0;

      // Early-warning: past-due blocks this resident hasn't completed.
      const completedTitles = new Set(Array.from(topicBestPts.keys()));
      const overdueCount = getOverdueBlocks(dueBlocks, completedTitles).length;
      
      const isFacultyUser = resident.track === 'faculty' || resident.pgy === 'Faculty' || resident.role === 'faculty';
      const academicRisk = isFacultyUser ? 'gray' : getRiskLevel(curriculumAvg, assignedResults.length);
      const complianceRisk = isFacultyUser ? 'gray' : getComplianceRisk(onTimePct, blocksCompleted, overdueCount);

      // Early-warning: recent scores sliding vs earlier ones (even if the average still looks OK).
      const scoresChrono = [...resResults]
        .filter((r: Result & { email?: string | null }) => typeof r.percentage === 'number')
        .sort((a: Result, b: Result) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
        .map((r: Result & { email?: string | null }) => r.percentage);
      const { delta: trendDelta, declining: rawDeclining } = computeTrend(scoresChrono);
      const declining = isFacultyUser ? false : rawDeclining;

      const riskReasons = isFacultyUser ? [] : getRiskReasons({
        curriculumAvg,
        curriculumAttempts: assignedResults.length,
        onTimePct,
        blocksCompleted,
        overdueCount,
        trendDelta,
      });

      const totalAttendance = attendancePoints;

      return {
        userId: emailToUserId.get(resident.email?.toLowerCase()) || null,
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
        onTimePoints,
        latePoints,
        bonusPoints,
        
        academicRisk,
        complianceRisk,
        overdueCount,
        trendDelta,
        declining,
        riskReasons,
        results: resResults.sort((a: Result, b: Result) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()),
        totalAttendance,
      };
    });

    return stats.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [adminData, showGraduates, selectedYear, scopedRoster, enriched, emailToUserId]);

  const residentStats = rawResidentStats;

  const overviewFilteredResidents = useMemo(() => {
    return residentStats.filter(r => {
      if (overviewPgyFilter !== 'ALL') {
        if (overviewPgyFilter === 'PGY-1' && !r.label.includes('PGY-1')) return false;
        if (overviewPgyFilter === 'PGY-2' && !r.label.includes('PGY-2')) return false;
        if (overviewPgyFilter === 'PGY-3' && !r.label.includes('PGY-3')) return false;
      }
      if (overviewSearch.trim()) {
        const q = overviewSearch.toLowerCase();
        return r.name.toLowerCase().includes(q) || 
               (r.last_name && r.last_name.toLowerCase().includes(q)) || 
               r.email.toLowerCase().includes(q) ||
               (r.advisor && r.advisor.toLowerCase().includes(q));
      }
      return true;
    });
  }, [residentStats, overviewSearch, overviewPgyFilter]);

  const exportOverviewToCSV = () => {
    const yearLabel = selectedYear === 0 ? 'All_Years' : `AY_${selectedYear}`;
    const headers = ['Resident Name', 'Email', 'PGY', 'Advisor', 'Curriculum Avg %', 'Independent Avg %', 'Overall Avg %', 'Blocks Completed', 'On-Time %', 'Total Points', 'Attendance', 'Academic Status', 'Participation Status'];
    
    const rows = overviewFilteredResidents.map(r => {
      const acadStatus = r.academicRisk === 'red' ? 'At Risk' : r.academicRisk === 'yellow' ? 'Needs Attention' : r.academicRisk === 'green' ? 'On Track' : 'Evaluating';
      const partStatus = r.complianceRisk === 'red' ? 'At Risk' : r.complianceRisk === 'yellow' ? 'Needs Attention' : r.complianceRisk === 'green' ? 'On Track' : 'Evaluating';

      return [
        `"${formatLastNameFirst(r.name, r.last_name).replace(/"/g, '""')}"`,
        `"${r.email}"`,
        `"${r.label}"`,
        `"${(r.advisor || '').replace(/"/g, '""')}"`,
        r.curriculumAttempts > 0 ? r.curriculumAvg.toFixed(1) : '',
        r.independentAttempts > 0 && r.independentAvg !== null ? r.independentAvg.toFixed(1) : '',
        r.totalAttempts > 0 ? r.overallAvg.toFixed(1) : '',
        String(r.blocksCompleted),
        r.blocksCompleted > 0 ? r.onTimePct.toFixed(0) : '',
        String(r.totalPoints),
        String(r.totalAttendance),
        `"${acadStatus}"`,
        `"${partStatus}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FMC_Resident_Performance_${yearLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Residents this faculty advises — matched by `authorized_roster.advisor == profile.full_name`
  const myAdvisees = useMemo(() => {
    if (!facultyName) return [] as ResidentStat[];
    const needle = facultyName.toLowerCase().trim();
    return residentStats.filter(r => (r.advisor || '').toLowerCase().trim() === needle);
  }, [residentStats, facultyName]);

  const redFlagged = residentStats.filter(r => r.academicRisk === 'red' || r.complianceRisk === 'red');
  const yellowFlagged = residentStats.filter(r =>
    r.academicRisk !== 'red' && r.complianceRisk !== 'red' &&
    (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining)
  );
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
    <DataTable
      columns={columns}
      data={residents}
      globalSearchPlaceholder="Search residents..."
      onRowClick={(row) => setSelectedResident(row)}
      rowClassName={(r) => {
        if (r.academicRisk === 'red' || r.complianceRisk === 'red') return riskColors.red.row;
        if (r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining) return riskColors.yellow.row;
        if (r.academicRisk === 'gray' || r.complianceRisk === 'gray') return riskColors.gray.row;
        return riskColors.green.row;
      }}
    />
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

  const isFacultyOnly = userIsFaculty && !userIsAdmin;
  const bannerScope = isFacultyOnly ? myAdvisees : residentStats;
  const bannerFlaggedCount = bannerScope.filter(r => r.academicRisk === 'red' || r.complianceRisk === 'red' || r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining).length;
  const bannerRedCount = bannerScope.filter(r => r.academicRisk === 'red' || r.complianceRisk === 'red').length;
  const bannerTarget: SubTab = isFacultyOnly ? 'my_advisees' : 'at_risk';

  return (
    <div className="space-y-8">
      {/* Tier-1 alert: surface flagged residents on entry so they're not buried in a tab */}
      {bannerFlaggedCount > 0 && (
        <button
          onClick={() => setActiveSubTab(bannerTarget)}
          className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 rounded-3xl text-left hover:shadow-md transition-all animate-fade-in"
        >
          <div className="w-11 h-11 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black">!</div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800">{bannerFlaggedCount} resident{bannerFlaggedCount === 1 ? '' : 's'} need{bannerFlaggedCount === 1 ? 's' : ''} attention</p>
            <p className="text-xs font-bold text-slate-500">{bannerRedCount > 0 ? `${bannerRedCount} at risk · ` : ''}tap to review who and why</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </button>
      )}

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
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Users</span>
        </div>
      </div>

      {/* Sub Tabs — faculty see a "My Advisees" tab unique to their account */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50 overflow-x-auto">
        {(() => {
          const baseTabs: [SubTab, string][] = [
            ['overview', 'Program Overview'],
            ['at_risk', `Flagged (${redFlagged.length + yellowFlagged.length})`],
            ['by_pgy', 'By Class Year'],
            ['by_block', 'By Block'],
            ['heatmap', 'Trend Analysis'],
          ];
          // Faculty-only tab: appears first when user is faculty (admins can also pull it up if they have advisees)
          const tabs: [SubTab, string][] = userIsFaculty && facultyName
            ? [['my_advisees', `My Advisees (${myAdvisees.length})`], ...baseTabs]
            : baseTabs;
          return tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setActiveSubTab(id);
                setOverviewSearch('');
              }}
              className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeSubTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ));
        })()}
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
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
      </div>

      {/* Risk Legend */}
      <RiskLegend />

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
                    const subject = encodeURIComponent("FMC Board Review App: Advisee Performance Update");
                    let bodyStr = "Hello,\r\n\r\nHere is a summary of your advisees' current performance in the FMC Board Review App. Please log in to the Faculty Console for a full breakdown.\r\n\r\n";
                    myAdvisees.forEach(r => {
                      const isAtRisk = r.academicRisk === 'red' || r.complianceRisk === 'red';
                      const isAttention = r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining;
                      
                      const status = isAtRisk ? '🚨 AT RISK' : isAttention ? '⚠️ NEEDS ATTENTION' : '✅ ON TRACK';
                      
                      bodyStr += `\r\n👤 ${r.name} (${r.label})\r\n`;
                      bodyStr += `   Status: ${status}\r\n`;
                      bodyStr += `   Scores: ${r.overallAvg.toFixed(1)}% Avg (${r.totalAttempts} total attempts)\r\n`;
                      bodyStr += `   Compliance: ${r.blocksCompleted} blocks completed (${r.onTimePct.toFixed(0)}% on time)\r\n`;
                      if (r.riskReasons.length > 0) {
                        bodyStr += `   Flags: ${r.riskReasons.join(' | ')}\r\n`;
                      }
                    });
                    
                    const appUrl = window.location.origin + '/?admin=performance';
                    bodyStr += `\r\n\r\nView Full Dashboard & Deep Dive Here:\r\n${appUrl}\r\n\r\nThank you for supporting our residents!`;
                    
                    const body = encodeURIComponent(bodyStr);
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
            <div className="p-4"><ResidentTable residents={myAdvisees} /></div>
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
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-800">All Residents</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Click a resident to view their block history</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button 
                  onClick={exportOverviewToCSV}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm shadow-sm"
                  title="Download full resident performance table as CSV"
                >
                  <Download className="w-4 h-4 text-slate-500" /> Export CSV
                </button>
                <button 
                  onClick={() => {
                    // Group all residents by advisor
                    const groups: Record<string, ResidentStat[]> = {};
                    residentStats.forEach(r => {
                      const adv = r.advisor || 'Unassigned';
                      if (!groups[adv]) groups[adv] = [];
                      groups[adv].push(r);
                    });
                    
                    let bodyStr = "Hello Faculty,\r\n\r\nHere is a summary of resident performance in the FMC Board Review App for your advisees. Please log in to the Faculty Console for a full breakdown.\r\n\r\n";
                    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([adv, resList]) => {
                      bodyStr += `\r\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n👨‍⚕️ ADVISOR: ${adv}\r\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n`;
                      resList.forEach(r => {
                        const isAtRisk = r.academicRisk === 'red' || r.complianceRisk === 'red';
                        const isAttention = r.academicRisk === 'yellow' || r.complianceRisk === 'yellow' || r.declining;
                        
                        const status = isAtRisk ? '🚨 AT RISK' : isAttention ? '⚠️ NEEDS ATTENTION' : '✅ ON TRACK';
                        
                        bodyStr += `\r\n👤 ${r.name} (${r.label})\r\n`;
                        bodyStr += `   Status: ${status}\r\n`;
                        bodyStr += `   Scores: ${r.overallAvg.toFixed(1)}% Avg (${r.totalAttempts} total attempts)\r\n`;
                        bodyStr += `   Compliance: ${r.blocksCompleted} blocks completed (${r.onTimePct.toFixed(0)}% on time)\r\n`;
                        if (r.riskReasons.length > 0) {
                          bodyStr += `   Flags: ${r.riskReasons.join(' | ')}\r\n`;
                        }
                      });
                    });
                    
                    const appUrl = window.location.origin + '/?admin=performance';
                    bodyStr += `\r\n\r\nView Full Dashboard & Deep Dive Here:\r\n${appUrl}\r\n\r\nThank you for supporting our residents!`;
                    
                    const subject = encodeURIComponent("FMC Board Review App: Program-Wide Performance Update");
                    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyStr)}`;
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Mail className="w-4 h-4" /> Email Advisors
                </button>
              </div>
            </div>

            {/* Overview Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={overviewSearch}
                  onChange={(e) => setOverviewSearch(e.target.value)}
                  placeholder="Search resident or advisor..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'PGY-1', 'PGY-2', 'PGY-3'] as const).map(pgy => (
                  <button
                    key={pgy}
                    type="button"
                    onClick={() => setOverviewPgyFilter(pgy)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      overviewPgyFilter === pgy
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pgy === 'ALL' ? 'All PGYs' : pgy}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4"><ResidentTable residents={overviewFilteredResidents} /></div>
        </div>
      )}

      {/* Action Needed Tab */}
      {activeSubTab === 'at_risk' && (
        <div className="space-y-6">
          {redFlagged.length > 0 && (
            <div className="bg-white rounded-[32px] border border-red-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-red-50 bg-red-50/40">
                <h3 className="font-black text-red-700">🔴 At Risk — Avg ≤50%, low on-time, or 2+ blocks overdue</h3>
              </div>
              <div className="p-4"><ResidentTable residents={redFlagged} /></div>
            </div>
          )}
          {yellowFlagged.length > 0 && (
            <div className="bg-white rounded-[32px] border border-amber-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-amber-50 bg-amber-50/40">
                <h3 className="font-black text-amber-700">🟡 Needs Attention — Avg ≤65%, on-time below 75%, a block overdue, or recent scores sliding</h3>
              </div>
              <div className="p-4"><ResidentTable residents={yellowFlagged} /></div>
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
      {activeSubTab === 'by_block' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-black text-slate-400">
                <th className="px-6 py-4">Block Title</th>
                <th className="px-4 py-4 text-center">Assigned</th>
                <th className="px-4 py-4 text-center">Completed</th>
                <th className="px-4 py-4 text-center">Attendance</th>
                <th className="px-4 py-4 text-center">Avg Score</th>
                <th className="px-4 py-4 text-center">On-Time %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(blocks || [])
                .filter(b => {
                  if (selectedYear === 0) return true;
                  let year = b.academic_year ? Number(b.academic_year) : 0;
                  if (!year || isNaN(year) || year === 0) {
                    const sched = block_schedule.find((s: import('@/lib/types').BlockSchedule) => s.block_id === b.id);
                    if (sched?.end_date) {
                      const d = new Date(sched.end_date + "T12:00:00Z");
                      year = d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0); // Approx getCurrentAcademicYear logic
                    } else {
                      year = getCurrentAcademicYear();
                    }
                  }
                  return year === selectedYear;
                })
                .sort((a, b) => {
                  const da = block_schedule.find((s: import('@/lib/types').BlockSchedule) => s.block_id === a.id)?.end_date || '';
                  const db = block_schedule.find((s: import('@/lib/types').BlockSchedule) => s.block_id === b.id)?.end_date || '';
                  if (!da && !db) return (a.sort_order || 1000) - (b.sort_order || 1000);
                  if (!da) return 1;
                  if (!db) return -1;
                  return da.localeCompare(db);
                })
                .map(block => {
                // Determine completions by looking for results that matched this block's topic
                const blockResults = allEnriched.filter(r => r.topic === block.title && (!r.academic_year || r.academic_year === selectedYear));
                
                // Keep only the highest academic_points attempt per user
                const userBestPts = new Map<string, Result & { email?: string | null }>();
                blockResults.forEach(r => {
                  const uid = r.user_id || r.legacy_email || r.email;
                  if (!uid) return;
                  const cur = userBestPts.get(uid);
                  if (!cur || (r.academic_points || 0) > (cur.academic_points || 0)) {
                    userBestPts.set(uid, r);
                  }
                });

                const uniqueCompletions = Array.from(userBestPts.values());
                const onTimeCount = uniqueCompletions.filter(r => (r.academic_points || 0) >= 2 || r.timing_status === 'On Time').length;
                const completedCount = uniqueCompletions.length;
                
                const avgScore = completedCount > 0
                  ? uniqueCompletions.reduce((acc, r) => acc + (r.percentage || 0), 0) / completedCount
                  : 0;
                  
                const onTimePct = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0;
                
                const blockAttendance = adminData.attendance?.filter(a => 
                  (selectedYear === 0 && a.topic?.includes(`Block: ${block.title}`)) ||
                  a.topic?.startsWith(`[AY ${selectedYear}] Block: ${block.title}`)
                ).length || 0;

                return (
                  <tr 
                    key={block.id} 
                    onClick={() => {
                      setSelectedBlockDrilldown(block);
                      setBlockDrilldownSearch('');
                      setSelectedQuiz(null);
                    }}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    title="Click to view resident completion drilldown"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{block.title}</div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{block.question_count || 40} questions</div>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600">
                      {scopedRoster.length}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600">
                      {completedCount}
                    </td>
                    <td className="px-4 py-4 text-center font-black text-indigo-600 text-sm">
                      {blockAttendance}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {completedCount > 0 ? (
                        <span className="text-sm font-black text-slate-600">
                          {avgScore.toFixed(1)}%
                        </span>
                      ) : <span className="text-slate-300 font-bold">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {completedCount > 0 ? (
                        <span className={`text-sm font-bold ${onTimePct > 65 ? 'text-emerald-600' : onTimePct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {onTimePct.toFixed(0)}%
                        </span>
                      ) : <span className="text-slate-300 font-bold">—</span>}
                    </td>
                  </tr>
                );
              })}
              {(!blocks || blocks.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-bold">
                    No blocks scheduled for this academic year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
                <div className="p-4"><ResidentTable residents={residents} /></div>
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
                <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
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
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{selectedResident.totalAttendance}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Attend</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.academicRisk].badge}`}>
                    Academic: {selectedResident.academicRisk === 'red' ? 'At Risk' : selectedResident.academicRisk === 'yellow' ? 'Attention' : selectedResident.academicRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.complianceRisk].badge}`}>
                    Participation: {selectedResident.complianceRisk === 'red' ? 'At Risk' : selectedResident.complianceRisk === 'yellow' ? 'Attention' : selectedResident.complianceRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                </div>
                {selectedResident.riskReasons.length > 0 && (
                  <p className="text-xs font-bold text-red-600 mt-3">⚠ {selectedResident.riskReasons.join(' · ')}</p>
                )}

                {userIsAdmin && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    {!isAdjustingPoints ? (
                      <button
                        onClick={() => setIsAdjustingPoints(true)}
                        className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
                      >
                        + Add Manual Points
                      </button>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-wrap md:flex-nowrap items-center gap-3">
                        <input
                          type="number"
                          value={adjustPointsValue}
                          onChange={(e) => setAdjustPointsValue(Number(e.target.value))}
                          className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                          placeholder="Pts"
                        />
                        <input
                          type="text"
                          value={adjustPointsReason}
                          onChange={(e) => setAdjustPointsReason(e.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                          placeholder="Reason (e.g. Noon Conference)"
                        />
                        <button
                          onClick={handleAddManualPoints}
                          disabled={isSubmittingPoints}
                          className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {isSubmittingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </button>
                        <button
                          onClick={() => setIsAdjustingPoints(false)}
                          className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedResident(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all ml-4 shrink-0">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedQuiz ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setSelectedQuiz(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back to Performance
                    </button>
                    <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{formatTopicDisplay(selectedQuiz.topic)}</span>
                  </div>
                  
                  {loadingReview ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                      <p className="font-bold text-sm tracking-widest uppercase">Loading Responses...</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                      <QuizReview items={reviewItems || []} />
                    </div>
                  )}
                </div>
              ) : (() => {
                const assigned = selectedResident.results.filter(r => (r.academic_points || 0) > 0 || r.timing_status != null);
                const custom = selectedResident.results.filter(r => (!r.academic_points || r.academic_points === 0) && r.timing_status == null);

                const assignedQuizzes = assigned.filter(r => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));
                const customQuizzes = custom.filter(r => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]'));
                const attendanceRecords = assigned.filter(r => r.topic?.includes('[Attendance]') || r.topic?.includes('[Manual]'));

                return (
                  <>
                    <div className="flex bg-slate-100/50 p-1 rounded-2xl mb-6">
                      <button 
                        onClick={() => setActiveListTab('questions')}
                        className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all ${activeListTab === 'questions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                      >
                        Questions
                      </button>
                      <button 
                        onClick={() => setActiveListTab('attendance')}
                        className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all ${activeListTab === 'attendance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                      >
                        Attendance
                      </button>
                    </div>

                    {activeListTab === 'questions' ? (
                      <>
                        <div className="mb-8">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Core Curriculum ({assignedQuizzes.length})</h3>
                          {assignedQuizzes.length > 0 ? (
                            <div className="space-y-3">
                              {assignedQuizzes.map((r: Result & { email?: string | null, review_data?: unknown }, i: number) => {
                                const pts = r.academic_points || 0;
                                const timingLabel = r.timing_status === 'Early' ? '🚀 Early'
                                  : r.timing_status === 'On Time' ? '✅ On Time'
                                  : r.timing_status === 'Late' ? '⏰ Late'
                                  : r.timing_status === 'Manual' ? '✨ Manual'
                                  : (pts >= 2 && !r.topic?.toLowerCase().includes('bonus') ? '✅ On Time'
                                  : pts === 1 ? '⏰ Late'
                                  : pts >= 2 ? '⚡ Bonus'
                                  : '—');
                                
                                const blockAttendance = adminData.attendance?.filter(a => 
                                  a.resident_email?.toLowerCase() === selectedResident.email?.toLowerCase() &&
                                  a.topic?.includes(`Block: ${r.topic}`) &&
                                  (selectedYear === 0 || a.topic?.includes(`[AY ${selectedYear}]`))
                                ).length || 0;

                                return (
                                  <button key={`curr-${i}`} onClick={() => openReview(r)} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100/50 group">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-slate-800 text-sm truncate">{formatTopicDisplay(r.topic)}</p>
                                      <p className="text-xs font-bold text-slate-400 mt-0.5">
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'} · {timingLabel}
                                        {(!Array.isArray(r.review_data) || r.review_data.length === 0) ? ' · review unavailable' : ''}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 text-emerald-700' : (r.percentage || 0) > 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                        {(r.percentage || 0).toFixed(1)}%
                                      </span>
                                      {blockAttendance > 0 && (
                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg w-12 text-center">{blockAttendance} Att</span>
                                      )}
                                      <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-slate-400 font-bold text-sm bg-slate-50 p-4 rounded-xl">No curriculum recorded for this year.</p>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Independent Study ({customQuizzes.length})</h3>
                          {customQuizzes.length > 0 ? (
                            <div className="space-y-3">
                              {customQuizzes.map((r: Result & { email?: string | null, review_data?: unknown }, i: number) => (
                                <button key={`ind-${i}`} onClick={() => openReview(r)} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50 transition-all border border-indigo-50/50 group">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{r.topic}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                                      {(!Array.isArray(r.review_data) || r.review_data.length === 0) ? ' · review unavailable' : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 text-emerald-700' : (r.percentage || 0) > 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                      {(r.percentage || 0).toFixed(1)}%
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 font-bold text-sm bg-slate-50 p-4 rounded-xl">No independent study recorded.</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Attendance & Manual Credit ({attendanceRecords.length})</h3>
                        {attendanceRecords.length > 0 ? (
                          <div className="space-y-3">
                            {attendanceRecords.map((r: Result & { email?: string | null, review_data?: unknown }, i: number) => {
                              const pts = r.academic_points || 0;
                              return (
                                <div key={`att-${i}`} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100/50">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{formatTopicDisplay(r.topic)}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                                      {(() => {
                                        const att = adminData.attendance?.find(a => a.resident_email === selectedResident.email && a.topic && r.topic?.includes(a.topic));
                                        return att?.date ? new Date(att.date + 'T12:00:00').toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—');
                                      })()} · {r.topic?.includes('[Manual]') ? '✨ Manual Credit' : r.topic?.toLowerCase().includes('advisor meeting') ? '🗣️ Advisor Meeting' : 'Noon Conference Attendance'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center" title="Attendance/Manual Credit">
                                      <Check className="w-4 h-4 mr-1" /> {pts} pt{pts !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-slate-400 font-bold text-sm bg-slate-50 p-4 rounded-xl">No attendance recorded.</p>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Block Drilldown Modal */}
      {selectedBlockDrilldown && (() => {
        const block = selectedBlockDrilldown;
        const sched = block_schedule.find((s: import('@/lib/types').BlockSchedule) => s.block_id === block.id);
        const blockResults = allEnriched.filter(r => r.topic === block.title && (!r.academic_year || r.academic_year === selectedYear));
        
        // Find highest academic points / best completion attempt per resident
        const userBestPts = new Map<string, Result & { email?: string | null }>();
        blockResults.forEach(r => {
          const uid = (r.user_id || r.legacy_email || r.email || '').toLowerCase();
          if (!uid) return;
          const cur = userBestPts.get(uid);
          if (!cur || (r.academic_points || 0) > (cur.academic_points || 0) || (r.percentage || 0) > (cur.percentage || 0)) {
            userBestPts.set(uid, r);
          }
        });

        const uniqueCompletions = Array.from(userBestPts.values());
        const onTimeCount = uniqueCompletions.filter(r => (r.academic_points || 0) >= 2 || r.timing_status === 'On Time' || r.timing_status === 'Early').length;
        const completedCount = uniqueCompletions.length;
        const avgScore = completedCount > 0
          ? uniqueCompletions.reduce((acc, r) => acc + (r.percentage || 0), 0) / completedCount
          : 0;
        const onTimePct = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0;
        const blockAttendance = adminData?.attendance?.filter(a => 
          (selectedYear === 0 && a.topic?.includes(`Block: ${block.title}`)) ||
          a.topic === `[AY ${selectedYear}] Block: ${block.title}`
        ).length || 0;

        const filteredResidents = residentStats.filter(r => {
          if (!blockDrilldownSearch) return true;
          const q = blockDrilldownSearch.toLowerCase();
          return r.name.toLowerCase().includes(q) || (r.last_name && r.last_name.toLowerCase().includes(q)) || r.email.toLowerCase().includes(q);
        });

        return (
          <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-full uppercase tracking-wider">
                      {selectedYear === 0 ? 'All Years' : `AY ${selectedYear}`}
                    </span>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">{block.title}</h2>
                  </div>
                  <p className="text-sm font-bold text-slate-400 mb-6">
                    {block.question_count || 40} Questions {sched?.start_date && sched?.end_date ? `· ${sched.start_date} to ${sched.end_date}` : ''}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-slate-800">{residentStats.length}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Assigned</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-slate-800">{completedCount} <span className="text-xs text-slate-400 font-bold">/ {residentStats.length}</span></div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Completed</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className={`text-xl font-black ${onTimePct > 65 ? 'text-emerald-600' : onTimePct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {completedCount > 0 ? `${onTimePct.toFixed(0)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">On-Time %</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-slate-800">
                        {completedCount > 0 ? `${avgScore.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Cohort Avg</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-indigo-600">{blockAttendance}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Attendance</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedBlockDrilldown(null); setSelectedQuiz(null); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all ml-4 shrink-0">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Search bar & CSV Export */}
              <div className="p-4 md:px-8 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={blockDrilldownSearch}
                    onChange={(e) => setBlockDrilldownSearch(e.target.value)}
                    placeholder="Search resident by name..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                    Showing {filteredResidents.length} of {residentStats.length} residents
                  </span>
                  <button
                    onClick={() => {
                      const yearLabel = selectedYear === 0 ? 'All_Years' : `AY_${selectedYear}`;
                      const headers = ['Resident Name', 'Email', 'PGY', 'Advisor', 'Status', 'Completion Date', 'Score %', 'Score Raw', 'Total Questions', 'Academic Points'];
                      const rows = filteredResidents.map(resident => {
                        const result = (resident.userId ? userBestPts.get(resident.userId.toLowerCase()) : null) || 
                                       userBestPts.get(resident.email.toLowerCase()) ||
                                       blockResults.find(br => (br.user_id && resident.userId && br.user_id === resident.userId) || (br.email && br.email.toLowerCase() === resident.email.toLowerCase()) || (br.legacy_email && br.legacy_email.toLowerCase() === resident.email.toLowerCase()));
                        
                        const isCompleted = !!result;
                        const pts = result?.academic_points || 0;
                        const isOnTime = result?.timing_status === 'Early' || result?.timing_status === 'On Time' || (pts >= 2 && !result?.topic?.toLowerCase().includes('bonus'));
                        const isLate = result?.timing_status === 'Late' || pts === 1;
                        const status = isCompleted ? (isOnTime ? 'On Time' : isLate ? 'Late' : 'Completed') : 'Not Completed';
                        const dateStr = result?.created_at ? new Date(result.created_at).toISOString().split('T')[0] : '';
                        const scorePct = isCompleted ? (result.percentage || 0).toFixed(1) : '';
                        const scoreRaw = isCompleted ? String(result.score || 0) : '';
                        const totalQ = String(result?.total || block.question_count || 40);

                        return [
                          `"${formatLastNameFirst(resident.name, resident.last_name).replace(/"/g, '""')}"`,
                          `"${resident.email}"`,
                          `"${resident.label}"`,
                          `"${(resident.advisor || '').replace(/"/g, '""')}"`,
                          `"${status}"`,
                          `"${dateStr}"`,
                          scorePct,
                          scoreRaw,
                          totalQ,
                          String(pts)
                        ].join(',');
                      });

                      const csvContent = [headers.join(','), ...rows].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      const cleanTitle = block.title.replace(/[^a-zA-Z0-9_-]/g, '_');
                      link.setAttribute('download', `FMC_Block_${cleanTitle}_${yearLabel}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-sm"
                    title="Export block completions to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Resident List Table or Quiz Review */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {selectedQuiz ? (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setSelectedQuiz(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Back to Resident List
                      </button>
                      <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{formatTopicDisplay(selectedQuiz.topic)}</span>
                    </div>
                    
                    {loadingReview ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                        <p className="font-bold text-sm tracking-widest uppercase">Loading Responses...</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <QuizReview items={reviewItems || []} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-black text-slate-400">
                          <th className="px-4 py-3">Resident</th>
                          <th className="px-3 py-3 text-center">PGY</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-center">Date</th>
                          <th className="px-3 py-3 text-center">Score</th>
                          <th className="px-3 py-3 text-center">Points</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredResidents.map(resident => {
                          const result = (resident.userId ? userBestPts.get(resident.userId.toLowerCase()) : null) || 
                                         userBestPts.get(resident.email.toLowerCase()) ||
                                         blockResults.find(br => (br.user_id && resident.userId && br.user_id === resident.userId) || (br.email && br.email.toLowerCase() === resident.email.toLowerCase()) || (br.legacy_email && br.legacy_email.toLowerCase() === resident.email.toLowerCase()));
                          
                          const isCompleted = !!result;
                          const pts = result?.academic_points || 0;
                          const isOnTime = result?.timing_status === 'Early' || result?.timing_status === 'On Time' || (pts >= 2 && !result?.topic?.toLowerCase().includes('bonus'));
                          const isLate = result?.timing_status === 'Late' || pts === 1;

                          return (
                            <tr key={resident.email || resident.name} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-800">
                                {formatLastNameFirst(resident.name, resident.last_name)}
                              </td>
                              <td className="px-3 py-3 text-center text-xs font-bold text-slate-500">
                                {resident.label}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {isCompleted ? (
                                  isOnTime ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-black rounded-md">
                                      🚀 On-Time
                                    </span>
                                  ) : isLate ? (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-black rounded-md">
                                      ⏰ Late
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-black rounded-md">
                                      Completed
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-md">
                                    Not Completed
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center text-xs text-slate-500 font-medium">
                                {result?.created_at ? new Date(result.created_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {isCompleted ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-md font-black ${(result.percentage || 0) >= 65 ? 'bg-emerald-50 text-emerald-700' : (result.percentage || 0) > 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                    {(result.percentage || 0).toFixed(0)}% <span className="font-normal text-[11px] opacity-75">({result.score || 0}/{result.total || block.question_count || 40})</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center font-black text-slate-700 text-xs">
                                {isCompleted ? `${pts} pt${pts !== 1 ? 's' : ''}` : '0 pts'}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isCompleted && result && (
                                  <button
                                    onClick={() => openReview(result)}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Review
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredResidents.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold text-sm">
                              No residents match your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}



