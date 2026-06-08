'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/qotd';
import { partitionYears } from '@/lib/questionFilters';
import { Database, PlusCircle, Sparkles, Loader2, CheckCircle, ChevronRight } from './AppIcons';

interface AnnualRolloverProps {
  user?: any;
  onNavigate: (tab: string) => void;
}

export default function AnnualRollover({ onNavigate }: AnnualRolloverProps) {
  const [loading, setLoading] = useState(true);
  const [yearCounts, setYearCounts] = useState<{ year: string; count: number }[]>([]);
  const [runwayDays, setRunwayDays] = useState<number>(0);
  const [lastDay, setLastDay] = useState<string | null>(null);

  const [toppingUp, setToppingUp] = useState(false);
  const [topupResult, setTopupResult] = useState<{ added: number; last_day: string | null } | null>(null);
  const [topupError, setTopupError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    const today = getTodayDateString();
    const [qRes, runwayRes, lastRes] = await Promise.all([
      supabase.from('questions').select('year'),
      supabase.from('qotd_schedule').select('schedule_date', { count: 'exact', head: true }).gte('schedule_date', today),
      supabase.from('qotd_schedule').select('schedule_date').order('schedule_date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const counts = new Map<string, number>();
    ((qRes.data as any[]) || []).forEach((q) => {
      if (!q.year || q.year === 'Demo' || q.year === 'Unspecified') return;
      counts.set(q.year, (counts.get(q.year) || 0) + 1);
    });
    setYearCounts(
      Array.from(counts.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => (a.year < b.year ? 1 : -1))
    );
    setRunwayDays((runwayRes as any).count ?? 0);
    setLastDay((lastRes.data as any)?.schedule_date ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTopUp = async () => {
    setToppingUp(true);
    setTopupError(null);
    setTopupResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/qotd-topup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Top-up failed');
      setTopupResult({ added: json.added, last_day: json.last_day });
      await loadStatus();
    } catch (e: any) {
      setTopupError(e?.message || 'Top-up failed');
    } finally {
      setToppingUp(false);
    }
  };

  const newestYears = partitionYears(yearCounts.map((y) => y.year)).recent;
  const totalQuestions = yearCounts.reduce((s, y) => s + y.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-5">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
          <Sparkles className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Annual Rollover</h2>
          <p className="text-slate-500 font-medium mt-1 max-w-2xl">
            Bring each year&apos;s new ITE questions into the app. Custom, mixed, and weak-area quizzes pick up new
            questions automatically &mdash; these steps cover the two places that need a nudge: the Daily Question,
            and (optionally) your curriculum blocks.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard label="Newest ITE year(s)" value={loading ? '…' : (newestYears.join(', ') || '—')} />
        <StatusCard label="Questions on file" value={loading ? '…' : String(totalQuestions)} />
        <StatusCard
          label="Daily Question runway"
          value={loading ? '…' : `${runwayDays} weekday${runwayDays === 1 ? '' : 's'}`}
          sub={lastDay ? `through ${lastDay}` : undefined}
        />
      </div>

      {/* Year breakdown */}
      {!loading && yearCounts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Questions by ITE year</p>
          <div className="flex flex-wrap gap-2">
            {yearCounts.map((y) => (
              <span
                key={y.year}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  newestYears.includes(y.year) ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {y.year}: {y.count}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">
            Blue = within the &ldquo;recent 3&rdquo; freshness window residents see by default.
          </p>
        </div>
      )}

      {/* Step 1 */}
      <StepCard
        n={1}
        title="Import the new ITE questions"
        body="Open the bulk importer, paste your CSV, and set the “Tag all rows as ITE year” field so the new batch is labeled consistently — that keeps the freshness window accurate."
      >
        <button
          onClick={() => onNavigate('questions')}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Database className="w-4 h-4" /> Go to Bulk Import <ChevronRight className="w-4 h-4" />
        </button>
      </StepCard>

      {/* Step 2 */}
      <StepCard
        n={2}
        title="Refresh the Daily Question pool"
        body="Rebuilds the upcoming Daily Question queue from questions nobody has been shown yet — newest ITE year first. Past days are never touched, and no one is ever re-served a question they’ve already answered."
      >
        <div className="space-y-3">
          <button
            onClick={handleTopUp}
            disabled={toppingUp}
            className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {toppingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {toppingUp ? 'Updating…' : 'Update Daily Question pool'}
          </button>
          {topupResult && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Scheduled {topupResult.added} upcoming question{topupResult.added === 1 ? '' : 's'}
              {topupResult.last_day ? ` — daily now runs through ${topupResult.last_day}.` : '.'}
            </div>
          )}
          {topupError && (
            <div className="text-red-700 text-sm font-bold bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {topupError}
            </div>
          )}
        </div>
      </StepCard>

      {/* Step 3 */}
      <StepCard
        n={3}
        title="Refresh curriculum blocks (optional, manual)"
        body="Assigned blocks keep their fixed question sets on purpose. When you want a block to use the new questions, duplicate or rebuild it in the Curriculum Manager — your call, block by block."
      >
        <button
          onClick={() => onNavigate('builder')}
          className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> Open Curriculum Manager <ChevronRight className="w-4 h-4" />
        </button>
      </StepCard>
    </div>
  );
}

function StatusCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-black text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-xs font-bold text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StepCard({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row gap-5">
      <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shrink-0">{n}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-black text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mt-1 mb-4 max-w-2xl">{body}</p>
        {children}
      </div>
    </div>
  );
}
