'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AdminData,
  User,
  Profile,
  QotdAnalyticsResponse,
  QotdDailyStatItem,
  QotdResidentStatItem,
  QotdOptionDistribution,
} from '@/lib/types';
import {
  Flame,
  Sparkles,
  TrendingUp,
  Users,
  Calendar,
  Search,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import QuizReview from './QuizReview';

interface QotdAnalyticsProps {
  adminData?: AdminData;
  user?: User | null;
  profile?: Profile | null;
}

type AnalyticsSubTab = 'cohorts' | 'timeline' | 'roster';

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function QotdAnalytics({ adminData, user, profile }: QotdAnalyticsProps) {
  const [data, setData] = useState<QotdAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tab and filter states
  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>('cohorts');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineCategory, setTimelineCategory] = useState('ALL');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPgyFilter, setRosterPgyFilter] = useState<'ALL' | 'PGY-1' | 'PGY-2' | 'PGY-3'>('ALL');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'responders' | 'pending'>('responders');

  // Modal review state
  const [reviewQuestionItem, setReviewQuestionItem] = useState<{
    question: any;
    selected: number | null;
    date: string;
    category: string;
  } | null>(null);

  const fetchAnalytics = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch('/api/admin/qotd-analytics', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json: QotdAnalyticsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching QOTD analytics:', err);
      setError(err.message || 'Failed to load Question of the Day analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filtered timeline questions
  const filteredTimeline = useMemo(() => {
    if (!data?.dailySchedule) return [];
    return data.dailySchedule.filter((item) => {
      const matchesSearch =
        timelineSearch === '' ||
        item.questionText.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        item.date.includes(timelineSearch);
      const matchesCategory =
        timelineCategory === 'ALL' || item.category.toLowerCase() === timelineCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [data?.dailySchedule, timelineSearch, timelineCategory]);

  // Unique categories for timeline filter
  const availableCategories = useMemo(() => {
    if (!data?.dailySchedule) return [];
    const cats = new Set<string>();
    data.dailySchedule.forEach((q) => {
      if (q.category) cats.add(q.category);
    });
    return Array.from(cats).sort();
  }, [data?.dailySchedule]);

  // Filtered resident roster
  const filteredRoster = useMemo(() => {
    if (!data?.residentStats) return [];
    return data.residentStats.filter((r) => {
      const matchesSearch =
        rosterSearch === '' ||
        r.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        r.email.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        (r.advisor && r.advisor.toLowerCase().includes(rosterSearch.toLowerCase()));
      const matchesPgy =
        rosterPgyFilter === 'ALL' || r.pgy.toUpperCase().includes(rosterPgyFilter.toUpperCase());
      return matchesSearch && matchesPgy;
    });
  }, [data?.residentStats, rosterSearch, rosterPgyFilter]);

  // CSV Export: Summary & Cohorts
  const handleExportSummaryCsv = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value', 'Sample Size (n)'],
      ['Total Questions Served', String(data.kpis.totalQuestionsServed), '—'],
      ['Total Attempts Recorded', String(data.kpis.totalAttempts), `${data.kpis.totalAttempts} attempts`],
      ['Program Overall Accuracy', `${data.kpis.overallAccuracy}%`, `${data.kpis.totalAttempts} attempts across ${data.kpis.distinctParticipants} participants`],
      ['Daily Avg Participation Rate', `${data.kpis.averageDailyParticipationRate}%`, `of ${data.kpis.activeResidentCount} active residents`],
      ['30-Day Reach', `${data.kpis.activeMonthReachPct}%`, `${data.kpis.activeMonthReachCount} residents`],
      [],
      ['PGY Cohort', 'Resident Count (n)', 'Total Attempts', 'Avg Attempts/Resident', 'Accuracy %', 'Participation %'],
      ...data.pgyCohorts.map((c) => [
        c.pgy,
        String(c.totalResidents),
        String(c.totalAttempts),
        String(c.averageAttemptsPerResident),
        `${c.accuracyRate}%`,
        `${c.participationRate}%`,
      ]),
      [],
      ['Category', 'Total Questions', 'Attempts (n)', 'Correct Count', 'Accuracy %'],
      ...data.categories.map((cat) => [
        cat.category,
        String(cat.totalQuestions),
        String(cat.totalAttempts),
        String(cat.correctCount),
        `${cat.accuracy}%`,
      ]),
    ];

    const csvString = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerCsvDownload(`fmc_qotd_analytics_summary_${new Date().toISOString().split('T')[0]}.csv`, csvString);
  };

  // CSV Export: Daily Timeline
  const handleExportDailyCsv = () => {
    if (!data) return;
    const rows = [
      ['Date', 'Category', 'Year', 'Question Text', 'Responders (n)', 'Correct Count', 'Accuracy %'],
      ...data.dailySchedule.map((d) => [
        d.date,
        d.category,
        d.year || '—',
        d.questionText.replace(/\n/g, ' '),
        String(d.attemptsCount),
        String(d.correctCount),
        `${d.accuracy}%`,
      ]),
    ];

    const csvString = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerCsvDownload(`fmc_qotd_daily_log_${new Date().toISOString().split('T')[0]}.csv`, csvString);
  };

  // CSV Export: Resident Roster
  const handleExportRosterCsv = () => {
    if (!data) return;
    const rows = [
      ['Name', 'Email', 'PGY', 'Advisor', 'Answered (n)', 'Participation %', 'Accuracy %', 'Current Streak', 'Best Streak'],
      ...data.residentStats.map((r) => [
        r.name,
        r.email,
        r.pgy,
        r.advisor || 'Unassigned',
        String(r.attemptsCount),
        `${r.participationRate}%`,
        `${r.accuracy}%`,
        `${r.currentStreak}d`,
        `${r.maxStreak}d`,
      ]),
    ];

    const csvString = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerCsvDownload(`fmc_qotd_resident_roster_${new Date().toISOString().split('T')[0]}.csv`, csvString);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Loading QOTD Analytics Hub...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 dark:bg-red-950/30 rounded-3xl border border-red-100 dark:border-red-900/40 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-1">Failed to Load QOTD Analytics</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error || 'Unknown error occurred.'}</p>
        <button
          onClick={() => fetchAnalytics()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Flame className="w-6 h-6 fill-amber-500" />
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Question of the Day Analytics
              </h1>
            </div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Formative engagement tracking, peer benchmarking, distractor analytics, and longitudinal cohort trends.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Refresh QOTD data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <div className="relative group">
              <button className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition-all">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-1.5 hidden group-hover:block z-30 animate-fade-in">
                <button
                  onClick={handleExportSummaryCsv}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  📊 Cohort &amp; KPI Summary
                </button>
                <button
                  onClick={handleExportDailyCsv}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  📅 Daily Question History
                </button>
                <button
                  onClick={handleExportRosterCsv}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 rounded-xl transition-colors"
                >
                  👥 Resident Participation Roster
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Isolation Scope Alert */}
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Strict Academic Isolation Active
            </p>
            <p className="text-amber-700 dark:text-amber-300/90 mt-0.5 leading-relaxed">
              QOTD attempts and streaks are isolated from official academic block grading, on-time completion percentages, and CCC portfolios. This dataset provides faculty and leadership with unfiltered engagement intelligence without penalizing resident standing.
            </p>
          </div>
        </div>

        {/* Top-Level KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
          {/* Total Questions */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Questions Served
              </span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {data.kpis.totalQuestionsServed}
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Scheduled Daily Qs
            </p>
          </div>

          {/* Total Attempts */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Total Attempts
              </span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {data.kpis.totalAttempts}
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Across {data.kpis.distinctParticipants} participants
            </p>
          </div>

          {/* Overall Accuracy */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Program Accuracy
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {data.kpis.overallAccuracy}%
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              (n = {data.kpis.totalAttempts} total attempts)
            </p>
          </div>

          {/* Daily Participation Rate */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Daily Participation
              </span>
              <Award className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {data.kpis.averageDailyParticipationRate}%
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              of {data.kpis.activeResidentCount} active residents
            </p>
          </div>

          {/* 30-Day Reach */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                30-Day Reach
              </span>
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data.kpis.activeMonthReachPct}%
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              (n = {data.kpis.activeMonthReachCount} residents)
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('cohorts')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cohorts'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Cohort &amp; Category Benchmarks</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'timeline'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Questions &amp; Distractor Deep-Dive ({data.dailySchedule.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'roster'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Resident Participation Roster ({data.residentStats.length})</span>
        </button>
      </div>

      {/* TAB 1: COHORT & CATEGORY BENCHMARKS */}
      {activeTab === 'cohorts' && (
        <div className="space-y-6">
          {/* PGY Cohort Matrix */}
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
              PGY Cohort Comparison (Explicit n Sample Sizes)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.pgyCohorts.map((cohort) => (
                <div
                  key={cohort.pgy}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {cohort.pgy}
                    </span>
                    <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                      n = {cohort.totalResidents} residents
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Accuracy
                      </span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {cohort.accuracyRate}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Participation
                      </span>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                        {cohort.participationRate}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Attempts (n)
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {cohort.totalAttempts} total
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Avg Per Resident
                      </span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate block">
                        ~{cohort.averageAttemptsPerResident} Qs
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Specialty Category Breakdown & Trappiest Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Specialty Category Breakdown
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Accuracy rates and total sample sizes (n) per clinical topic
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {data.categories.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                        {cat.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">(n = {cat.totalAttempts})</span>
                        <span
                          className={`font-black ${
                            cat.accuracy >= 70
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : cat.accuracy >= 55
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {cat.accuracy}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          cat.accuracy >= 70
                            ? 'bg-emerald-500'
                            : cat.accuracy >= 55
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, cat.accuracy))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trappiest Missed Questions */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🎯</span> High-Yield &ldquo;Trap&rdquo; Questions
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Questions with lowest program-wide accuracy (&lt; 50%) or prominent distractor misdirection
                </p>
              </div>

              {(() => {
                const toughQuestions = [...data.dailySchedule]
                  .filter((q) => q.attemptsCount >= 3)
                  .sort((a, b) => a.accuracy - b.accuracy)
                  .slice(0, 5);

                if (toughQuestions.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">
                      No questions with sufficient sample size (&ge;3 attempts) yet.
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {toughQuestions.map((q) => {
                      // Find most common incorrect distractor
                      let highestIncorrectOpt: { index: number; pct: number; count: number } | null = null;
                      Object.entries(q.optionCounts).forEach(([idxStr, dist]) => {
                        const idx = Number(idxStr);
                        const distTyped = dist as QotdOptionDistribution;
                        if (idx !== q.correctIndex && (!highestIncorrectOpt || distTyped.count > highestIncorrectOpt.count)) {
                          highestIncorrectOpt = { index: idx, pct: distTyped.pct, count: distTyped.count };
                        }
                      });

                      const highestTrap = highestIncorrectOpt as { index: number; pct: number; count: number } | null;

                      return (
                        <div
                          key={q.questionId}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-amber-300 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-700 dark:text-amber-400">
                                📅 {q.date}
                              </span>
                              <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {q.category}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md font-black bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                              {q.accuracy}% correct (n = {q.attemptsCount})
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                            {q.questionText}
                          </p>

                          {highestTrap && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                              ⚠️ Top Trap Option: &ldquo;{q.options[highestTrap.index]}&rdquo; fooled{' '}
                              <strong>{highestTrap.pct}%</strong> (n = {highestTrap.count} residents)
                            </p>
                          )}

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() =>
                                setReviewQuestionItem({
                                  question: {
                                    id: q.questionId,
                                    question_text: q.questionText,
                                    category: q.category,
                                    year: q.year,
                                    options: q.options,
                                    correct_index: q.correctIndex,
                                    explanation: q.explanation,
                                  },
                                  selected: highestTrap?.index ?? null,
                                  date: q.date,
                                  category: q.category,
                                })
                              }
                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Full Question Review
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY QUESTION TIMELINE & DISTRACTORS */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by question text, date, or category..."
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={timelineCategory}
              onChange={(e) => setTimelineCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline Cards */}
          <div className="space-y-4">
            {filteredTimeline.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-400">
                No scheduled questions match your search filters.
              </div>
            ) : (
              filteredTimeline.map((q) => {
                const isExpanded = expandedQuestionId === q.questionId;

                return (
                  <div
                    key={q.questionId}
                    className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-xl">
                          📅 {q.date}
                        </span>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl">
                          {q.category} {q.year ? `· ${q.year}` : ''}
                        </span>
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-xl ${
                            q.accuracy >= 70
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : q.accuracy >= 50
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {q.accuracy}% Correct (n = {q.attemptsCount} responders)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setReviewQuestionItem({
                              question: {
                                id: q.questionId,
                                question_text: q.questionText,
                                category: q.category,
                                year: q.year,
                                options: q.options,
                                correct_index: q.correctIndex,
                                explanation: q.explanation,
                              },
                              selected: null,
                              date: q.date,
                              category: q.category,
                            })
                          }
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </div>
                    </div>

                    {/* Question Text */}
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                      {q.questionText}
                    </p>

                    {/* Option Distractor Breakdown */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Distractor Distribution (n = {q.attemptsCount} total picks)
                      </div>
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = optIdx === q.correctIndex;
                        const dist = (q.optionCounts[optIdx] || { count: 0, pct: 0 }) as QotdOptionDistribution;

                        return (
                          <div key={optIdx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span
                                className={`font-semibold truncate max-w-[80%] ${
                                  isCorrect
                                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {isCorrect ? '✅ ' : '⚪ '} {opt}
                              </span>
                              <span
                                className={`text-xs font-black ${
                                  isCorrect
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {dist.pct}% (n = {dist.count})
                              </span>
                            </div>

                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  isCorrect ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                                }`}
                                style={{ width: `${dist.pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expandable Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (isExpanded && expandedSection === 'responders') {
                              setExpandedQuestionId(null);
                            } else {
                              setExpandedQuestionId(q.questionId);
                              setExpandedSection('responders');
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                            isExpanded && expandedSection === 'responders'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>View Responders ({q.respondents.length})</span>
                          {isExpanded && expandedSection === 'responders' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (isExpanded && expandedSection === 'pending') {
                              setExpandedQuestionId(null);
                            } else {
                              setExpandedQuestionId(q.questionId);
                              setExpandedSection('pending');
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                            isExpanded && expandedSection === 'pending'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending ({q.pendingResidents.length})</span>
                          {isExpanded && expandedSection === 'pending' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Reactions count */}
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        {Object.entries(q.reactions).map(([reaction, count]) => (
                          <span
                            key={reaction}
                            className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-bold text-[11px]"
                          >
                            {reaction} {String(count)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Slide-Down Details Drawer */}
                    {isExpanded && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                        {expandedSection === 'responders' ? (
                          <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                              Resident Responses (n = {q.respondents.length})
                            </h4>
                            {q.respondents.length === 0 ? (
                              <p className="text-xs text-slate-400 py-4">No residents have answered this question yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {q.respondents.map((resp, rIdx) => {
                                  const selectedText =
                                    resp.selectedIndex != null && q.options[resp.selectedIndex]
                                      ? q.options[resp.selectedIndex]
                                      : 'No option';

                                  return (
                                    <div
                                      key={rIdx}
                                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1"
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-900 dark:text-white truncate">
                                          {resp.name}
                                        </span>
                                        <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                          {resp.pgy}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px]">
                                        <span
                                          className={`font-black flex items-center gap-1 ${
                                            resp.isCorrect
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : 'text-red-600 dark:text-red-400'
                                          }`}
                                        >
                                          {resp.isCorrect ? (
                                            <>
                                              <CheckCircle className="w-3 h-3" /> Correct
                                            </>
                                          ) : (
                                            <>
                                              <XCircle className="w-3 h-3" /> Incorrect
                                            </>
                                          )}
                                        </span>
                                        <span className="text-slate-400 text-[10px]">
                                          {resp.answeredAt ? new Date(resp.answeredAt).toLocaleDateString() : ''}
                                        </span>
                                      </div>

                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        Choice: {selectedText}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                              Pending Residents (n = {q.pendingResidents.length})
                            </h4>
                            {q.pendingResidents.length === 0 ? (
                              <p className="text-xs text-emerald-600 font-bold py-2">
                                🎉 100% participation! All active residents completed this question.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {q.pendingResidents.map((p, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5"
                                  >
                                    <span>{p.name}</span>
                                    <span className="text-[10px] font-bold text-slate-400">({p.pgy})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RESIDENT PARTICIPATION ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search residents by name, email, or advisor..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={rosterPgyFilter}
              onChange={(e) => setRosterPgyFilter(e.target.value as any)}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Cohorts</option>
              <option value="PGY-1">PGY-1</option>
              <option value="PGY-2">PGY-2</option>
              <option value="PGY-3">PGY-3</option>
            </select>
          </div>

          {/* Roster Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-4">Faculty Advisor</th>
                    <th className="py-3 px-4 text-center">Answered (n)</th>
                    <th className="py-3 px-4 text-center">Participation %</th>
                    <th className="py-3 px-4 text-center">Accuracy %</th>
                    <th className="py-3 px-4 text-center">Active Streak</th>
                    <th className="py-3 px-4 text-center">Best Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No residents match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((r) => (
                      <tr
                        key={r.email}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                          <div className="text-[11px] text-slate-400">{r.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {r.pgy}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                          {r.advisor || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {r.attemptsCount}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-black ${
                              r.participationRate >= 70
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : r.participationRate >= 40
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {r.participationRate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-black ${
                              r.accuracy >= 70
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : r.accuracy >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {r.attemptsCount > 0 ? `${r.accuracy}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-amber-600 dark:text-amber-400">
                          {r.currentStreak > 0 ? `🔥 ${r.currentStreak}d` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                          {r.maxStreak > 0 ? `${r.maxStreak}d` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION FULL REVIEW MODAL */}
      {reviewQuestionItem && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[36px] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full">
                  Question of the Day · {reviewQuestionItem.date}
                </span>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Category: {reviewQuestionItem.category}
                </p>
              </div>

              <button
                onClick={() => setReviewQuestionItem(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <QuizReview
                items={[
                  {
                    question: reviewQuestionItem.question,
                    selected: reviewQuestionItem.selected,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
