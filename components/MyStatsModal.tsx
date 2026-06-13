'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout, formatDisplayName } from '@/lib/utils';
import { Trophy, X, Loader2, Target, ExternalLink, ChevronLeft, ChevronRight, Save } from './AppIcons';
import { LeaderboardEntry } from '@/lib/types';
import QuizReview from './QuizReview';
import { exportIncorrectToAnki, downloadCsv } from '@/lib/anki';
import { getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';

interface MyStatsModalProps {
  onClose: () => void;
  profile: any;
  userEmail: string;
  userId: string;
  avgPct: number | null;
  blocksCompleted: number;
  totalPoints: number;
  myResults: any[];
  leaderboard: LeaderboardEntry[];
  userBadges: any[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export default function MyStatsModal({
  onClose,
  profile,
  userEmail,
  userId,
  avgPct,
  blocksCompleted,
  totalPoints,
  myResults,
  leaderboard,
  userBadges,
  selectedYear,
  onYearChange,
}: MyStatsModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'weakAreas' | 'pastQuizzes'>('stats');
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [reviewItems, setReviewItems] = useState<any[] | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [showAllReview, setShowAllReview] = useState(false);
  const [exportingAnki, setExportingAnki] = useState(false);
  const [qotdStats, setQotdStats] = useState<{ correct: number; incorrect: number } | null>(null);

  // Weak Areas State
  const [loadingWeakAreas, setLoadingWeakAreas] = useState(false);
  const [missedQuestions, setMissedQuestions] = useState<any[]>([]);
  const [latestStatus, setLatestStatus] = useState<Map<string, boolean>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Filter missed questions by the selected topic
  const displayedMissedQuestions = selectedTopic 
    ? missedQuestions.filter(q => q.category === selectedTopic)
    : missedQuestions;

  // Reset index when changing filter
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedTopic]);

  // Past Quizzes: the resident's completed blocks/customs (newest first). Excludes
  // QOTD and the demo. New quizzes carry a `review_data` snapshot for full review.
  const pastQuizzes = [...(myResults || [])]
    .filter((r: any) => r.topic && !/question of the day|^demo/i.test(r.topic))
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const openReview = async (r: any) => {
    setSelectedQuiz(r);
    setReviewItems(null);
    const rd = Array.isArray(r.review_data) ? r.review_data : null;
    if (!rd || rd.length === 0) return; // taken before review snapshots were saved
    setLoadingReview(true);
    try {
      const ids = rd.map((x: any) => x.q).filter(Boolean);
      const { data } = await withTimeout(supabase.from('questions').select('*').in('id', ids), 10000) as any;
      const byId = new Map((data || []).map((q: any) => [q.id, q]));
      setReviewItems(rd.map((x: any) => ({ question: byId.get(x.q), selected: x.a })));
    } catch {
      setReviewItems([]);
    } finally {
      setLoadingReview(false);
    }
  };

  // Filter out demo quizzes from all stats
  const profileResults = (myResults || []).filter((r: any) => !r.topic?.toLowerCase().includes('demo'));

  const totalQs = profileResults.reduce((a, r) => a + (r.total || 0), 0);
  const myRankIdx = leaderboard.findIndex(l => Boolean(l.email && userEmail && l.email.toLowerCase() === userEmail.toLowerCase()));
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // Class leader: #1 within same PGY class
  const classmates = profile?.pgy ? leaderboard.filter(l => l.pgy === profile.pgy) : [];
  const classLeader = classmates.length > 0 ? classmates[0] : null;
  const isClassLeader = Boolean(classLeader?.email && userEmail && classLeader.email.toLowerCase() === userEmail.toLowerCase());

  // Topic / subject breakdown (group by topic, compute avg)
  const topicStats = new Map<string, { sum: number; count: number; qs: number }>();
  profileResults.forEach(r => {
    if (!r.topic) return;
    if (!topicStats.has(r.topic)) topicStats.set(r.topic, { sum: 0, count: 0, qs: 0 });
    const entry = topicStats.get(r.topic)!;
    entry.sum += r.percentage || 0;
    entry.count += 1;
    entry.qs += r.total || 0;
  });
  const topicAverages = Array.from(topicStats.entries())
    .map(([topic, { sum, count, qs }]) => ({ topic, avg: sum / count, attempts: count, qs }))
    .sort((a, b) => b.avg - a.avg);

  const getNextBadgeInfo = () => {
    const clubs = [100, 140, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    for (const c of clubs) {
      if (totalQs < c) {
        return { name: `${c} Club`, remaining: c - totalQs };
      }
    }
    return null;
  };
  const nextBadge = getNextBadgeInfo();

  useEffect(() => {
    async function loadQotdStats() {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('question_attempts')
            .select('is_correct')
            .eq('user_id', userId)
            .eq('is_qotd', true),
          10000
        ) as any;

        if (error) throw error;
        if (data) {
          const correct = data.filter((a: any) => a.is_correct).length;
          const incorrect = data.length - correct;
          setQotdStats({ correct, incorrect });
        }
      } catch (err) {
        console.error('Failed to load QOTD stats:', err);
      }
    }
    loadQotdStats();
  }, [userId]);

  useEffect(() => {
    async function loadMissedQuestions() {
      if (activeTab !== 'weakAreas' || missedQuestions.length > 0) return;
      
      setLoadingWeakAreas(true);
      try {
        // Fetch all attempts for the user
        const { data: attempts, error: attError } = await withTimeout(
          supabase
            .from('question_attempts')
            .select('question_id, is_correct, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          10000
        ) as any;

        if (attError) throw attError;

        if (!attempts || attempts.length === 0) {
          setMissedQuestions([]);
          return;
        }

        // Dedupe by question_id (keep latest attempt)
        const latestAttempts = new Map<string, boolean>();
        const everMissed = new Set<string>();

        attempts.forEach((a: any) => {
          if (!latestAttempts.has(a.question_id)) {
            latestAttempts.set(a.question_id, a.is_correct);
          }
          if (!a.is_correct) everMissed.add(a.question_id);
        });

        const incorrectIds = Array.from(everMissed);

        if (incorrectIds.length === 0) {
          setMissedQuestions([]);
          return;
        }

        setLatestStatus(latestAttempts);

        // Fetch question details
        const { data: qData, error: qError } = await supabase
          .from('questions')
          .select('*')
          .in('id', incorrectIds);

        if (qError) throw qError;
        setMissedQuestions(qData || []);
      } catch (err) {
        console.error('Failed to load missed questions:', err);
      } finally {
        setLoadingWeakAreas(false);
      }
    }
    loadMissedQuestions();
  }, [activeTab, userId, missedQuestions.length]);

  const handleNext = () => {
    if (currentIndex < displayedMissedQuestions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleExportAnki = async () => {
    try {
      setExportingAnki(true);
      const csv = await exportIncorrectToAnki(userId);
      if (csv) {
        downloadCsv('fmc_board_prep_incorrect_qs_anki.csv', csv);
      } else {
        alert('No incorrect questions to export.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to export Anki flashcards.');
    } finally {
      setExportingAnki(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-800 truncate">{formatDisplayName(profile?.full_name) !== 'Unknown' ? formatDisplayName(profile?.full_name) : 'My Performance'}</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                {profile?.pgy || 'No Designation Set'}{profile?.advisor ? ` · Advisor: ${profile.advisor}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl shrink-0">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* QOTD Performance was moved into the snapshot card */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'stats' 
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Stats & Badges
          </button>
          <button
            onClick={() => setActiveTab('weakAreas')}
            className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'weakAreas' 
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Review Weak Areas
          </button>
          <button
            onClick={() => { setActiveTab('pastQuizzes'); setSelectedQuiz(null); setReviewItems(null); }}
            className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'pastQuizzes'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Past Quizzes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-fade-in">
              {/* Unified Snapshot Widget */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 space-y-8">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                      <Target className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Board Prep Snapshot</h3>
                  </div>
                  <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-bold text-white text-xs shadow-sm outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm cursor-pointer transition-colors"
                  >
                    <option value={0} className="text-slate-800">All Time (YoY Trend)</option>
                    {getAvailableAcademicYears().map(year => (
                      <option key={year} value={year} className="text-slate-800">{formatAcademicYear(year)}</option>
                    ))}
                  </select>
                </div>

                {/* Grid KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6">
                  <div>
                    <div className="text-3xl font-black">{avgPct !== null ? `${avgPct.toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Avg Score</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black">{totalQs}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Questions Done</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black">{totalPoints}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Quiz Points</div>
                  </div>
                  <div>
                    <div className="text-xl font-black leading-tight line-clamp-2 break-words">{topicAverages.length > 0 ? topicAverages[0].topic : '—'}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Top Topic</div>
                  </div>
                  <div>
                    <div className="text-xl font-black leading-tight line-clamp-2">{nextBadge ? nextBadge.name : 'All Maxed!'}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">{nextBadge ? `${nextBadge.remaining} Qs away` : 'Next Badge'}</div>
                  </div>
                  <div>
                    <div className="text-xl font-black leading-tight">{blocksCompleted}</div>
                    <div className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Blocks Done</div>
                  </div>
                </div>

                {/* QOTD INTEGRATION */}
                {qotdStats && (qotdStats.correct > 0 || qotdStats.incorrect > 0) && (
                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <h3 className="font-bold text-[10px] text-indigo-200 uppercase tracking-widest mb-2">QOTD Performance</h3>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-emerald-300">{qotdStats.correct} Correct</span>
                      <span className="text-red-300">{qotdStats.incorrect} Incorrect</span>
                    </div>
                    <div className="h-2 bg-red-500/50 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-400 transition-all" 
                        style={{ width: `${(qotdStats.correct / (qotdStats.correct + qotdStats.incorrect)) * 100}%` }} 
                      />
                    </div>
                    <p className="text-[10px] text-indigo-200 mt-1.5 text-center uppercase tracking-widest font-bold">
                      {qotdStats.correct + qotdStats.incorrect} Total Attempts
                    </p>
                  </div>
                )}

                {/* BADGES INTEGRATION */}
                {userBadges.length > 0 && (
                  <div>
                    <h3 className="font-bold text-[10px] text-indigo-200 uppercase tracking-widest mb-3">Earned Badges</h3>
                    <div className="flex flex-wrap gap-2">
                      {userBadges.map((b, i) => (
                        <div key={i} className="relative group">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-indigo-500/30 text-white border-indigo-400/30 cursor-help transition-transform hover:scale-105">
                            <span>{b.icon}</span>
                            <span>{b.name}</span>
                          </span>
                          {b.description && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                              {b.description}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Block Performance */}
              {topicAverages.length > 0 && (
                <div>
                  <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Block Performance</h3>
                  <div className="space-y-2">
                    {topicAverages.map(({ topic, avg, attempts, qs }) => (
                      <div key={topic} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-800 truncate">{topic}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{attempts} attempt{attempts !== 1 ? 's' : ''} · {qs} Qs</p>
                        </div>
                        <div className="w-32 shrink-0">
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${avg >= 70 ? 'bg-emerald-500' : avg >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.max(0, Math.min(100, avg))}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-xs font-black shrink-0 w-12 text-right ${avg >= 70 ? 'text-emerald-700' : avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {avg.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {/* History */}
              <div>
                <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Assessment History</h3>
                {myResults.length > 0 ? (
                  <div className="space-y-2">
                    {myResults.map((r, i) => {
                      const pts = r.academic_points || 0;
                      const timingEmoji = pts >= 2 && !r.topic?.toLowerCase().includes('bonus') ? '✅'
                        : pts === 1 ? '⏰'
                        : pts >= 2 ? '⚡'
                        : null;
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800 truncate">{r.topic}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                              {timingEmoji && <span className="ml-2">{timingEmoji}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-black px-2 py-1 rounded-full ${(r.percentage || 0) >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {(r.percentage || 0).toFixed(1)}%
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{pts}pt</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-slate-400 text-sm italic">No assessments completed yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pastQuizzes' && (
            <div className="animate-fade-in">
              {selectedQuiz ? (
                <div className="space-y-4">
                  <button
                    onClick={() => { setSelectedQuiz(null); setReviewItems(null); }}
                    className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    <ChevronLeft className="w-4 h-4" /> All quizzes
                  </button>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-800">{selectedQuiz.topic}</h3>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        {selectedQuiz.created_at ? new Date(selectedQuiz.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                        {selectedQuiz.percentage != null ? ` · ${Number(selectedQuiz.percentage).toFixed(1)}%` : ''}
                      </p>
                    </div>
                    {reviewItems && reviewItems.length > 0 && (
                      <button
                        onClick={() => setShowAllReview(!showAllReview)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm"
                      >
                        {showAllReview ? 'Show Incorrect Only' : 'Show All Questions'}
                      </button>
                    )}
                  </div>
                  {loadingReview ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                  ) : reviewItems && reviewItems.length > 0 ? (
                    <QuizReview items={showAllReview ? reviewItems : reviewItems.filter((i: any) => i.selected !== i.question?.correct_index)} />
                  ) : (
                    <p className="text-center text-slate-400 text-sm italic py-10">
                      A reviewable copy of this quiz wasn't saved — it was taken before review was added.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {pastQuizzes.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm italic py-10">No completed quizzes yet.</p>
                  ) : pastQuizzes.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => openReview(r)}
                      className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{r.topic}</p>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          {r.percentage != null ? ` · ${Number(r.percentage).toFixed(1)}%` : ''}
                          {(!Array.isArray(r.review_data) || r.review_data.length === 0) ? ' · review unavailable' : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'weakAreas' && (
            <div className="space-y-6 animate-fade-in h-full flex flex-col">
              {loadingWeakAreas ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                  <p className="font-bold text-sm tracking-widest uppercase">Loading Weak Areas...</p>
                </div>
              ) : missedQuestions.length === 0 ? (
                <div className="bg-slate-50 rounded-3xl p-12 text-center border border-slate-100">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">All Caught Up!</h3>
                  <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">
                    You have no pending missed questions to review. Keep up the great work!
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-6">
                  {/* Category Grid or Question Viewer */}
                  {!selectedTopic ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Select a Category to Review</h3>
                        <button 
                          onClick={handleExportAnki}
                          disabled={exportingAnki}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-indigo-200 shadow-sm disabled:opacity-50"
                        >
                          {exportingAnki ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Export Anki Deck (CSV)
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.from(new Set(missedQuestions.map(q => q.category).filter(Boolean))).map((cat) => {
                          const count = missedQuestions.filter(q => q.category === cat).length;
                          return (
                            <button 
                              key={cat} 
                              onClick={() => setSelectedTopic(cat)}
                              className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 hover:border-blue-300 hover:shadow-lg transition-all group w-full"
                            >
                              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center font-black text-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                {count}
                              </div>
                              <div className="font-bold text-slate-700 text-sm text-center">{cat}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col space-y-6">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setSelectedTopic(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:shadow-sm flex items-center gap-2 transition-all">
                          <ChevronLeft className="w-4 h-4" /> Back to Categories
                        </button>
                        <h3 className="font-bold text-[10px] text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{selectedTopic} ({displayedMissedQuestions.length} Missed)</h3>
                      </div>
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 relative overflow-hidden flex-1">
                    {(() => {
                      const q = displayedMissedQuestions[currentIndex];
                      if (!q) return null;
                      return (
                        <>
                          {latestStatus.get(q.id) ? (
                            <div className="absolute top-0 right-0 left-0 p-3 bg-emerald-500 text-white font-black text-[10px] text-center uppercase tracking-widest shadow-md">
                              ✓ Review Completed: You recently answered this correctly!
                            </div>
                          ) : (
                            <div className="absolute top-0 right-0 p-3 bg-rose-50 text-rose-600 font-black text-[10px] rounded-bl-3xl border-l border-b border-rose-100 uppercase tracking-widest">
                              Review Mode
                            </div>
                          )}

                          <div className={`flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest ${latestStatus.get(q.id) ? 'mt-8' : ''}`}>
                            <span>Question {currentIndex + 1} of {displayedMissedQuestions.length}</span>
                            <span className="opacity-30">·</span>
                            <span>{q.category}</span>
                            {q.year && <span className="text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">ITE {q.year}</span>}
                          </div>

                          <p className="text-slate-800 font-bold text-sm leading-relaxed">{q.question_text}</p>
                          
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                            {(q.options as string[]).map((opt, idx) => (
                              <div
                                key={idx}
                                className={`px-4 py-2.5 rounded-xl text-xs font-medium border-2 flex items-center gap-3 ${idx === q.correct_index ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-100 bg-slate-50 text-slate-400 opacity-50'}`}
                              >
                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${idx === q.correct_index ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  {String.fromCharCode(65 + idx)}
                                </div>
                                {opt}
                              </div>
                            ))}
                          </div>

                          {q.explanation && (
                            <div className="mt-6 bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                  <ExternalLink className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <h3 className="font-black text-sm">Explanation</h3>
                                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Logic & Evidence</p>
                                </div>
                              </div>
                              <div className="space-y-3 text-slate-300 text-xs leading-relaxed font-medium">
                                <div dangerouslySetInnerHTML={{ __html: q.explanation }} />
                              </div>
                              <div className="mt-6 flex flex-wrap gap-3">
                                <a href="https://www.openevidence.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-blue-400 text-xs font-bold transition-all border border-blue-500/20">
                                  <ExternalLink className="w-3 h-3" />
                                  Open Evidence
                                </a>
                                <a href="https://gemini.google.com/gem/1Ep-wVXG0cSLhxna_SIbpMSANVs5xCm7X" target="_blank" rel="noopener noreferrer" title="Ensure you are logged into your Ascension SSO / work Google account" className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-purple-300 text-xs font-bold transition-all border border-purple-500/20">
                                  <ExternalLink className="w-3 h-3" />
                                  Board Prep Gem
                                </a>
                                <a href="https://drive.google.com/drive/folders/1VSS2ZBtY486BUpZZKxrITrCOimd6b7Dp?usp=drive_link" target="_blank" rel="noopener noreferrer" onClick={() => window.alert('To access this material, please ensure you are logged into your Ascension SSO / work Google account.')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-xs font-bold transition-all border border-white/10">
                                  <ExternalLink className="w-3 h-3" />
                                  Review Topic Material
                                </a>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="flex-1 py-3 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentIndex === displayedMissedQuestions.length - 1}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
