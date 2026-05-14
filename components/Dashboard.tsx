'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName } from '@/lib/utils';
import { canAccessAdmin } from '@/lib/roles';
import {
  LogOut, Lock, Trophy, FileText, CheckCircle, ChevronRight,
  PlayCircle, Sparkles, X, Settings,
} from './AppIcons';
import ProfileSettings from './ProfileSettings';

interface DashboardProps {
  user: any;
  profile: any;
  currentBlock?: any;
  onLogout: () => void;
  onStartQuiz: (quiz: any) => void;
  onOpenBuilder: () => void;
  onOpenAdmin: () => void;
}

function getBlockSortKey(block: any): number {
  // Prefer explicit sort_order from DB, fall back to title parsing
  if (block.sort_order != null) return block.sort_order;
  const t = block.title || '';
  if (/^demo/i.test(t)) return 9999;
  const m = t.match(/Block\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  if (/bonus/i.test(t)) return 500;
  return 1000;
}

interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
}

export default function Dashboard({ user, profile, onLogout, onStartQuiz, onOpenBuilder, onOpenAdmin }: DashboardProps) {
  // Use centralized role helper (3-tier: resident / faculty / admin)
  const isSuperAdmin = canAccessAdmin(user, profile);

  const [loading, setLoading] = useState(true);

  // Data
  const [blocks, setBlocks] = useState<any[]>([]);
  const [myResults, setMyResults] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // UI state
  const [showMyStats, setShowMyStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [
          { data: blockData },
          { data: resultsData },
          { data: sessionData },
          { data: allResults },
          { data: rosterData },
        ] = await Promise.all([
          supabase.from('blocks').select('*'),
          supabase
            .from('results')
            .select('*')
            .or(`user_id.eq.${user.id},legacy_email.eq.${user.email}`)
            .order('created_at', { ascending: false }),
          supabase
            .from('quiz_sessions')
            .select('id, topic, quiz_id, current_index, answers, last_updated')
            .eq('user_id', user.id)
            .eq('is_completed', false)
            .order('last_updated', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('results').select('legacy_email, topic, total, academic_points'),
          supabase.from('authorized_roster').select('name, email, pgy').neq('pgy', 'Faculty'),
        ]);

        if (blockData) {
          const sorted = [...blockData].sort((a, b) => getBlockSortKey(a) - getBlockSortKey(b));
          setBlocks(sorted);
        }
        if (resultsData) setMyResults(resultsData);
        if (sessionData) setActiveSession(sessionData);

        // Build leaderboard
        if (allResults && rosterData) {
          const rosterByEmail = new Map<string, { name: string; pgy: string }>();
          rosterData.forEach((r: any) => {
            if (r.email) rosterByEmail.set(r.email.toLowerCase(), { name: r.name, pgy: r.pgy });
          });

          // Group results by email, dedupe by topic (best points per topic)
          const byEmail = new Map<string, { topicBest: Map<string, number>; qs: number }>();
          allResults.forEach((r: any) => {
            const email = r.legacy_email?.toLowerCase();
            if (!email) return;
            if (!byEmail.has(email)) byEmail.set(email, { topicBest: new Map(), qs: 0 });
            const entry = byEmail.get(email)!;
            const cur = entry.topicBest.get(r.topic) || 0;
            entry.topicBest.set(r.topic, Math.max(cur, r.academic_points || 0));
            entry.qs += r.total || 0;
          });

          const lb: LeaderboardEntry[] = [];
          rosterByEmail.forEach(({ name, pgy }, email) => {
            const entry = byEmail.get(email);
            const totalPoints = entry ? Array.from(entry.topicBest.values()).reduce((a, b) => a + b, 0) : 0;
            const totalQs = entry?.qs || 0;
            lb.push({ email, name, pgy, totalPoints, totalQs });
          });
          lb.sort((a, b) => b.totalPoints - a.totalPoints);
          setLeaderboard(lb);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user.id, user.email]);

  // Best result per topic
  const bestResultByTopic = new Map<string, any>();
  myResults.forEach(r => {
    const existing = bestResultByTopic.get(r.topic);
    if (!existing || (r.percentage || 0) > (existing.percentage || 0)) {
      bestResultByTopic.set(r.topic, r);
    }
  });

  // Best points per topic (dedupe retakes)
  const topicBestPts = new Map<string, number>();
  myResults
    .filter(r => (r.academic_points || 0) > 0)
    .forEach(r => {
      const cur = topicBestPts.get(r.topic) || 0;
      topicBestPts.set(r.topic, Math.max(cur, r.academic_points || 0));
    });

  const blocksCompleted = topicBestPts.size;
  const totalPoints = Array.from(topicBestPts.values()).reduce((a, b) => a + b, 0);
  const avgPct = myResults.length > 0
    ? myResults.reduce((a, r) => a + (r.percentage || 0), 0) / myResults.length
    : null;

  // === RESIDENT TOPIC-SELECT VIEW ===
  const renderTopicSelect = () => (
    <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start relative">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">FMC Board Review App</h2>
          <p className="text-slate-500 font-bold text-xs tracking-wide mt-1 uppercase opacity-60">
            Ascension St. Vincent's FM Residency · {formatDisplayName(profile?.full_name) !== 'Unknown' ? formatDisplayName(profile?.full_name) : user.email}
          </p>
        </div>
        <div className="flex items-center gap-2 relative z-20">
          {isSuperAdmin && (
            <button
              onClick={onOpenAdmin}
              className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Admin Console"
            >
              <Lock className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Profile Settings">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors" title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Onboarding Banner for New Users */}
      {myResults.length === 0 && !activeSession && !loading && (
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex-1">
            <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-300" />
              Welcome to the FMC QBank!
            </h3>
            <p className="text-blue-100 font-medium max-w-xl">
              We recommend taking the Demo Quiz first to get familiar with the interface, tools, and question formats. It's only 3 questions and won't affect your stats.
            </p>
          </div>
          <button
            onClick={() => {
              const demoBlock = blocks.find(b => b.block_type === 'demo' || b.title === 'Demo Quiz');
              if (demoBlock) {
                onStartQuiz({ topic: demoBlock.title, quizId: demoBlock.id, count: 3 });
              } else {
                onStartQuiz({ topic: 'Demo Quiz', count: 3 });
              }
            }}
            className="relative z-10 whitespace-nowrap bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-xl font-black shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            Take Demo Quiz
          </button>
        </div>
      )}

      {/* Two-column body */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* LEFT SIDEBAR */}
        <div className="md:w-80 flex flex-col gap-4 shrink-0">
          {/* My Performance — yellow gradient */}
          <button
            onClick={() => setShowMyStats(true)}
            className="w-full flex items-center gap-4 p-5 bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 text-yellow-800 rounded-3xl shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group"
          >
            <div className="p-3 bg-white/60 rounded-2xl group-hover:scale-110 transition-transform">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base">My Performance</p>
              <p className="text-xs text-yellow-600">Stats, badges &amp; history</p>
            </div>
          </button>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <LeaderboardWidget data={leaderboard} myEmail={user.email} />
          )}

          {/* Resume Saved Review */}
          {activeSession && (
            <button
              onClick={() => {
                const matchedBlock = blocks.find(b => b.title === activeSession.topic || b.id === activeSession.quiz_id);
                onStartQuiz({
                  topic: activeSession.topic,
                  quizId: activeSession.quiz_id || matchedBlock?.id,
                  count: 40,
                });
              }}
              className="w-full p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-3"
            >
              <PlayCircle className="w-6 h-6 shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold">Resume Saved Review</p>
                <p className="text-xs text-amber-600 opacity-80 truncate">
                  {activeSession.topic} · Q{(activeSession.current_index || 0) + 1}
                </p>
              </div>
            </button>
          )}

          {/* QOTD placeholder — wired up in Step 6 */}
        </div>

        {/* RIGHT MAIN */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Quiz Builder — indigo gradient */}
          <button
            onClick={onOpenBuilder}
            className="w-full mb-6 flex items-center justify-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700 border border-indigo-200 rounded-3xl shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group"
          >
            <div className="p-3 bg-white/60 rounded-2xl group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="text-left">
              <p className="font-bold text-lg">Quiz Builder</p>
              <p className="text-xs text-indigo-500/80">Custom filters or quick mixed review</p>
            </div>
          </button>

          <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-3">Board Review Blocks</h3>

          {loading ? (
            <p className="text-center py-6 text-slate-400 text-sm italic">Loading Fixed Blocks...</p>
          ) : blocks.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-sm italic">No blocks available.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {blocks.map(block => {
                const result = bestResultByTopic.get(block.title);
                const isCompleted = !!result && (result.academic_points || 0) > 0;
                const hasResume = activeSession && activeSession.topic === block.title;

                // Sprint 5: prefer the fixed assigned question set so every resident sees the
                // same questions (order is still randomized client-side in QuizEngine).
                // Falls back to category filters for legacy/uninitialized blocks.
                const hasFixedSet = block.question_ids && block.question_ids.length > 0;
                const displayCount = hasFixedSet
                  ? block.question_ids.length
                  : (block.question_count || 40);
                return (
                  <div
                    key={block.id}
                    onClick={() => onStartQuiz({
                      topic: block.title,
                      quizId: block.id,
                      questionIds: hasFixedSet ? block.question_ids : undefined,
                      categories: !hasFixedSet && block.category_filters && block.category_filters.length > 0 ? block.category_filters : undefined,
                      keywords: !hasFixedSet && block.keyword_filters && block.keyword_filters.length > 0 ? block.keyword_filters : undefined,
                      count: displayCount,
                    })}
                    className="shrink-0 p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group relative overflow-hidden ring-1 ring-slate-200/50 hover:ring-blue-400"
                  >
                    {hasResume && !isCompleted && (
                      <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-bl-xl border-l border-b border-amber-200">
                        Q{(activeSession.current_index || 0) + 1}
                      </div>
                    )}
                    <div className="flex gap-3 items-center min-w-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-base text-slate-800 truncate flex items-center gap-2">
                          {block.title}
                          {isCompleted && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200 uppercase tracking-wider shrink-0">
                              Done
                            </span>
                          )}
                          {!isCompleted && hasResume && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider shrink-0">
                              Resume
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 font-medium">
                          {result ? `Best: ${(result.percentage || 0).toFixed(1)}%` : `${displayCount} Questions`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {renderTopicSelect()}

      {/* MY STATS MODAL */}
      {showMyStats && (
        <MyStatsModal
          onClose={() => setShowMyStats(false)}
          profile={profile}
          userEmail={user.email}
          avgPct={avgPct}
          blocksCompleted={blocksCompleted}
          totalPoints={totalPoints}
          myResults={myResults}
          leaderboard={leaderboard}
        />
      )}

      {showSettings && (
        <ProfileSettings
          user={user}
          profile={profile}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={(updated) => {
            // Propagate the updated profile back so the UI refreshes
            setShowSettings(false);
            window.location.reload();
          }}
        />
      )}

    </div>
  );
}

// === LEADERBOARD WIDGET ===
function LeaderboardWidget({ data, myEmail }: { data: LeaderboardEntry[]; myEmail: string }) {
  const top = data.slice(0, 5);
  const myEntry = data.find(d => d.email.toLowerCase() === myEmail.toLowerCase());
  const myRank = myEntry ? data.findIndex(d => d.email === myEntry.email) + 1 : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Leaderboard</h3>
        {myRank && <span className="text-[10px] font-bold text-blue-600">You: #{myRank}</span>}
      </div>
      <div className="space-y-1">
        {top.map((r, i) => {
          const isMe = r.email.toLowerCase() === myEmail.toLowerCase();
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div
              key={r.email}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${isMe ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-400 w-5 shrink-0">
                  {medal || `#${i + 1}`}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${isMe ? 'text-blue-700' : 'text-slate-700'}`}>
                    {formatDisplayName(r.name)}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {r.pgy.replace('Class of ', "'")}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-black shrink-0 ml-2 ${isMe ? 'text-blue-700' : 'text-slate-600'}`}>
                {r.totalPoints} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === MY STATS MODAL ===
function MyStatsModal({
  onClose,
  profile,
  userEmail,
  avgPct,
  blocksCompleted,
  totalPoints,
  myResults,
  leaderboard,
}: {
  onClose: () => void;
  profile: any;
  userEmail: string;
  avgPct: number | null;
  blocksCompleted: number;
  totalPoints: number;
  myResults: any[];
  leaderboard: LeaderboardEntry[];
}) {
  const totalQs = myResults.reduce((a, r) => a + (r.total || 0), 0);
  const hasPerfect = myResults.some(r => (r.percentage || 0) >= 99.99);
  const assignedCount = myResults.filter(r => (r.academic_points || 0) > 0).length;
  const myRankIdx = leaderboard.findIndex(l => l.email.toLowerCase() === userEmail.toLowerCase());
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // Class leader: #1 within same PGY class
  const classmates = profile?.pgy ? leaderboard.filter(l => l.pgy === profile.pgy) : [];
  const classLeader = classmates.length > 0 ? classmates[0] : null;
  const isClassLeader = classLeader?.email.toLowerCase() === userEmail.toLowerCase();

  // Badges (computed from existing data — no QOTD or block schedule yet)
  const badges: { label: string; emoji: string; color: string }[] = [];
  if (assignedCount > 0) badges.push({ label: 'First Steps', emoji: '🎯', color: 'bg-blue-50 text-blue-700 border-blue-200' });
  if (totalQs >= 200) badges.push({ label: 'Scholar IV', emoji: '📚', color: 'bg-purple-50 text-purple-700 border-purple-200' });
  else if (totalQs >= 120) badges.push({ label: 'Scholar III', emoji: '📖', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' });
  else if (totalQs >= 80) badges.push({ label: 'Scholar II', emoji: '📔', color: 'bg-blue-50 text-blue-700 border-blue-200' });
  else if (totalQs >= 40) badges.push({ label: 'Scholar I', emoji: '📕', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' });
  if (hasPerfect) badges.push({ label: 'Perfect Block', emoji: '✨', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  if (myRank !== null && myRank >= 1 && myRank <= 3) badges.push({ label: `Top ${myRank}`, emoji: '🏆', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' });
  if (isClassLeader && classmates.length > 1) badges.push({ label: 'Class Leader', emoji: '👑', color: 'bg-rose-50 text-rose-700 border-rose-200' });

  // Topic / subject breakdown (group by topic, compute avg)
  const topicStats = new Map<string, { sum: number; count: number; qs: number }>();
  myResults.forEach(r => {
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
                {profile?.pgy || '—'}{profile?.advisor ? ` · Advisor: ${profile.advisor}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl shrink-0">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-slate-50 rounded-2xl">
              <div className="text-xl font-black text-slate-800">{avgPct !== null ? `${avgPct.toFixed(1)}%` : '—'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avg Score</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-2xl">
              <div className="text-xl font-black text-slate-800">{totalQs}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Questions Done</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-2xl">
              <div className="text-xl font-black text-slate-800">{blocksCompleted}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Blocks Done</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-2xl">
              <div className="text-xl font-black text-slate-800">{totalPoints}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Quiz Points</div>
            </div>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div>
              <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Badges &amp; Milestones</h3>
              <div className="flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${b.color}`}>
                    <span>{b.emoji}</span>
                    <span>{b.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subject Breakdown */}
          {topicAverages.length > 0 && (
            <div>
              <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Subject Breakdown</h3>
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
      </div>
    </div>
  );
}
