'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName, formatLastNameFirst, formatTopicDisplay } from '@/lib/utils';
import { isAdmin, isFaculty, getFacultyAdviseeFilter } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear, deriveLabel, isActiveResident, isGraduated, isFacultyRow, getResidentClassYear, residentMatchesCohort } from '@/lib/academicYear';
import { useSortState, sortItems, SortHeader, lastName } from '@/lib/sorting';
import { BarChartIcon, Users, Loader2, TrendingUp, Target, X, ChevronRight, ChevronLeft, Mail, Search, Check, Download, FileText, Printer } from './AppIcons';
import { Flame, Sparkles, HelpCircle, Eye } from 'lucide-react';
import QuestionHeatmap from './QuestionHeatmap';
import AdviseeDossierModal from './AdviseeDossierModal';
import RiskLegend from './RiskLegend';
import QuizReview from './QuizReview';
import { RiskLevel, getRiskLevel, getDueBlocks, getOverdueBlocks, getComplianceRisk, getRiskReasons, computeTrend } from '@/lib/residentRisk';
import { DataTable } from './DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { openEmailCompose, generateBlockReminderEmail } from '@/lib/emailHelper';

interface ResidentStat {
  userId: string | null;
  name: string;
  last_name: string;
  email: string;
  pgy: string;
  label: string;
  classYear?: number | null;
  cohortYear?: number | null;
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
  red: { row: 'bg-red-50/60 dark:bg-red-950/20', badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300', dot: 'bg-red-500' },
  yellow: { row: 'bg-amber-50/40 dark:bg-amber-950/20', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-400' },
  green: { row: '', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', dot: 'bg-emerald-400' },
  gray: { row: 'bg-slate-50/40 dark:bg-slate-800/30', badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-300 dark:bg-slate-600' },
};

import { AdminData, User, Profile, Result, RosterEntry, ResidentQotdHistoryItem } from '@/lib/types';
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
  const [dossierResidentEmail, setDossierResidentEmail] = useState<string | null>(null);
  const [showCccModal, setShowCccModal] = useState(false);

  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [adjustPointsValue, setAdjustPointsValue] = useState<number>(1);
  const [adjustPointsReason, setAdjustPointsReason] = useState('Noon Conference');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);

  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [reviewItems, setReviewItems] = useState<any[] | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  
  const [selectedBlockDrilldown, setSelectedBlockDrilldown] = useState<any | null>(null);
  const [blockDrilldownSearch, setBlockDrilldownSearch] = useState('');
  const [blockDrilldownCohort, setBlockDrilldownCohort] = useState<'residents' | 'faculty'>('residents');
  
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewPgyFilter, setOverviewPgyFilter] = useState<'ALL' | 'PGY-1' | 'PGY-2' | 'PGY-3' | 'FACULTY'>('ALL');

  const [activeListTab, setActiveListTab] = useState<'questions' | 'attendance' | 'qotd'>('questions');
  const [residentQotdHistory, setResidentQotdHistory] = useState<ResidentQotdHistoryItem[] | null>(null);
  const [loadingResidentQotd, setLoadingResidentQotd] = useState(false);
  const [residentQotdMeta, setResidentQotdMeta] = useState<{
    streak?: { current: number; max: number; lastDate: string | null };
    stats?: { totalAnswered: number; totalCorrect: number; accuracy: number };
  } | null>(null);

  useEffect(() => {
    if (!selectedResident) {
      setResidentQotdHistory(null);
      setResidentQotdMeta(null);
      return;
    }

    let isMounted = true;
    setLoadingResidentQotd(true);
    setResidentQotdHistory(null);

    const queryParam = selectedResident.userId
      ? `residentUserId=${encodeURIComponent(selectedResident.userId)}`
      : `residentEmail=${encodeURIComponent(selectedResident.email)}`;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      fetch(`/api/admin/qotd-analytics?${queryParam}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch resident QOTD stats');
          return res.json();
        })
        .then((data) => {
          if (!isMounted) return;
          setResidentQotdHistory(data.history || []);
          setResidentQotdMeta({ streak: data.streak, stats: data.stats });
        })
        .catch((err) => {
          console.error('Error fetching resident QOTD stats:', err);
          if (isMounted) {
            setResidentQotdHistory([]);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingResidentQotd(false);
        });
    });

    return () => {
      isMounted = false;
    };
  }, [selectedResident]);

  const openQotdReview = (h: ResidentQotdHistoryItem) => {
    setSelectedQuiz({
      topic: `Question of the Day: ${h.date} (${h.category})`,
    });
    setReviewItems([
      {
        question: {
          id: h.questionId,
          question_text: h.questionText,
          options: h.options,
          correct_index: h.correctIndex,
          explanation: h.explanation,
          category: h.category,
          year: h.year,
        },
        selected: h.selectedIndex,
      },
    ]);
    setLoadingReview(false);
  };

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
      
      const hydrated = rd.map((item: { q: string; status?: string; explanation?: string; submitted_answer?: string; a?: any }) => {
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
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatLastNameFirst(r.name, r.last_name)}</span>
            </div>
            {r.riskReasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {r.riskReasons.map((reason, ri) => (
                  <span
                    key={ri}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${reason.includes('overdue') ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : reason.includes('Trending') ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
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
      cell: info => <div className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">{info.getValue() as string}</div>,
    },
    {
      id: 'quizPoints',
      accessorFn: row => (row.totalPoints - row.totalAttendance),
      header: 'Block Pts',
      cell: info => <div className="text-center font-black text-slate-700 dark:text-slate-300 text-sm">{info.getValue() as number}</div>,
      sortingFn: (rowA, rowB, columnId) => {
        const a = rowA.original.totalPoints - rowA.original.totalAttendance;
        const b = rowB.original.totalPoints - rowB.original.totalAttendance;
        return a - b;
      },
    },
    {
      accessorKey: 'totalAttendance',
      header: 'Attend Pts',
      cell: info => <div className="text-center font-black text-indigo-600 dark:text-indigo-400 text-sm">{info.getValue() as number}</div>,
    },
    {
      accessorKey: 'totalPoints',
      header: 'Total Pts',
      cell: info => <div className="text-center font-black text-slate-900 dark:text-white text-sm bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 inline-block">{info.getValue() as number}</div>,
    },
    {
      accessorKey: 'curriculumAvg',
      header: 'Curr Avg',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="text-center">
            {r.curriculumAttempts > 0 ? (
              <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.curriculumAvg > 65 ? 'text-emerald-700 dark:text-emerald-400' : r.curriculumAvg > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {r.curriculumAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
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
              <span className={`text-sm font-black px-2 py-1 rounded-lg ${r.independentAvg > 65 ? 'text-emerald-700 dark:text-emerald-400' : r.independentAvg > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {r.independentAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
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
              <span className="text-sm font-black text-slate-600 dark:text-slate-300">
                {r.overallAvg.toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
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
              <span className={`text-sm font-bold ${r.onTimePct > 65 ? 'text-emerald-600 dark:text-emerald-400' : r.onTimePct > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {r.onTimePct.toFixed(0)}%
              </span>
            ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
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

  const { enriched, allEnriched, scopedResidents, facultyList, emailToUserId } = useMemo(() => {
    if (!adminData) return { enriched: [], allEnriched: [], scopedResidents: [], facultyList: [], emailToUserId: new Map<string, string>() };

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

    // Scoped Residents: Only active FM residents (and graduates if toggled on).
    // Faculty are strictly excluded from the resident cohort.
    const scopedResidentList = combinedRoster.filter((r: RosterEntry) =>
      isActiveResident(r) || (showGraduates && isGraduated(r))
    );

    // Faculty: Identified faculty and staff
    const facultyRosterList = combinedRoster.filter((r: RosterEntry) =>
      isFacultyRow(r)
    );

    return {
      enriched: enrichedResults,
      allEnriched: allEnrichedResults,
      scopedResidents: scopedResidentList,
      facultyList: facultyRosterList,
      emailToUserId: emailToUserIdMap
    };
  }, [adminData, selectedYear, showGraduates, profiles, allResults, roster]);

  const computeUserStats = useMemo(() => {
    return (list: RosterEntry[], isFacultyUser: boolean): ResidentStat[] => {
      if (!adminData) return [];
      
      const academicYear = selectedYear;
      // Required curriculum blocks for this year whose due date has already passed.
      const dueBlocks = getDueBlocks(blocks || [], block_schedule || [], academicYear);

      const stats: ResidentStat[] = list.map((resident: RosterEntry) => {
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
        const overdueCount = isFacultyUser ? 0 : getOverdueBlocks(dueBlocks, completedTitles).length;
        
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
          label: isFacultyUser ? 'Faculty' : deriveLabel(resident, academicYear),
          classYear: getResidentClassYear(resident),
          cohortYear: resident.cohort_year,
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
    };
  }, [adminData, selectedYear, blocks, block_schedule, enriched, emailToUserId]);

  const residentStats = useMemo(() => {
    return computeUserStats(scopedResidents, false);
  }, [scopedResidents, computeUserStats]);

  const facultyStats = useMemo(() => {
    return computeUserStats(facultyList, true);
  }, [facultyList, computeUserStats]);

  const overviewFilteredResidents = useMemo(() => {
    const activeAY = selectedYear === 0 ? getCurrentAcademicYear() : selectedYear;
    const baseList = overviewPgyFilter === 'FACULTY' ? facultyStats : residentStats;
    return baseList.filter(r => {
      if (overviewPgyFilter !== 'ALL' && overviewPgyFilter !== 'FACULTY') {
        const cohortMatch = residentMatchesCohort(
          { pgy: r.pgy, cohort_year: r.cohortYear, graduated_year: null, track: 'family_medicine' },
          overviewPgyFilter,
          activeAY
        );
        if (!cohortMatch) return false;
      }
      if (overviewSearch.trim()) {
        const q = overviewSearch.toLowerCase();
        const classYr = r.classYear ? String(r.classYear) : '';
        return r.name.toLowerCase().includes(q) || 
               (r.last_name && r.last_name.toLowerCase().includes(q)) || 
               r.email.toLowerCase().includes(q) ||
               (r.advisor && r.advisor.toLowerCase().includes(q)) ||
               (r.pgy && r.pgy.toLowerCase().includes(q)) ||
               (r.label && r.label.toLowerCase().includes(q)) ||
               classYr.includes(q);
      }
      return true;
    });
  }, [residentStats, facultyStats, overviewSearch, overviewPgyFilter, selectedYear]);

  const exportOverviewToCSV = () => {
    const yearLabel = selectedYear === 0 ? 'All_Years' : `AY_${selectedYear}`;
    const cohortLabel = overviewPgyFilter === 'FACULTY' ? 'Faculty' : 'Resident';
    const headers = [
      overviewPgyFilter === 'FACULTY' ? 'Faculty Name' : 'Resident Name',
      'Email',
      overviewPgyFilter === 'FACULTY' ? 'Role' : 'PGY',
      'Advisor',
      'Curriculum Avg %',
      'Independent Avg %',
      'Overall Avg %',
      'Blocks Completed',
      'On-Time %',
      'Total Points',
      'Attendance',
      'Academic Status',
      'Participation Status'
    ];
    
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
    link.setAttribute('download', `FMC_${cohortLabel}_Performance_${yearLabel}.csv`);
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

  const ResidentTable = ({ residents, hidePagination }: { residents: ResidentStat[], hidePagination?: boolean }) => (
    <DataTable
      columns={columns}
      data={residents}
      hidePagination={hidePagination}
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
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
        <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Performance Data...</p>
      </div>
    );
  }

  if (error || !adminData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 shadow-sm transition-colors">
        <p className="text-red-500 dark:text-red-400 font-bold">{error?.toString() || 'Failed to load data.'}</p>
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
          className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/40 dark:to-amber-950/30 border border-red-100 dark:border-red-900/50 rounded-3xl text-left hover:shadow-md transition-all animate-fade-in"
        >
          <div className="w-11 h-11 bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black">!</div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800 dark:text-white">{bannerFlaggedCount} resident{bannerFlaggedCount === 1 ? '' : 's'} need{bannerFlaggedCount === 1 ? 's' : ''} attention</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{bannerRedCount > 0 ? `${bannerRedCount} at risk · ` : ''}tap to review who and why</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
        </button>
      )}

      {/* Program Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800 dark:text-white">{programAvg.toFixed(1)}%</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Program Avg</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-3">
            <Target className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800 dark:text-white">{boardReadiness}%</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Above 70%</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mb-3">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800 dark:text-white">{redFlagged.length}</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">At Risk</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-colors">
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black text-slate-800 dark:text-white">{residentStats.length}</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Total Users</span>
        </div>
      </div>

      {/* Sub Tabs — faculty see a "My Advisees" tab unique to their account */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50 dark:border-slate-800 overflow-x-auto transition-colors">
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
              className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeSubTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
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
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
            >
              <option value={0}>All Time (YoY Trend)</option>
              {getAvailableAcademicYears().map(year => (
                <option key={year} value={year}>{formatAcademicYear(year)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showGraduates}
                onChange={e => setShowGraduates(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
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
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-emerald-100 dark:border-emerald-950/50 shadow-sm overflow-hidden transition-colors">
          <div className="p-6 border-b border-emerald-50 dark:border-emerald-950/50 bg-emerald-50/40 dark:bg-emerald-950/30 flex items-center justify-between">
            <div>
              <h3 className="font-black text-emerald-700 dark:text-emerald-400">My Advisees</h3>
              <p className="text-xs font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                Residents assigned to {formatDisplayName(facultyName || '')} — click any row to view block history
              </p>
            </div>
            <div className="flex items-center gap-6">
              {myAdvisees.length > 0 && (
                <button 
                  onClick={() => {
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
                    
                    openEmailCompose({
                      bcc: myAdvisees.map(r => r.email).filter(Boolean),
                      subject: "FMC Board Review App: Advisee Performance Update",
                      body: bodyStr,
                    });
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
                >
                  <Mail className="w-4 h-4" /> Email Report
                </button>
              )}
              <div className="text-right hidden sm:block">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{myAdvisees.length}</div>
                <div className="text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest">Advisees</div>
              </div>
            </div>
          </div>
          {myAdvisees.length > 0 ? (
            <div className="p-4"><ResidentTable residents={myAdvisees} /></div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-bold text-slate-500 dark:text-slate-400">No advisees assigned</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Residents are mapped to faculty via the <code>advisor</code> column in the authorized roster.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {activeSubTab === 'overview' && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white">All Residents</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">Click a resident to view their block history</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button 
                  onClick={() => setShowCccModal(true)}
                  className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm shadow-sm"
                  title="Generate customized Clinical Competency Committee (CCC) report or printable dossiers"
                >
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Generate CCC Report
                </button>
                <button 
                  onClick={exportOverviewToCSV}
                  className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs sm:text-sm shadow-sm"
                  title="Download full resident performance table as CSV"
                >
                  <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Export CSV
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
                    
                    const facultyEmails = (adminData?.roster || [])
                      .filter((r: import('@/lib/types').RosterEntry) => {
                        const role = (r.role || '').toLowerCase();
                        const pgy = (r.pgy || '').toLowerCase();
                        const track = (r.track || '').toLowerCase();
                        return role === 'faculty' || pgy === 'faculty' || track === 'faculty';
                      })
                      .map((r: import('@/lib/types').RosterEntry) => r.email)
                      .filter(Boolean);

                    openEmailCompose({
                      bcc: facultyEmails,
                      subject: "FMC Board Review App: Program-Wide Performance Update",
                      body: bodyStr,
                    });
                  }}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Mail className="w-4 h-4" /> Email Advisors
                </button>
              </div>
            </div>

            {/* Overview Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={overviewSearch}
                  onChange={(e) => setOverviewSearch(e.target.value)}
                  placeholder="Search resident or advisor..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(() => {
                  const ay = selectedYear === 0 ? getCurrentAcademicYear() : selectedYear;
                  const buttons: { id: 'ALL' | 'PGY-1' | 'PGY-2' | 'PGY-3' | 'FACULTY'; label: string }[] = [
                    { id: 'ALL', label: `All Residents (${residentStats.length})` },
                    { id: 'PGY-1', label: `PGY-1 (Class of ${ay + 2})` },
                    { id: 'PGY-2', label: `PGY-2 (Class of ${ay + 1})` },
                    { id: 'PGY-3', label: `PGY-3 (Class of ${ay})` },
                    { id: 'FACULTY', label: `Faculty (${facultyStats.length})` },
                  ];
                  return buttons.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOverviewPgyFilter(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        overviewPgyFilter === item.id
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
          <div className="p-4"><ResidentTable residents={overviewFilteredResidents} hidePagination={true} /></div>
        </div>
      )}

      {/* Action Needed Tab */}
      {activeSubTab === 'at_risk' && (
        <div className="space-y-6">
          {redFlagged.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-red-100 dark:border-red-950/50 shadow-sm overflow-hidden transition-colors">
              <div className="p-6 border-b border-red-50 dark:border-red-950/50 bg-red-50/40 dark:bg-red-950/30">
                <h3 className="font-black text-red-700 dark:text-red-400">🔴 At Risk — Avg ≤50%, low on-time, or 2+ blocks overdue</h3>
              </div>
              <div className="p-4"><ResidentTable residents={redFlagged} /></div>
            </div>
          )}
          {yellowFlagged.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-amber-100 dark:border-amber-950/50 shadow-sm overflow-hidden transition-colors">
              <div className="p-6 border-b border-amber-50 dark:border-amber-950/50 bg-amber-50/40 dark:bg-amber-950/30">
                <h3 className="font-black text-amber-700 dark:text-amber-400">🟡 Needs Attention — Avg ≤65%, on-time below 75%, a block overdue, or recent scores sliding</h3>
              </div>
              <div className="p-4"><ResidentTable residents={yellowFlagged} /></div>
            </div>
          )}
          {redFlagged.length === 0 && yellowFlagged.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-emerald-100 dark:border-emerald-950/50 p-16 text-center transition-colors">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="font-black text-emerald-700 dark:text-emerald-400 text-xl">All Residents On Track</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">No residents are currently flagged as at-risk.</p>
            </div>
          )}
        </div>
      )}

      {/* By Block Tab */}
      {activeSubTab === 'by_block' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mt-6 transition-colors">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[10px] font-black text-slate-400 dark:text-slate-500 transition-colors">
                <th className="px-6 py-4">Block Title</th>
                <th className="px-4 py-4 text-center">Assigned</th>
                <th className="px-4 py-4 text-center">Completed</th>
                <th className="px-4 py-4 text-center">Attendance</th>
                <th className="px-4 py-4 text-center">Avg Score</th>
                <th className="px-4 py-4 text-center">On-Time %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
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

                // Filter to resident completions for program stats
                const residentEmails = new Set(scopedResidents.map(r => r.email?.toLowerCase()).filter(Boolean));
                const residentUserIds = new Set(scopedResidents.map(r => emailToUserId.get(r.email?.toLowerCase())).filter(Boolean));
                const isResidentRes = (r: Result & { email?: string | null }) => {
                  const e = (r.email || r.legacy_email || '').toLowerCase();
                  const u = r.user_id;
                  return (e && residentEmails.has(e)) || (u && residentUserIds.has(u));
                };

                const residentBlockResults = blockResults.filter(isResidentRes);
                
                // Keep only the highest academic_points attempt per resident
                const userBestPts = new Map<string, Result & { email?: string | null }>();
                residentBlockResults.forEach(r => {
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
                      setBlockDrilldownCohort('residents');
                      setSelectedQuiz(null);
                    }}
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                    title="Click to view resident completion drilldown"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{block.title}</div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{block.question_count || 40} questions</div>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                      {scopedResidents.length}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                      {completedCount}
                    </td>
                    <td className="px-4 py-4 text-center font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {blockAttendance}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {completedCount > 0 ? (
                        <span className="text-sm font-black text-slate-600 dark:text-slate-300">
                          {avgScore.toFixed(1)}%
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {completedCount > 0 ? (
                        <span className={`text-sm font-bold ${onTimePct > 65 ? 'text-emerald-600 dark:text-emerald-400' : onTimePct > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          {onTimePct.toFixed(0)}%
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>}
                    </td>
                  </tr>
                );
              })}
              {(!blocks || blocks.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 font-bold">
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
              <div key={pgy} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 flex items-center justify-between">
                  <h3 className="font-black text-slate-800 dark:text-white">
                    {residents[0]?.classYear ? `${pgy} (Class of ${residents[0].classYear})` : pgy}
                  </h3>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{groupAvg.toFixed(1)}%</div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Class Avg</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{groupPts}</div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Pts</div>
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
          <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">{formatDisplayName(selectedResident.name)}</h2>
                  <button
                    onClick={() => setDossierResidentEmail(selectedResident.email)}
                    className="self-start sm:self-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Dossier (PDF)
                  </button>
                </div>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-400 mb-6">{selectedResident.label} · Advisor: {selectedResident.advisor || '—'}</p>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.curriculumAttempts > 0 ? `${selectedResident.curriculumAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Curriculum Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.independentAttempts > 0 && selectedResident.independentAvg !== null ? `${selectedResident.independentAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Independent Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.totalAttempts > 0 ? `${selectedResident.overallAvg.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Overall Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.blocksCompleted}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Blocks Done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.blocksCompleted > 0 ? `${selectedResident.onTimePct.toFixed(0)}%` : '—'}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">On-Time Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.totalPoints}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Academic Pts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-slate-800 dark:text-white">{selectedResident.totalAttendance}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Attendance</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-6">
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.academicRisk].badge}`}>
                    Academic: {selectedResident.academicRisk === 'red' ? 'At Risk' : selectedResident.academicRisk === 'yellow' ? 'Attention' : selectedResident.academicRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                  <span className={`text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full ${riskColors[selectedResident.complianceRisk].badge}`}>
                    Participation: {selectedResident.complianceRisk === 'red' ? 'At Risk' : selectedResident.complianceRisk === 'yellow' ? 'Attention' : selectedResident.complianceRisk === 'green' ? 'On Track' : 'Evaluating'}
                  </span>
                  <span className="text-xs font-black px-3 py-1.5 uppercase tracking-widest rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>QOTD: {residentQotdMeta?.streak?.current ?? 0}d streak · {residentQotdMeta?.stats?.accuracy ?? (residentQotdHistory && residentQotdHistory.length > 0 ? Math.round((residentQotdHistory.filter(h => h.isCorrect).length / residentQotdHistory.length) * 100) : '—')}% ({residentQotdHistory?.length ?? 0} answered)</span>
                  </span>
                </div>
                {selectedResident.riskReasons.length > 0 && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-3">⚠ {selectedResident.riskReasons.join(' · ')}</p>
                )}

                {userIsAdmin && (
                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    {!isAdjustingPoints ? (
                      <button
                        onClick={() => setIsAdjustingPoints(true)}
                        className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        + Add Manual Points
                      </button>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-wrap md:flex-nowrap items-center gap-3">
                        <input
                          type="number"
                          value={adjustPointsValue}
                          onChange={(e) => setAdjustPointsValue(Number(e.target.value))}
                          className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white"
                          placeholder="Pts"
                        />
                        <input
                          type="text"
                          value={adjustPointsReason}
                          onChange={(e) => setAdjustPointsReason(e.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400"
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
                          className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedResident(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all ml-4 shrink-0">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedQuiz ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setSelectedQuiz(null)} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back to Performance
                    </button>
                    <span className="text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">{formatTopicDisplay(selectedQuiz.topic)}</span>
                  </div>
                  
                  {loadingReview ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                      <p className="font-bold text-sm tracking-widest uppercase">Loading Responses...</p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
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
                    <div className="flex bg-slate-100/50 dark:bg-slate-800/60 p-1 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setActiveListTab('questions')}
                        className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all ${activeListTab === 'questions' ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        Questions
                      </button>
                      <button 
                        onClick={() => setActiveListTab('attendance')}
                        className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all ${activeListTab === 'attendance' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        Attendance
                      </button>
                      <button 
                        onClick={() => setActiveListTab('qotd')}
                        className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeListTab === 'qotd' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>QOTD ({residentQotdHistory ? residentQotdHistory.length : '—'})</span>
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
                                  <button key={`curr-${i}`} onClick={() => openReview(r)} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-100/50 dark:border-slate-700/50 group">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{formatTopicDisplay(r.topic)}</p>
                                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'} · {timingLabel}
                                        {(!Array.isArray(r.review_data) || r.review_data.length === 0) ? ' · review unavailable' : ''}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : (r.percentage || 0) > 50 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300'}`}>
                                        {(r.percentage || 0).toFixed(1)}%
                                      </span>
                                      {blockAttendance > 0 && (
                                        <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg w-12 text-center">{blockAttendance} Att</span>
                                      )}
                                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">No curriculum recorded for this year.</p>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Independent Study ({customQuizzes.length})</h3>
                          {customQuizzes.length > 0 ? (
                            <div className="space-y-3">
                              {customQuizzes.map((r: Result & { email?: string | null, review_data?: unknown }, i: number) => (
                                <button key={`ind-${i}`} onClick={() => openReview(r)} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all border border-indigo-50/50 dark:border-indigo-900/40 group">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{r.topic}</p>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                                      {(!Array.isArray(r.review_data) || r.review_data.length === 0) ? ' · review unavailable' : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-sm font-black px-3 py-1 rounded-full ${(r.percentage || 0) >= 65 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : (r.percentage || 0) > 50 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300'}`}>
                                      {(r.percentage || 0).toFixed(1)}%
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-indigo-200 dark:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">No independent study recorded.</p>
                          )}
                        </div>
                      </>
                    ) : activeListTab === 'attendance' ? (
                      <div>
                        <h3 className="text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-4">Attendance & Manual Credit ({attendanceRecords.length})</h3>
                        {attendanceRecords.length > 0 ? (
                          <div className="space-y-3">
                            {attendanceRecords.map((r: Result & { email?: string | null, review_data?: unknown }, i: number) => {
                              const pts = r.academic_points || 0;
                              return (
                                <div key={`att-${i}`} className="w-full text-left flex items-center justify-between p-4 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/40">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{formatTopicDisplay(r.topic)}</p>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                      {(() => {
                                        const att = adminData.attendance?.find(a => a.resident_email === selectedResident.email && a.topic && r.topic?.includes(a.topic));
                                        return att?.date ? new Date(att.date + 'T12:00:00').toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—');
                                      })()} · {r.topic?.includes('[Manual]') ? '✨ Manual Credit' : r.topic?.toLowerCase().includes('advisor meeting') ? '🗣️ Advisor Meeting' : 'Noon Conference Attendance'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm font-black px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center" title="Attendance/Manual Credit">
                                      <Check className="w-4 h-4 mr-1" /> {pts} pt{pts !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">No attendance recorded.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Scope Isolation Disclaimer */}
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-bold text-amber-900 dark:text-amber-200">
                              Formative Practice Only · Independent of Academic Standing
                            </p>
                            <p className="text-amber-700 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                              Question of the Day attempts and streaks are tracked purely for engagement and formative self-assessment. They do <strong>not</strong> affect academic block scores, on-time completion rates, CCC evaluations, or formal board preparation grading.
                            </p>
                          </div>
                        </div>

                        {/* Resident QOTD KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-2xl font-black text-slate-800 dark:text-white">
                              {residentQotdMeta?.stats?.totalAnswered ?? (residentQotdHistory ? residentQotdHistory.length : 0)}
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Questions Answered</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                              {residentQotdMeta?.stats?.accuracy ?? (residentQotdHistory && residentQotdHistory.length > 0 ? Math.round((residentQotdHistory.filter(h => h.isCorrect).length / residentQotdHistory.length) * 100) : 0)}%
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Accuracy Rate</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                              {residentQotdMeta?.streak?.current ?? 0}d
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Current Streak</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                              {residentQotdMeta?.streak?.max ?? 0}d
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Best Streak</div>
                          </div>
                        </div>

                        {/* Chronological Question Log */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Attempt History ({residentQotdHistory?.length ?? 0})
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                              Includes Peer Breakdown (n)
                            </span>
                          </div>

                          {loadingResidentQotd ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                              <p className="text-xs font-bold uppercase tracking-widest">Loading QOTD History...</p>
                            </div>
                          ) : !residentQotdHistory || residentQotdHistory.length === 0 ? (
                            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-center">
                              No Question of the Day attempts recorded for this resident.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {residentQotdHistory.map((h, i) => {
                                const selectedOptionText = h.selectedIndex != null && h.options[h.selectedIndex]
                                  ? h.options[h.selectedIndex]
                                  : 'No option selected';

                                return (
                                  <div
                                    key={h.id || `qotd-${i}`}
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900/50 transition-all space-y-3"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-md">
                                          📅 {h.date}
                                        </span>
                                        <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                          {h.category} {h.year ? `· ${h.year}` : ''}
                                        </span>
                                        <span
                                          className={`text-xs font-black px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                                            h.isCorrect
                                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                              : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                          }`}
                                        >
                                          {h.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                                        </span>
                                      </div>

                                      <button
                                        onClick={() => openQotdReview(h)}
                                        className="self-start sm:self-auto text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100 transition-colors flex items-center gap-1"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> Review Question
                                      </button>
                                    </div>

                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                                      {h.questionText}
                                    </p>

                                    {/* Peer stats & selected answer */}
                                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                                      <div className="text-slate-600 dark:text-slate-400">
                                        <span className="font-semibold text-slate-400 dark:text-slate-500">Selected Answer: </span>
                                        <span className={`font-bold ${h.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {selectedOptionText}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                        <span title="Peers choosing this option">
                                          👥 Pick Agreement: <strong className="text-slate-700 dark:text-slate-200">{h.peerOptionAgreementPct}%</strong> (n = {h.peerOptionAgreementCount} of {h.peerTotalCount})
                                        </span>
                                        <span>·</span>
                                        <span title="Overall peer correctness">
                                          🎯 Peer Accuracy: <strong className="text-slate-700 dark:text-slate-200">{h.peerAccuracyPct}%</strong> (n = {h.peerTotalCount} peers)
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
        
        // Filter to resident completions for program stats
        const residentEmails = new Set(scopedResidents.map(r => r.email?.toLowerCase()).filter(Boolean));
        const residentUserIds = new Set(scopedResidents.map(r => emailToUserId.get(r.email?.toLowerCase())).filter(Boolean));
        const isResidentRes = (r: Result & { email?: string | null }) => {
          const e = (r.email || r.legacy_email || '').toLowerCase();
          const u = r.user_id;
          return (e && residentEmails.has(e)) || (u && residentUserIds.has(u));
        };

        const residentBlockResults = blockResults.filter(isResidentRes);
        const facultyBlockResults = blockResults.filter(r => !isResidentRes(r));

        // Find highest academic points / best completion attempt per resident (Program Stats)
        const userBestPts = new Map<string, Result & { email?: string | null }>();
        residentBlockResults.forEach(r => {
          const uid = (r.user_id || r.legacy_email || r.email || '').toLowerCase();
          if (!uid) return;
          const cur = userBestPts.get(uid);
          if (!cur || (r.academic_points || 0) > (cur.academic_points || 0) || (r.percentage || 0) > (cur.percentage || 0)) {
            userBestPts.set(uid, r);
          }
        });

        // Faculty completions tracked separately
        const facultyBestPts = new Map<string, Result & { email?: string | null }>();
        facultyBlockResults.forEach(r => {
          const uid = (r.user_id || r.legacy_email || r.email || '').toLowerCase();
          if (!uid) return;
          const cur = facultyBestPts.get(uid);
          if (!cur || (r.academic_points || 0) > (cur.academic_points || 0) || (r.percentage || 0) > (cur.percentage || 0)) {
            facultyBestPts.set(uid, r);
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

        const isViewingFaculty = blockDrilldownCohort === 'faculty';
        const currentCohortList = isViewingFaculty ? facultyStats : residentStats;
        const currentBestPts = isViewingFaculty ? facultyBestPts : userBestPts;
        const currentBlockResults = isViewingFaculty ? facultyBlockResults : residentBlockResults;

        const filteredCohort = currentCohortList.filter(r => {
          if (!blockDrilldownSearch) return true;
          const q = blockDrilldownSearch.toLowerCase();
          return r.name.toLowerCase().includes(q) || (r.last_name && r.last_name.toLowerCase().includes(q)) || r.email.toLowerCase().includes(q);
        });

        const allIncompleteResidents = residentStats.filter(resident => {
          const result = (resident.userId ? userBestPts.get(resident.userId.toLowerCase()) : null) || 
                         userBestPts.get(resident.email.toLowerCase()) ||
                         residentBlockResults.find(br => (br.user_id && resident.userId && br.user_id === resident.userId) || (br.email && br.email.toLowerCase() === resident.email.toLowerCase()) || (br.legacy_email && br.legacy_email.toLowerCase() === resident.email.toLowerCase()));
          return !result;
        });

        return (
          <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black rounded-full uppercase tracking-wider">
                      {selectedYear === 0 ? 'All Years' : `AY ${selectedYear}`}
                    </span>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white">{block.title}</h2>
                  </div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-400 mb-6">
                    {block.question_count || 40} Questions {sched?.start_date && sched?.end_date ? `· ${sched.start_date} to ${sched.end_date}` : ''}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <div className="text-xl font-black text-slate-800 dark:text-white">{residentStats.length}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Assigned</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <div className="text-xl font-black text-slate-800 dark:text-white">{completedCount} <span className="text-xs text-slate-400 font-bold">/ {residentStats.length}</span></div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Completed</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <div className={`text-xl font-black ${onTimePct > 65 ? 'text-emerald-600 dark:text-emerald-400' : onTimePct > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {completedCount > 0 ? `${onTimePct.toFixed(0)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">On-Time %</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <div className="text-xl font-black text-slate-800 dark:text-white">
                        {completedCount > 0 ? `${avgScore.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Cohort Avg</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{blockAttendance}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Attendance</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedBlockDrilldown(null); setSelectedQuiz(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all ml-4 shrink-0">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Search bar, Cohort Switcher & CSV Export */}
              <div className="p-4 md:px-8 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[200px]">
                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={blockDrilldownSearch}
                      onChange={(e) => setBlockDrilldownSearch(e.target.value)}
                      placeholder={isViewingFaculty ? "Search faculty by name..." : "Search resident by name..."}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setBlockDrilldownCohort('residents')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        !isViewingFaculty
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Residents ({residentStats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockDrilldownCohort('faculty')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isViewingFaculty
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Faculty ({facultyStats.length})
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                    Showing {filteredCohort.length} of {currentCohortList.length} {isViewingFaculty ? 'faculty' : 'residents'}
                  </span>
                  {!isViewingFaculty && allIncompleteResidents.length > 0 && (
                    <button
                      onClick={() => {
                        const emailData = generateBlockReminderEmail({
                          blockTitle: block.title,
                          dueDateStr: sched?.end_date ? `${sched.end_date}` : 'this Sunday',
                          emails: allIncompleteResidents.map(r => r.email).filter(Boolean),
                          senderName: 'FMC Program Leadership',
                        });
                        openEmailCompose(emailData);
                      }}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-sm active:scale-95"
                      title={`Send 1-click reminder to ${allIncompleteResidents.length} incomplete residents via Gmail`}
                    >
                      <Mail className="w-3.5 h-3.5" /> Remind Incomplete ({allIncompleteResidents.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const yearLabel = selectedYear === 0 ? 'All_Years' : `AY_${selectedYear}`;
                      const cohortLabel = isViewingFaculty ? 'Faculty' : 'Residents';
                      const headers = [
                        isViewingFaculty ? 'Faculty Name' : 'Resident Name',
                        'Email',
                        'Role',
                        'Advisor',
                        'Status',
                        'Completion Date',
                        'Score %',
                        'Score Raw',
                        'Total Questions',
                        'Academic Points'
                      ];
                      const rows = filteredCohort.map(resident => {
                        const result = (resident.userId ? currentBestPts.get(resident.userId.toLowerCase()) : null) || 
                                       currentBestPts.get(resident.email.toLowerCase()) ||
                                       currentBlockResults.find(br => (br.user_id && resident.userId && br.user_id === resident.userId) || (br.email && br.email.toLowerCase() === resident.email.toLowerCase()) || (br.legacy_email && br.legacy_email.toLowerCase() === resident.email.toLowerCase()));
                        
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
                      link.setAttribute('download', `FMC_Block_${cleanTitle}_${cohortLabel}_${yearLabel}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-sm"
                    title={`Export ${isViewingFaculty ? 'faculty' : 'resident'} block completions to CSV`}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Resident / Faculty List Table or Quiz Review */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {selectedQuiz ? (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setSelectedQuiz(null)} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Back to {isViewingFaculty ? 'Faculty List' : 'Resident List'}
                      </button>
                      <span className="text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">{formatTopicDisplay(selectedQuiz.topic)}</span>
                    </div>
                    
                    {loadingReview ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                        <p className="font-bold text-sm tracking-widest uppercase">Loading Responses...</p>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <QuizReview items={reviewItems || []} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[10px] font-black text-slate-400">
                          <th className="px-4 py-3">{isViewingFaculty ? 'Faculty Member' : 'Resident'}</th>
                          <th className="px-3 py-3 text-center">Role</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-center">Date</th>
                          <th className="px-3 py-3 text-center">Score</th>
                          <th className="px-3 py-3 text-center">Points</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        {filteredCohort.map(resident => {
                          const result = (resident.userId ? currentBestPts.get(resident.userId.toLowerCase()) : null) || 
                                         currentBestPts.get(resident.email.toLowerCase()) ||
                                         currentBlockResults.find(br => (br.user_id && resident.userId && br.user_id === resident.userId) || (br.email && br.email.toLowerCase() === resident.email.toLowerCase()) || (br.legacy_email && br.legacy_email.toLowerCase() === resident.email.toLowerCase()));
                          
                          const isCompleted = !!result;
                          const pts = result?.academic_points || 0;
                          const isOnTime = result?.timing_status === 'Early' || result?.timing_status === 'On Time' || (pts >= 2 && !result?.topic?.toLowerCase().includes('bonus'));
                          const isLate = result?.timing_status === 'Late' || pts === 1;

                          return (
                            <tr key={resident.email || resident.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                                {formatLastNameFirst(resident.name, resident.last_name)}
                              </td>
                              <td className="px-3 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                {resident.label}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {isCompleted ? (
                                  isOnTime ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-black rounded-md">
                                      🚀 On-Time
                                    </span>
                                  ) : isLate ? (
                                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-black rounded-md">
                                      ⏰ Late
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black rounded-md">
                                      Completed
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold rounded-md">
                                    Not Completed
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {result?.created_at ? new Date(result.created_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {isCompleted ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-md font-black ${(result.percentage || 0) >= 65 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : (result.percentage || 0) > 50 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300'}`}>
                                    {(result.percentage || 0).toFixed(0)}% <span className="font-normal text-[11px] opacity-75">({result.score || 0}/{result.total || block.question_count || 40})</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-300 text-xs">
                                {isCompleted ? `${pts} pt${pts !== 1 ? 's' : ''}` : '0 pts'}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isCompleted && result ? (
                                  <button
                                    onClick={() => openReview(result)}
                                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Review
                                  </button>
                                ) : !isViewingFaculty ? (
                                  <button
                                    onClick={() => {
                                      const emailData = generateBlockReminderEmail({
                                        blockTitle: block.title,
                                        dueDateStr: sched?.end_date ? `${sched.end_date}` : 'this Sunday',
                                        emails: [resident.email],
                                        senderName: 'FMC Program Leadership',
                                      });
                                      openEmailCompose(emailData);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors inline-flex items-center gap-1"
                                    title={`Send reminder to ${resident.name}`}
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCohort.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm">
                              No {isViewingFaculty ? 'faculty' : 'residents'} match your search.
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

      {/* Dossier Modal from Admin Performance */}
      {(dossierResidentEmail || showCccModal) && (
        <AdviseeDossierModal
          facultyName={facultyName || 'FMC Clinical Competency Committee'}
          selectedYear={selectedYear === 0 ? getCurrentAcademicYear() : selectedYear}
          advisees={roster.filter(isActiveResident).map(r => ({
            resident: r,
            name: r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email || '',
            pgy: deriveLabel(r, selectedYear === 0 ? getCurrentAcademicYear() : selectedYear),
            overallAvg: 0,
            curriculumAvg: 0,
            totalAttempts: 0,
            curriculumAttempts: 0,
            blocksCompleted: 0,
            totalPoints: 0,
            onTimePct: 100,
            overdueCount: 0,
            isAtRisk: false,
            isAttention: false,
            riskReasons: [],
            weakCategories: [],
            blockHistory: [],
            meetingHistory: [],
          }))}
          adminData={adminData}
          initialSelectedEmail={dossierResidentEmail || undefined}
          onClose={() => {
            setDossierResidentEmail(null);
            setShowCccModal(false);
          }}
        />
      )}
    </div>
  );
}
