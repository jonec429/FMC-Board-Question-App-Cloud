'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName, withTimeout } from '@/lib/utils';
import { canAccessAdmin } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';
import {
  LogOut, Lock, Trophy, FileText, CheckCircle, ChevronRight,
  PlayCircle, Sparkles, X, Settings, Target, Save, Target as TargetIcon,
} from './AppIcons';
import ProfileSettings from './ProfileSettings';
import MyStatsModal from './MyStatsModal';
import { getQotdQuestion, isPastNoon, getTodayDateString } from '@/lib/qotd';
import { User, Profile, Block, Result, Question } from '@/lib/types';

interface DashboardProps {
  user: User;
  profile: Profile;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onStartQuiz: (quiz: any) => void;
  onOpenBuilder: () => void;
  onProfileUpdate: (updatedProfile: any) => void;
}

function getBlockSortKey(block: Block | any): number {
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

export default function Dashboard({ 
  user, profile, onOpenAdmin, onLogout, onProfileUpdate, onStartQuiz, onOpenBuilder
}: DashboardProps) {
  // Use centralized role helper (3-tier: resident / faculty / admin)
  const isSuperAdmin = canAccessAdmin(user, profile);

  const [loading, setLoading] = useState(true);

  // Data
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [myResults, setMyResults] = useState<Result[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [qotdQuestion, setQotdQuestion] = useState<Question | null>(null);
  const [qotdAttempt, setQotdAttempt] = useState<Result | null>(null);
  const [userStreak, setUserStreak] = useState<any>(null);
  const [userBadges, setUserBadges] = useState<any[]>([]);

  // UI state
  const [showMyStats, setShowMyStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const fetchTasks = [
          selectedYear === 0 
            ? supabase.from('blocks').select('*').eq('is_archived', false)
            : supabase.from('blocks').select('*').eq('is_archived', false).eq('academic_year', selectedYear),
          selectedYear === 0
            ? supabase
                .from('results')
                .select('*')
                .or(`user_id.eq.${user.id},legacy_email.eq.${user.email}`)
                .order('created_at', { ascending: false })
            : supabase
                .from('results')
                .select('*')
                .eq('academic_year', selectedYear)
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
          selectedYear === 0
            ? supabase.from('results').select('legacy_email, topic, total, academic_points')
            : supabase.from('results').select('legacy_email, topic, total, academic_points').eq('academic_year', selectedYear),
          supabase.from('authorized_roster').select('name, email, pgy').neq('pgy', 'Faculty'),
          supabase.from('user_streaks').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_badges').select('earned_at, badges(*)').eq('user_id', user.id)
        ];

        let qotd = null;
        try {
          qotd = await getQotdQuestion();
        } catch (e) {
          console.warn('Dashboard QOTD fetch timed out or failed:', e);
        }
        let attemptPromise: PromiseLike<any> = Promise.resolve({ data: null });
        if (qotd) {
          attemptPromise = supabase
            .from('question_attempts')
            .select('*')
            .eq('user_id', user.id)
            .eq('question_id', qotd.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        }

        const resultArgs = await withTimeout(Promise.all([...fetchTasks, attemptPromise] as any[])) as any[];
        const [
          { data: blockData },
          { data: resultsData },
          { data: sessionData },
          { data: allResults },
          { data: rosterData },
          { data: streakData },
          { data: badgesData },
          { data: qotdAttemptData },
        ] = resultArgs;

        if (qotd) setQotdQuestion(qotd);
        if (qotdAttemptData) setQotdAttempt(qotdAttemptData);
        if (streakData) setUserStreak(streakData);
        if (badgesData) setUserBadges(badgesData.map((b: any) => ({ ...b.badges, earned_at: b.earned_at })));

        if (blockData) {
          const sorted = [...blockData].sort((a, b) => getBlockSortKey(a) - getBlockSortKey(b));
          setBlocks(sorted);
        }
        if (resultsData) setMyResults(resultsData.filter((r: any) => !r.topic?.toLowerCase().includes('demo')));
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
            if (r.topic?.toLowerCase().includes('demo')) return;
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
  }, [user.id, user.email, selectedYear]);

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
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 font-bold text-xs tracking-wide uppercase opacity-60">
              Ascension St. Vincent's FM Residency · {formatDisplayName(profile?.full_name) !== 'Unknown' ? formatDisplayName(profile?.full_name) : user.email}
            </p>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={0}>All Time (YoY Trend)</option>
              {getAvailableAcademicYears().map(year => (
                <option key={year} value={year}>{formatAcademicYear(year)}</option>
              ))}
            </select>
          </div>
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
          
          {/* QOTD Card */}
          {qotdQuestion && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden animate-fade-in">
               <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
               <div className="relative z-10">
                 <h3 className="font-black text-lg flex items-center gap-2 mb-2">
                   <Sparkles className="w-5 h-5 text-yellow-300" />
                   Question of the Day
                 </h3>
                 {qotdAttempt ? (
                   <div>
                     <p className="text-indigo-100 text-sm mb-5 leading-relaxed font-medium">
                       {isPastNoon() ? 'Results and stats are now available!' : 'Answer recorded. Come back at 12 PM for results!'}
                     </p>
                     <button
                       onClick={() => onStartQuiz({ isQotd: true, qotdQuestion, topic: 'Question of the Day', isQotdCompleted: true, qotdAttempt })}
                       className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all text-sm backdrop-blur-sm border border-white/20"
                     >
                       {isPastNoon() ? 'View Results & Stats' : 'Review Selection'}
                     </button>
                   </div>
                 ) : (
                   <div>
                     <p className="text-indigo-100 text-sm mb-5 leading-relaxed font-medium">A new high-yield question is ready for you.</p>
                     <button
                       onClick={() => onStartQuiz({ isQotd: true, qotdQuestion, topic: 'Question of the Day', count: 1 })}
                       className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2"
                     >
                       Take QOTD <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>
                 )}
               </div>
            </div>
           )}

          {/* Streaks & Badges */}
          {((userStreak?.current_qotd_streak > 0) || (userStreak?.current_block_streak > 0) || (userBadges.length > 0)) && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm animate-fade-in">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Achievements</h3>
              
              {userStreak?.current_qotd_streak > 0 && (
                <div 
                  className="flex items-center gap-3 mb-4 p-3 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 cursor-help transition-all hover:bg-orange-100"
                  title={`You've answered the Question of the Day for ${userStreak.current_qotd_streak} consecutive weekdays!`}
                >
                  <div className="text-2xl animate-pulse">🔥</div>
                  <div>
                    <div className="font-black text-lg">{userStreak.current_qotd_streak} Day Streak</div>
                    <div className="text-xs font-bold opacity-80">Question of the Day</div>
                  </div>
                </div>
              )}

              {userStreak?.current_block_streak > 0 && (
                <div 
                  className="flex items-center gap-3 mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 cursor-help transition-all hover:bg-blue-100"
                  title={`You've submitted ${userStreak.current_block_streak} consecutive practice blocks On Time!`}
                >
                  <div className="text-2xl animate-pulse">⚡</div>
                  <div>
                    <div className="font-black text-lg">{userStreak.current_block_streak} Block Streak</div>
                    <div className="text-xs font-bold opacity-80">On-Time Submissions</div>
                  </div>
                </div>
              )}

              {userBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {userBadges.map((badge, idx) => (
                    <div key={idx} title={badge.name + ' - ' + badge.description} className="flex items-center justify-center w-10 h-10 bg-slate-50 border border-slate-100 rounded-full text-xl cursor-help hover:bg-slate-100 transition-colors shadow-sm">
                      {badge.icon}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
          userId={user.id}
          avgPct={avgPct}
          blocksCompleted={blocksCompleted}
          totalPoints={totalPoints}
          myResults={myResults}
          leaderboard={leaderboard}
          userBadges={userBadges}
        />
      )}

      {showSettings && (
        <ProfileSettings
          user={user}
          profile={profile}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={(updated) => {
            setShowSettings(false);
            onProfileUpdate(updated);
          }}
        />
      )}

    </div>
  );
}

// === LEADERBOARD WIDGET ===
function LeaderboardWidget({ data, myEmail }: { data: LeaderboardEntry[]; myEmail: string }) {
  const top = data.slice(0, 5);
  const myEntry = data.find(d => d.email.toLowerCase() === myEmail?.toLowerCase());
  const myRank = myEntry ? data.findIndex(d => d.email === myEntry.email) + 1 : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Leaderboard</h3>
        {myRank && <span className="text-[10px] font-bold text-blue-600">You: #{myRank}</span>}
      </div>
      <div className="space-y-1">
        {top.map((r, i) => {
          const isMe = r.email.toLowerCase() === myEmail?.toLowerCase();
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

