'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Flame, Gift, CheckCircle2, AlertCircle, RefreshCw,
  Search, X, Check, ArrowRight, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User, Profile, AdminData, ChallengeStandingsResponse, ChallengeResidentStanding } from '@/lib/types';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';

interface ChallengeTrackerProps {
  adminData?: AdminData;
  user?: User | null;
  profile?: Profile | null;
}

export default function ChallengeTracker({ adminData, user, profile }: ChallengeTrackerProps) {
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());
  const [data, setData] = useState<ChallengeStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Spot Check Modal state
  const [spotCheckResident, setSpotCheckResident] = useState<ChallengeResidentStanding | null>(null);

  // Directory search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEligibility, setFilterEligibility] = useState<'all' | 'eligible' | 'ineligible'>('all');

  const fetchStandings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/resident/challenge-standings?academicYear=${selectedYear}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load challenge standings');
      }

      const json: ChallengeStandingsResponse = await res.json();
      setData(json);

      // Keep spot-check resident in sync if modal is open
      setSpotCheckResident((prev) => {
        if (!prev) return null;
        return json.standings.find((s) => s.email.toLowerCase() === prev.email.toLowerCase()) || prev;
      });
    } catch (err: any) {
      console.error('Challenge fetch error:', err);
      setError(err.message || 'Error loading challenge standings');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  // Filtered residents directory
  const filteredResidents = useMemo(() => {
    if (!data) return [];
    let list = [...data.standings];

    if (filterEligibility === 'eligible') {
      list = list.filter((r) => r.isEligible);
    } else if (filterEligibility === 'ineligible') {
      list = list.filter((r) => !r.isEligible);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.pgy.toLowerCase().includes(q));
    }

    return list;
  }, [data, filterEligibility, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-sm shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                DoorDash Challenge Standings
              </h2>
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-black rounded-full uppercase">
                3x $50 Prizes
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rule: All {data?.totalRequiredBlocks || 5} Question Blocks must be completed (even if late) to be eligible to win.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs"
          >
            {getAvailableAcademicYears().map((yr) => (
              <option key={yr} value={yr}>
                {formatAcademicYear(yr)}
              </option>
            ))}
          </select>

          <button
            onClick={fetchStandings}
            disabled={loading}
            title="Refresh standings"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      {/* TOP 3 PER CATEGORY CARDS */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CATEGORY 1: MOST APs */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍔</span>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">Most Academic Points</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Block + Attendance Points combined</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 rounded-full text-[10px] font-black">
                  $50 Card
                </span>
              </div>

              {/* Leading Eligible Resident */}
              <div className="mb-4">
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                  👑 Current 1st Place (Eligible)
                </span>
                {data.leaders.ap.eligible ? (
                  <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                          {data.leaders.ap.eligible.name}
                        </h4>
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {data.leaders.ap.eligible.totalAp} APs <span className="font-normal opacity-80">({data.leaders.ap.eligible.blockPoints} block + {data.leaders.ap.eligible.attendancePoints} attend)</span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {data.leaders.ap.eligible.pgy} · All {data.leaders.ap.eligible.totalRequiredBlocks} blocks complete
                        </p>
                      </div>
                      <button
                        onClick={() => setSpotCheckResident(data.leaders.ap.eligible)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-slate-700 text-[11px] font-black rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                        title="Spot Check this winner"
                      >
                        Verify 🔍
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 italic text-center">
                    No resident has completed all required blocks yet.
                  </div>
                )}
              </div>

              {/* Ineligible Leader Note (if raw leader is missing blocks) */}
              {data.leaders.ap.overall && data.leaders.ap.overall.email !== data.leaders.ap.eligible?.email && (
                <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Highest Raw: </span>
                  {data.leaders.ap.overall.name} ({data.leaders.ap.overall.totalAp} APs)
                  <p className="text-red-600 dark:text-red-400 text-[10px] font-semibold mt-0.5">
                    ⚠️ Ineligible (missing {data.leaders.ap.overall.missingBlockTitles.length} block{data.leaders.ap.overall.missingBlockTitles.length === 1 ? '' : 's'}). Complete them to qualify!
                  </p>
                </div>
              )}

              {/* Top 3 Contenders */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                  Top 3 Contenders
                </span>
                <div className="space-y-1.5">
                  {(data.leaders.ap.top3Overall || []).map((r, idx) => (
                    <div
                      key={r.email}
                      onClick={() => setSpotCheckResident(r)}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      title="Click to spot check"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs text-slate-400 w-4 shrink-0">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.pgy}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{r.totalAp} pts</span>
                        {r.isEligible ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold" title="Completed all blocks">✅</span>
                        ) : (
                          <span className="text-amber-500 text-[10px] font-bold" title={`Missing ${r.missingBlockTitles.length} block(s)`}>⏳</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CATEGORY 2: MOST QOTDs */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">Most Completed QOTDs</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Daily questions answered in academic year</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 rounded-full text-[10px] font-black">
                  $50 Card
                </span>
              </div>

              {/* Leading Eligible Resident */}
              <div className="mb-4">
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-1">
                  👑 Current 1st Place (Eligible)
                </span>
                {data.leaders.qotd.eligible ? (
                  <div className="p-3.5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 rounded-2xl border border-purple-200/80 dark:border-purple-900/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                          {data.leaders.qotd.eligible.name}
                        </h4>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                          {data.leaders.qotd.eligible.qotdCompletedCount} QOTDs Answered
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {data.leaders.qotd.eligible.pgy} · All {data.leaders.qotd.eligible.totalRequiredBlocks} blocks complete
                        </p>
                      </div>
                      <button
                        onClick={() => setSpotCheckResident(data.leaders.qotd.eligible)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-slate-700 text-[11px] font-black rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                        title="Spot Check this winner"
                      >
                        Verify 🔍
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 italic text-center">
                    No resident has completed all required blocks yet.
                  </div>
                )}
              </div>

              {/* Ineligible Leader Note */}
              {data.leaders.qotd.overall && data.leaders.qotd.overall.email !== data.leaders.qotd.eligible?.email && (
                <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Highest Raw: </span>
                  {data.leaders.qotd.overall.name} ({data.leaders.qotd.overall.qotdCompletedCount} QOTDs)
                  <p className="text-red-600 dark:text-red-400 text-[10px] font-semibold mt-0.5">
                    ⚠️ Ineligible (missing {data.leaders.qotd.overall.missingBlockTitles.length} block{data.leaders.qotd.overall.missingBlockTitles.length === 1 ? '' : 's'}). Complete them to qualify!
                  </p>
                </div>
              )}

              {/* Top 3 Contenders */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                  Top 3 Contenders
                </span>
                <div className="space-y-1.5">
                  {(data.leaders.qotd.top3Overall || []).map((r, idx) => (
                    <div
                      key={r.email}
                      onClick={() => setSpotCheckResident(r)}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      title="Click to spot check"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs text-slate-400 w-4 shrink-0">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.pgy}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{r.qotdCompletedCount} Qs</span>
                        {r.isEligible ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold" title="Completed all blocks">✅</span>
                        ) : (
                          <span className="text-amber-500 text-[10px] font-bold" title={`Missing ${r.missingBlockTitles.length} block(s)`}>⏳</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CATEGORY 3: LONGEST STREAK */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">Longest QOTD Streak</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Consecutive weekdays at academic year end</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 rounded-full text-[10px] font-black">
                  $50 Card
                </span>
              </div>

              {/* Leading Eligible Resident */}
              <div className="mb-4">
                <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider block mb-1">
                  👑 Current 1st Place (Eligible)
                </span>
                {data.leaders.streak.eligible ? (
                  <div className="p-3.5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 rounded-2xl border border-orange-200/80 dark:border-orange-900/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                          {data.leaders.streak.eligible.name}
                        </h4>
                        <p className="text-xs font-bold text-orange-700 dark:text-orange-300">
                          {data.leaders.streak.eligible.longestStreak} Weekday Streak <span className="font-normal opacity-80">(Curr: {data.leaders.streak.eligible.currentStreak}d)</span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {data.leaders.streak.eligible.pgy} · All {data.leaders.streak.eligible.totalRequiredBlocks} blocks complete
                        </p>
                      </div>
                      <button
                        onClick={() => setSpotCheckResident(data.leaders.streak.eligible)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-slate-700 text-[11px] font-black rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                        title="Spot Check this winner"
                      >
                        Verify 🔍
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 italic text-center">
                    No resident has completed all required blocks yet.
                  </div>
                )}
              </div>

              {/* Ineligible Leader Note */}
              {data.leaders.streak.overall && data.leaders.streak.overall.email !== data.leaders.streak.eligible?.email && (
                <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Highest Raw: </span>
                  {data.leaders.streak.overall.name} ({data.leaders.streak.overall.longestStreak} days)
                  <p className="text-red-600 dark:text-red-400 text-[10px] font-semibold mt-0.5">
                    ⚠️ Ineligible (missing {data.leaders.streak.overall.missingBlockTitles.length} block{data.leaders.streak.overall.missingBlockTitles.length === 1 ? '' : 's'}). Complete them to qualify!
                  </p>
                </div>
              )}

              {/* Top 3 Contenders */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                  Top 3 Contenders
                </span>
                <div className="space-y-1.5">
                  {(data.leaders.streak.top3Overall || []).map((r, idx) => (
                    <div
                      key={r.email}
                      onClick={() => setSpotCheckResident(r)}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      title="Click to spot check"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs text-slate-400 w-4 shrink-0">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.pgy}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{r.longestStreak}d</span>
                        {r.isEligible ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold" title="Completed all blocks">✅</span>
                        ) : (
                          <span className="text-amber-500 text-[10px] font-bold" title={`Missing ${r.missingBlockTitles.length} block(s)`}>⏳</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPOT CHECK & VERIFICATION DIRECTORY */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              Resident Verification Directory
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Spot check any resident to audit their block completion checklist and performance proofs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search resident..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <select
              value={filterEligibility}
              onChange={(e) => setFilterEligibility(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="all">All Contenders</option>
              <option value="eligible">Eligible Only</option>
              <option value="ineligible">Needs Blocks</option>
            </select>
          </div>
        </div>

        {/* Resident Roster Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Resident</th>
                <th className="py-2.5 px-3">PGY</th>
                <th className="py-2.5 px-3">Block Eligibility Status</th>
                <th className="py-2.5 px-3">Total APs</th>
                <th className="py-2.5 px-3">QOTDs</th>
                <th className="py-2.5 px-3">Streak</th>
                <th className="py-2.5 px-3">Projected Prize</th>
                <th className="py-2.5 px-3 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredResidents.map((r) => (
                <tr
                  key={r.email}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                    r.potentialWinnings > 0 ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{r.name}</span>
                      {r.potentialWinnings > 0 && (
                        <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[9px] font-black rounded">
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal truncate">{r.email}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-medium">
                    {r.pgy}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.isEligible ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> {r.completedBlocksCount}/{r.totalRequiredBlocks} Complete (Eligible)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        <AlertCircle className="w-3 h-3" /> {r.completedBlocksCount}/{r.totalRequiredBlocks} (Needs {r.missingBlockTitles.length})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-black text-slate-800 dark:text-slate-200">
                    {r.totalAp} pts
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                    {r.qotdCompletedCount}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                    {r.longestStreak}d
                  </td>
                  <td className="py-2.5 px-3">
                    {r.potentialWinnings > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-md text-[10px] font-black">
                        ${r.potentialWinnings} Gift Card
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSpotCheckResident(r)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      Spot Check 🔍
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPOT CHECK / VERIFICATION MODAL */}
      {spotCheckResident && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSpotCheckResident(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${spotCheckResident.isEligible ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                  {spotCheckResident.isEligible ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Verification Audit: {spotCheckResident.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {spotCheckResident.pgy} · {spotCheckResident.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpotCheckResident(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Verdict Banner */}
              <div className={`p-4 rounded-2xl border ${
                spotCheckResident.isEligible
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100'
              }`}>
                <div className="flex items-center gap-2">
                  {spotCheckResident.isEligible ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-black text-sm">✅ ELIGIBILITY VERIFIED: 100% Blocks Completed</h4>
                        <p className="text-xs opacity-90 mt-0.5">
                          Resident has completed all {spotCheckResident.totalRequiredBlocks} required question blocks (including on-time and late submissions). They are fully eligible to win prizes!
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <h4 className="font-black text-sm">⚠️ NOT CURRENTLY ELIGIBLE: Missing {spotCheckResident.missingBlockTitles.length} Block(s)</h4>
                        <p className="text-xs opacity-90 mt-0.5">
                          Per challenge rules, all blocks must be completed before prizes are awarded. Resident must complete: <strong>{spotCheckResident.missingBlockTitles.join(', ')}</strong>.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Block by Block Checklist */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
                  Curriculum Block Audit ({spotCheckResident.completedBlocksCount} of {spotCheckResident.totalRequiredBlocks} Complete)
                </h4>
                <div className="space-y-2">
                  {(spotCheckResident.blockAudit || []).map((b) => (
                    <div
                      key={b.title}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        b.isCompleted
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {b.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{b.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {b.completedAt ? `Submitted: ${new Date(b.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No submission recorded'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {b.score != null && b.total != null && (
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            {b.score}/{b.total} ({b.percentage || 0}%)
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          b.timingStatus === 'On-Time'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : b.timingStatus === 'Late'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
                            : b.isCompleted
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        }`}>
                          {b.timingStatus || (b.isCompleted ? 'Completed' : 'Missing')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {b.academicPoints || 0} APs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Point & Metric Proofs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Academic Points</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{spotCheckResident.totalAp} pts</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {spotCheckResident.blockPoints} block + {spotCheckResident.attendancePoints} attendance
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Completed QOTDs</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{spotCheckResident.qotdCompletedCount}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Daily questions answered
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Max Streak</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{spotCheckResident.longestStreak} days</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Current: {spotCheckResident.currentStreak} consecutive weekdays
                  </p>
                </div>
              </div>

              {/* Prize Summary */}
              {spotCheckResident.potentialWinnings > 0 ? (
                <div className="p-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className="w-6 h-6 text-white" />
                    <div>
                      <h4 className="font-black text-sm">Projected Winner: ${spotCheckResident.potentialWinnings} DoorDash Card!</h4>
                      <p className="text-xs opacity-90">
                        Leading: {spotCheckResident.winningCategories.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-center text-xs text-slate-500">
                  Not currently in 1st place for any $50 DoorDash category.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSpotCheckResident(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
