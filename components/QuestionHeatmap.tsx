'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdminData } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Loader2,
  AlertCircle,
  TrendingDown,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Sparkles,
} from './AppIcons';

interface QuestionHeatmapProps {
  adminData?: AdminData;
}

interface QuestionItem {
  id: string;
  text: string;
  category: string;
  total: number;
  wrong: number;
  wrongPct: number;
  options: string[];
  correct_index: number;
  optionCounts: Record<number, number>;
  explanation?: string;
  resource_link?: string;
}

interface QuestionAnalyticsResponse {
  questions: QuestionItem[];
  categories: Array<{
    name: string;
    wrongPct: number;
    total: number;
  }>;
  availableCategories: string[];
  summary: {
    totalAttempts: number;
    totalQuestionsAttempted: number;
    qualifiedQuestionsCount: number;
    activeResidentCount: number;
    minQuestionAttemptsRequired: number;
  };
}

export default function QuestionHeatmap({ adminData }: QuestionHeatmapProps) {
  // Query Filters
  const [filterType, setFilterType] = useState<'all' | 'blocks' | 'qotd'>('all');
  const [pgyFilter, setPgyFilter] = useState<'all' | '1' | '2' | '3'>('all');

  // Client-side Display Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

  // Fetch analytics through privileged server route to bypass RLS safely
  const {
    data: analytics,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<QuestionAnalyticsResponse>({
    queryKey: ['admin', 'question_analytics', filterType, pgyFilter],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/question-analytics?type=${filterType}&pgy=${pgyFilter}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter questions by Category and Keyword
  const filteredQuestions = useMemo(() => {
    if (!analytics?.questions) return [];
    return analytics.questions.filter((q) => {
      const matchesCategory = selectedCategory === 'all' || q.category === selectedCategory;
      const qLower = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !qLower ||
        q.text.toLowerCase().includes(qLower) ||
        q.category.toLowerCase().includes(qLower) ||
        (q.options || []).some((opt) => opt.toLowerCase().includes(qLower)) ||
        (q.explanation || '').toLowerCase().includes(qLower);

      return matchesCategory && matchesSearch;
    });
  }, [analytics?.questions, selectedCategory, searchQuery]);

  // Export filtered questions to CSV for didactics/faculty meetings
  const handleExportCsv = () => {
    if (!filteredQuestions || filteredQuestions.length === 0) return;

    const headers = [
      'Category',
      'Failure Rate (%)',
      'Incorrect Attempts',
      'Total Attempts',
      'Question Stem',
      'Correct Answer',
      'Top Trap Distractor',
      'Educational Explanation',
      'Resource Link',
    ];

    const rows = filteredQuestions.map((q) => {
      const correctOpt = q.options[q.correct_index] || '';

      // Determine the most common incorrect distractor
      let topTrap = 'None';
      let maxTrapCount = 0;
      Object.entries(q.optionCounts || {}).forEach(([idxStr, count]) => {
        const idx = parseInt(idxStr, 10);
        if (idx !== q.correct_index && count > maxTrapCount) {
          maxTrapCount = count;
          const letter = String.fromCharCode(65 + idx);
          const trapPct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
          topTrap = `${letter}: ${q.options[idx] || ''} (${trapPct}%)`;
        }
      });

      return [
        `"${(q.category || '').replace(/"/g, '""')}"`,
        `"${q.wrongPct.toFixed(1)}%"`,
        q.wrong,
        q.total,
        `"${(q.text || '').replace(/"/g, '""')}"`,
        `"${correctOpt.replace(/"/g, '""')}"`,
        `"${topTrap.replace(/"/g, '""')}"`,
        `"${(q.explanation || '').replace(/"/g, '""')}"`,
        `"${(q.resource_link || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort_missed_questions_pgy${pgyFilter}_${filterType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
        <p className="font-bold text-sm">Crunching cohort trend analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-2xl flex items-center justify-between gap-3 text-red-600 dark:text-red-400">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-bold text-sm">Failed to load analytics: {(error as Error).message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 rounded-lg text-xs font-bold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasQuestions = analytics && analytics.questions.length > 0;
  const totalAttempts = analytics?.summary?.totalAttempts ?? 0;
  const totalAttemptedQuestions = analytics?.summary?.totalQuestionsAttempted ?? 0;
  const categoriesList = analytics?.availableCategories || [];

  return (
    <div className="space-y-8">
      {/* Top Filter Controls Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Trend Analysis Heatmap</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">
                Faculty Intelligence
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              Identify curriculum weaknesses, high-failure board topics, and distractor traps across active residents.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={handleExportCsv}
              disabled={filteredQuestions.length === 0}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Download CSV for noon conferences and didactics"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh Analytics"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* PGY Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Cohort:
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'all', label: 'All PGYs' },
                { id: '1', label: 'PGY-1' },
                { id: '2', label: 'PGY-2' },
                { id: '3', label: 'PGY-3' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPgyFilter(c.id as any)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    pgyFilter === c.id
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quiz Source Filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Source:
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'all', label: 'All Quizzes' },
                { id: 'blocks', label: 'Curriculum Blocks' },
                { id: 'qotd', label: 'QOTD' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setFilterType(s.id as any)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterType === s.id
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Total Attempts Analyzed
            </span>
            <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              {analytics.summary.totalAttempts}
            </div>
            <span className="text-xs font-bold text-slate-400 mt-0.5 block">
              Across {analytics.summary.activeResidentCount} active resident{analytics.summary.activeResidentCount === 1 ? '' : 's'}
              {pgyFilter !== 'all' ? ` (PGY-${pgyFilter})` : ''}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Flagged Questions
            </span>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              {analytics.summary.qualifiedQuestionsCount}
            </div>
            <span className="text-xs font-bold text-slate-400 mt-0.5 block">
              Meeting &ge;3 attempts threshold
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Weakest Categories
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {analytics.categories.length}
            </div>
            <span className="text-xs font-bold text-slate-400 mt-0.5 block">
              With &ge;5 attempts
            </span>
          </div>
        </div>
      )}

      {/* Empty / Sparse State */}
      {!hasQuestions && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
          <TrendingDown className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Not Enough Data Yet</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            {totalAttempts > 0
              ? `${totalAttempts} resident attempts have been recorded across ${totalAttemptedQuestions} distinct questions${
                  pgyFilter !== 'all' ? ` for PGY-${pgyFilter}` : ''
                }. Individual questions require at least 3 active resident attempts before statistical trends, trap distractor metrics, and failure rankings unlock.`
              : `No attempts recorded yet for the selected filters (PGY: ${
                  pgyFilter === 'all' ? 'All' : `PGY-${pgyFilter}`
                }, Source: ${filterType}). As residents complete curriculum blocks or daily questions, failure heatmaps and trap-distractor metrics will automatically appear here.`}
          </p>
        </div>
      )}

      {/* Category Chart with Interactive Filtering */}
      {analytics && analytics.categories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-lg">Most Missed Categories</h3>
              <p className="text-sm font-bold text-slate-400">
                Ranked by failure rate across active residents (minimum 5 cohort attempts). Click any category bar to filter the questions list below.
              </p>
            </div>

            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="self-start sm:self-auto px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
              >
                <span>Filtered by: <strong>{selectedCategory}</strong></span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.categories}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                  stroke="#94a3b8"
                  fontSize={12}
                  fontWeight={700}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={160}
                  stroke="#94a3b8"
                  fontSize={12}
                  fontWeight={700}
                />
                <RechartsTooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Cohort Failure Rate']}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    fontWeight: 'bold',
                  }}
                />
                <Bar
                  dataKey="wrongPct"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    if (entry && entry.name) {
                      setSelectedCategory((prev) => (prev === entry.name ? 'all' : entry.name));
                    }
                  }}
                >
                  {analytics.categories.map((entry, index) => {
                    const isSelected = selectedCategory === entry.name;
                    const isFiltered = selectedCategory !== 'all';
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          isSelected
                            ? '#2563eb'
                            : isFiltered
                            ? '#94a3b8'
                            : index < 3
                            ? '#ef4444'
                            : '#f59e0b'
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Questions Search and Filter Toolbar */}
      {hasQuestions && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-lg">Highest Failure Rate Questions</h3>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                Showing {filteredQuestions.length} of {analytics.questions.length} questions meeting the &ge;3 attempts threshold.
              </p>
            </div>

            {/* In-Memory Search & Category Dropdown */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Categories ({analytics.questions.length})</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Keyword Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search question, pearl..."
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Questions List */}
          {filteredQuestions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <p className="font-bold text-sm">No questions match your current category or search query.</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Clear Search & Category Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredQuestions.map((q, idx) => {
                const isExplanationOpen = expandedExplanations.has(q.id);

                return (
                  <div
                    key={q.id}
                    className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex gap-4">
                      {/* Rank Index */}
                      <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                        #{idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <button
                            onClick={() => setSelectedCategory(q.category)}
                            title="Filter by this category"
                            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-colors"
                          >
                            {q.category}
                          </button>
                          <span className="text-sm font-bold text-red-500 dark:text-red-400">
                            {q.wrongPct.toFixed(1)}% Failed ({q.wrong} of {q.total} attempts)
                          </span>
                        </div>

                        {/* Question Stem */}
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-relaxed mb-4">
                          {q.text}
                        </p>

                        {/* Options Distractor Breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {(q.options as string[]).map((opt: string, i: number) => {
                            const isCorrect = i === q.correct_index;
                            const count = q.optionCounts[i] || 0;
                            const pct = q.total > 0 ? (count / q.total) * 100 : 0;
                            const isCommonTrap = !isCorrect && pct >= 20;

                            return (
                              <div
                                key={i}
                                className={`p-3 rounded-xl border text-xs font-bold flex flex-col gap-1.5 ${
                                  isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                    : isCommonTrap
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex gap-2 justify-between">
                                  <div className="flex gap-2">
                                    <span className="shrink-0 font-black">{String.fromCharCode(65 + i)}.</span>
                                    <span className="line-clamp-2">{opt}</span>
                                  </div>
                                  {isCorrect && (
                                    <span className="ml-auto shrink-0 text-emerald-600 dark:text-emerald-400 text-xs">
                                      ✓ Correct
                                    </span>
                                  )}
                                  {isCommonTrap && (
                                    <span className="ml-auto shrink-0 text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider">
                                      Common Trap
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        isCorrect
                                          ? 'bg-emerald-500'
                                          : isCommonTrap
                                          ? 'bg-amber-500'
                                          : 'bg-slate-400'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`text-[10px] shrink-0 w-8 text-right ${
                                      pct > 0 ? 'opacity-100 font-black' : 'opacity-40'
                                    }`}
                                  >
                                    {pct.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Collapsible Educational Rationale & Key Board Pearl */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            onClick={() => toggleExplanation(q.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {isExplanationOpen
                                ? 'Hide Educational Rationale'
                                : 'View Educational Rationale & Key Pearl'}
                            </span>
                            {isExplanationOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isExplanationOpen && (
                            <div className="mt-3 p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl text-xs space-y-3 animate-fadeIn">
                              <div>
                                <span className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest text-[10px] block mb-1">
                                  Clinical Rationale
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                                  {q.explanation || 'No rationale recorded for this question.'}
                                </p>
                              </div>

                              {q.resource_link && (
                                <div className="pt-2 border-t border-blue-100/60 dark:border-blue-900/40 flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    Board Reference & Guidelines:
                                  </span>
                                  <a
                                    href={q.resource_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 font-bold rounded-lg text-xs shadow-sm transition-all"
                                  >
                                    <span>Open Resource</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
