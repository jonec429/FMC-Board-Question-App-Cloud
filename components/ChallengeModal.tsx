'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Flame, Gift, Sparkles, CheckCircle2, AlertCircle, X, ChevronRight,
  Search, RefreshCw, Award, Info, BookOpen, ExternalLink, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User, Profile, ChallengeStandingsResponse, ChallengeResidentStanding } from '@/lib/types';
import { formatAcademicYear } from '@/lib/academicYear';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  profile?: Profile | null;
  academicYear: number;
  onStartQuiz?: (quiz: { topic: string; count?: number; quizId?: string }) => void;
}

export default function ChallengeModal({
  isOpen,
  onClose,
  user,
  profile,
  academicYear,
  onStartQuiz
}: ChallengeModalProps) {
  const [data, setData] = useState<ChallengeStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ap' | 'qotd' | 'streak'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEligibleOnly, setFilterEligibleOnly] = useState(false);

  const fetchStandings = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/resident/challenge-standings?academicYear=${academicYear}`, {
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
    } catch (err: any) {
      console.error('Challenge fetch error:', err);
      setError(err.message || 'Error loading challenge standings');
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    if (isOpen) {
      fetchStandings();
    }
  }, [isOpen, fetchStandings]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Current user's standing
  const myStanding = useMemo(() => {
    if (!data || !user.email) return null;
    return data.standings.find(
      (s) => s.email.toLowerCase() === user.email?.toLowerCase() || (s.userId && s.userId === user.id)
    ) || null;
  }, [data, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner with DoorDash Theme */}
        <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 sm:p-6 text-white overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-24 -mb-10 w-32 h-32 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner shrink-0">
                <Gift className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/25 rounded-full text-[10px] font-black uppercase tracking-wider text-white">
                    Official Residency Challenge
                  </span>
                  <span className="px-2.5 py-0.5 bg-black/20 rounded-full text-[10px] font-bold text-amber-200">
                    {formatAcademicYear(academicYear)}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
                  BRQ DoorDash Challenge
                </h2>
                <p className="text-rose-100 text-xs sm:text-sm font-medium mt-0.5">
                  Three $50 DoorDash Gift Cards · $150 Prize Pool · Multi-wins Allowed!
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 3 Challenge Pillars Quick Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-4 pt-3 border-t border-white/20 text-xs">
            <div className="bg-black/15 backdrop-blur-xs rounded-xl p-2.5 flex items-center gap-2.5">
              <span className="text-xl">🍔</span>
              <div className="min-w-0">
                <div className="font-black text-white">$50: Most APs</div>
                <div className="text-[10px] text-rose-100/90 truncate">Block + Attendance Points</div>
              </div>
            </div>
            <div className="bg-black/15 backdrop-blur-xs rounded-xl p-2.5 flex items-center gap-2.5">
              <span className="text-xl">📅</span>
              <div className="min-w-0">
                <div className="font-black text-white">$50: Most QOTDs</div>
                <div className="text-[10px] text-rose-100/90 truncate">Total Daily Questions Completed</div>
              </div>
            </div>
            <div className="bg-black/15 backdrop-blur-xs rounded-xl p-2.5 flex items-center gap-2.5">
              <span className="text-xl">🔥</span>
              <div className="min-w-0">
                <div className="font-black text-white">$50: Longest Streak</div>
                <div className="text-[10px] text-rose-100/90 truncate">Consecutive Weekday QOTD Run</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-3 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            My Status & Rules
          </button>
          <button
            onClick={() => setActiveTab('ap')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ap'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            Challenge 1: Most APs
          </button>
          <button
            onClick={() => setActiveTab('qotd')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'qotd'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="text-sm">📅</span>
            Challenge 2: Most QOTDs
          </button>
          <button
            onClick={() => setActiveTab('streak')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'streak'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-500" />
            Challenge 3: Longest Streak
          </button>

          <div className="ml-auto pb-3">
            <button
              onClick={fetchStandings}
              disabled={loading}
              title="Refresh standings"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-500">Loading challenge leaderboard...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Failed to load challenge standings</p>
                <p className="text-xs mt-0.5">{error}</p>
                <button onClick={fetchStandings} className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700">
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & MY STATUS */}
              {activeTab === 'overview' && data && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* The Golden Rule / Caveat Callout Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row items-start gap-3.5">
                    <div className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                      <h4 className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                        <span>Crucial Eligibility Caveat:</span>
                        <span className="font-bold underline decoration-amber-500">You must complete every Question Block!</span>
                      </h4>
                      <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                        To be eligible to win any of the three prizes, you must have completed <strong>every assigned Question Block</strong> for this academic year (even if it was completed late). 
                        Late blocks do not earn APs, but completing them keeps you in good academic standing and qualifies you to win!
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] font-bold text-amber-900 dark:text-amber-100">
                        <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded-md">
                          ✓ One resident can win multiple challenges ($150 max!)
                        </span>
                        <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded-md">
                          ✓ QOTD does not count towards APs (purely for study &amp; QOTD prizes)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Resident Personal Standing Card */}
                  {myStanding && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                              Your Challenge Status
                            </h3>
                            {myStanding.isEligible ? (
                              <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-[11px] rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Eligible to Win
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black text-[11px] rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Incomplete ({myStanding.completedBlocksCount}/{myStanding.totalRequiredBlocks} Blocks)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {myStanding.isEligible
                              ? "You've completed all required blocks! You are officially in the running for all 3 DoorDash gift cards."
                              : `You have ${myStanding.missingBlockTitles.length} block${myStanding.missingBlockTitles.length === 1 ? '' : 's'} remaining to complete to unlock your prize eligibility.`}
                          </p>
                        </div>

                        {myStanding.potentialWinnings > 0 && (
                          <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-xl text-center shadow-md shrink-0">
                            <div className="text-[10px] font-black uppercase tracking-wider">Projected Winnings</div>
                            <div className="text-xl font-black">${myStanding.potentialWinnings} DoorDash!</div>
                          </div>
                        )}
                      </div>

                      {/* 3 Metric Cards for Current Resident */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {/* AP */}
                        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1">🍔 Total APs</span>
                            <span className="font-bold">Rank #{myStanding.rankAp}</span>
                          </div>
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {myStanding.totalAp} <span className="text-xs font-bold text-slate-400">pts</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                            <span>{myStanding.blockPoints} block + {myStanding.attendancePoints} attend</span>
                            {myStanding.eligibleRankAp && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">#{myStanding.eligibleRankAp} eligible</span>
                            )}
                          </div>
                        </div>

                        {/* QOTD Count */}
                        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1">📅 QOTD Completed</span>
                            <span className="font-bold">Rank #{myStanding.rankQotd}</span>
                          </div>
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {myStanding.qotdCompletedCount} <span className="text-xs font-bold text-slate-400">answered</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                            <span>Asynchronous study</span>
                            {myStanding.eligibleRankQotd && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">#{myStanding.eligibleRankQotd} eligible</span>
                            )}
                          </div>
                        </div>

                        {/* Streak */}
                        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1">🔥 Longest Streak</span>
                            <span className="font-bold">Rank #{myStanding.rankStreak}</span>
                          </div>
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {myStanding.longestStreak} <span className="text-xs font-bold text-slate-400">days</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                            <span>Current: {myStanding.currentStreak}d</span>
                            {myStanding.eligibleRankStreak && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">#{myStanding.eligibleRankStreak} eligible</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Required Blocks Checklist */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Required Blocks Checklist ({myStanding.completedBlocksCount} of {myStanding.totalRequiredBlocks} Complete)
                          </h4>
                          <span className="text-xs font-bold text-slate-500">
                            {Math.round((myStanding.completedBlocksCount / (myStanding.totalRequiredBlocks || 1)) * 100)}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              myStanding.isEligible ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((myStanding.completedBlocksCount / (myStanding.totalRequiredBlocks || 1)) * 100))}%` }}
                          />
                        </div>

                        {/* Block list */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {data.requiredBlockTitles.map((title) => {
                            const isDone = myStanding.completedBlockTitles.includes(title);
                            return (
                              <div
                                key={title}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                                  isDone
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  {isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                                  )}
                                  <span className={`truncate font-medium ${isDone ? 'font-semibold' : ''}`}>
                                    {title}
                                  </span>
                                </div>

                                {!isDone && onStartQuiz && (
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onStartQuiz({ topic: title });
                                    }}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all shrink-0 flex items-center gap-1 shadow-xs"
                                  >
                                    Take <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Projected Winners Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" /> Current Leaders &amp; Contenders
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Leader AP */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-900/40 relative">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1 flex items-center justify-between">
                          <span>🍔 Most APs</span>
                          <span className="px-1.5 py-0.5 bg-amber-500/20 rounded text-[9px] font-bold">$50 Card</span>
                        </div>
                        {data.leaders.ap.eligible ? (
                          <div>
                            <div className="text-base font-black text-slate-900 dark:text-white truncate">
                              {data.leaders.ap.eligible.name}
                            </div>
                            <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                              {data.leaders.ap.eligible.totalAp} APs · {data.leaders.ap.eligible.pgy}
                            </div>
                            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 100% Blocks Completed (Eligible)
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">No eligible residents yet.</div>
                        )}
                        {data.leaders.ap.overall && data.leaders.ap.overall.email !== data.leaders.ap.eligible?.email && (
                          <div className="mt-3 pt-2 border-t border-amber-200/50 dark:border-amber-900/50 text-[10px] text-slate-500 dark:text-slate-400">
                            Highest overall: <strong>{data.leaders.ap.overall.name}</strong> ({data.leaders.ap.overall.totalAp} pts, needs {data.leaders.ap.overall.missingBlockTitles.length} block{data.leaders.ap.overall.missingBlockTitles.length === 1 ? '' : 's'})
                          </div>
                        )}
                      </div>

                      {/* Leader QOTD */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900/40 relative">
                        <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1 flex items-center justify-between">
                          <span>📅 Most QOTD</span>
                          <span className="px-1.5 py-0.5 bg-purple-500/20 rounded text-[9px] font-bold">$50 Card</span>
                        </div>
                        {data.leaders.qotd.eligible ? (
                          <div>
                            <div className="text-base font-black text-slate-900 dark:text-white truncate">
                              {data.leaders.qotd.eligible.name}
                            </div>
                            <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                              {data.leaders.qotd.eligible.qotdCompletedCount} QOTDs · {data.leaders.qotd.eligible.pgy}
                            </div>
                            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 100% Blocks Completed (Eligible)
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">No eligible residents yet.</div>
                        )}
                        {data.leaders.qotd.overall && data.leaders.qotd.overall.email !== data.leaders.qotd.eligible?.email && (
                          <div className="mt-3 pt-2 border-t border-purple-200/50 dark:border-purple-900/50 text-[10px] text-slate-500 dark:text-slate-400">
                            Highest overall: <strong>{data.leaders.qotd.overall.name}</strong> ({data.leaders.qotd.overall.qotdCompletedCount} answered, needs {data.leaders.qotd.overall.missingBlockTitles.length} block{data.leaders.qotd.overall.missingBlockTitles.length === 1 ? '' : 's'})
                          </div>
                        )}
                      </div>

                      {/* Leader Streak */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-900/40 relative">
                        <div className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-1 flex items-center justify-between">
                          <span>🔥 Longest Streak</span>
                          <span className="px-1.5 py-0.5 bg-orange-500/20 rounded text-[9px] font-bold">$50 Card</span>
                        </div>
                        {data.leaders.streak.eligible ? (
                          <div>
                            <div className="text-base font-black text-slate-900 dark:text-white truncate">
                              {data.leaders.streak.eligible.name}
                            </div>
                            <div className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                              {data.leaders.streak.eligible.longestStreak} Days · {data.leaders.streak.eligible.pgy}
                            </div>
                            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 100% Blocks Completed (Eligible)
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">No eligible residents yet.</div>
                        )}
                        {data.leaders.streak.overall && data.leaders.streak.overall.email !== data.leaders.streak.eligible?.email && (
                          <div className="mt-3 pt-2 border-t border-orange-200/50 dark:border-orange-900/50 text-[10px] text-slate-500 dark:text-slate-400">
                            Highest overall: <strong>{data.leaders.streak.overall.name}</strong> ({data.leaders.streak.overall.longestStreak}d, needs {data.leaders.streak.overall.missingBlockTitles.length} block{data.leaders.streak.overall.missingBlockTitles.length === 1 ? '' : 's'})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TABS 2, 3, 4: CHALLENGE LEADERBOARD TABLES */}
              {activeTab !== 'overview' && data && (
                <div className="space-y-4 animate-fade-in">
                  {/* Category Description Banner */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                        {activeTab === 'ap' && <span>🍔 Challenge 1: Most Academic Points (APs)</span>}
                        {activeTab === 'qotd' && <span>📅 Challenge 2: Most Completed QOTDs</span>}
                        {activeTab === 'streak' && <span>🔥 Challenge 3: Longest QOTD Streak</span>}
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-full text-xs font-black">
                          $50 DoorDash
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeTab === 'ap' && 'Combined block points and attendance points. Late blocks do not earn APs, but keep you eligible!'}
                        {activeTab === 'qotd' && 'Total daily questions answered asynchronously across this academic year.'}
                        {activeTab === 'streak' && 'Highest consecutive weekday streak achieved at any point during this academic year.'}
                      </p>
                    </div>

                    {/* Quick Filter Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterEligibleOnly}
                          onChange={(e) => setFilterEligibleOnly(e.target.checked)}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-700"
                        />
                        <span>Eligible Only ({data.eligibleCount})</span>
                      </label>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search resident name or PGY..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  {/* Leaderboard Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4 w-12 text-center">Rank</th>
                            <th className="py-3 px-4">Resident</th>
                            <th className="py-3 px-3">PGY</th>
                            <th className="py-3 px-4">
                              {activeTab === 'ap' && 'Academic Points (APs)'}
                              {activeTab === 'qotd' && 'QOTD Answered'}
                              {activeTab === 'streak' && 'Longest Streak'}
                            </th>
                            <th className="py-3 px-4">Blocks Completed</th>
                            <th className="py-3 px-4">Eligibility</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {(() => {
                            // Sort list based on current active tab
                            let list = [...data.standings];
                            if (activeTab === 'ap') list.sort((a, b) => b.totalAp - a.totalAp);
                            if (activeTab === 'qotd') list.sort((a, b) => b.qotdCompletedCount - a.qotdCompletedCount);
                            if (activeTab === 'streak') list.sort((a, b) => b.longestStreak - a.longestStreak);

                            // Apply filters
                            if (filterEligibleOnly) list = list.filter((s) => s.isEligible);
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              list = list.filter((s) => s.name.toLowerCase().includes(q) || s.pgy.toLowerCase().includes(q));
                            }

                            if (list.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                    No residents match the current search / filter.
                                  </td>
                                </tr>
                              );
                            }

                            return list.map((resident, idx) => {
                              const isMe = user.email && resident.email.toLowerCase() === user.email.toLowerCase();
                              
                              // Check if this resident is the eligible leader for this category
                              const isEligibleLeader = 
                                (activeTab === 'ap' && resident.eligibleRankAp === 1) ||
                                (activeTab === 'qotd' && resident.eligibleRankQotd === 1) ||
                                (activeTab === 'streak' && resident.eligibleRankStreak === 1);

                              return (
                                <tr
                                  key={resident.email}
                                  className={`transition-colors ${
                                    isMe 
                                      ? 'bg-blue-50/70 dark:bg-blue-950/40 font-bold' 
                                      : isEligibleLeader
                                      ? 'bg-amber-50/50 dark:bg-amber-950/20'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  {/* Rank */}
                                  <td className="py-3 px-4 text-center font-black">
                                    {idx === 0 ? (
                                      <span className="text-base">🥇</span>
                                    ) : idx === 1 ? (
                                      <span className="text-base">🥈</span>
                                    ) : idx === 2 ? (
                                      <span className="text-base">🥉</span>
                                    ) : (
                                      <span className="text-slate-400">{idx + 1}</span>
                                    )}
                                  </td>

                                  {/* Name */}
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {resident.name}
                                      </span>
                                      {isMe && (
                                        <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] rounded font-black uppercase">
                                          You
                                        </span>
                                      )}
                                      {isEligibleLeader && (
                                        <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] rounded font-black flex items-center gap-0.5">
                                          🏆 $50 Contender
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* PGY */}
                                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium">
                                    {resident.pgy}
                                  </td>

                                  {/* Score Value */}
                                  <td className="py-3 px-4">
                                    {activeTab === 'ap' && (
                                      <div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                          {resident.totalAp}
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-1">
                                          ({resident.blockPoints} blk + {resident.attendancePoints} att)
                                        </span>
                                      </div>
                                    )}
                                    {activeTab === 'qotd' && (
                                      <div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                          {resident.qotdCompletedCount}
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-1">answered</span>
                                      </div>
                                    )}
                                    {activeTab === 'streak' && (
                                      <div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                          {resident.longestStreak}d
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-1">
                                          (curr: {resident.currentStreak}d)
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Blocks */}
                                  <td className="py-3 px-4">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      {resident.completedBlocksCount} / {resident.totalRequiredBlocks}
                                    </span>
                                  </td>

                                  {/* Eligibility Badge */}
                                  <td className="py-3 px-4">
                                    {resident.isEligible ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="w-3 h-3" /> Eligible
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                                        Needs {resident.missingBlockTitles.length} Block{resident.missingBlockTitles.length === 1 ? '' : 's'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 truncate pr-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Tip:</span>
            <span>You can complete past-due Question Blocks at any time to regain eligibility for the prizes!</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl transition-colors shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
