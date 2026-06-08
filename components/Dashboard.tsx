'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName, withTimeout } from '@/lib/utils';
import { canAccessAdmin } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';
import {
  LogOut, Lock, Trophy, FileText, CheckCircle, ChevronRight,
  PlayCircle, Sparkles, X, Settings, Target, Save, Target as TargetIcon, MessageSquare, Loader2, AbfmShield, Info
} from './AppIcons';
import ProfileSettings from './ProfileSettings';
import MyStatsModal from './MyStatsModal';
import AchievementsModal from './AchievementsModal';
import { getQotdQuestion, isPastNoon, getTodayDateString } from '@/lib/qotd';
import { User, Profile, Block, Result, Question } from '@/lib/types';
import { useDashboardData } from '@/hooks/useDashboardData';

interface DashboardProps {
  user: User;
  profile: Profile;
  isActive?: boolean;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onStartQuiz: (quiz: any) => void;
  onOpenBuilder: () => void;
  onProfileUpdate: (updatedProfile: any) => void;
}

export interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
}

export default function Dashboard({ user, profile, isActive = true, onOpenAdmin, onLogout, onStartQuiz, onOpenBuilder, onProfileUpdate }: DashboardProps) {
  // Use centralized role helper (3-tier: resident / faculty / admin)
  const isSuperAdmin = canAccessAdmin(user, profile);

  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());
  
  const { data, loading, error, refetch } = useDashboardData(user.id, user.email, selectedYear);
  const fetchError = error ? error.message : null;

  const blocks = data?.blocks || [];
  const myResults = data?.myResults || [];
  const activeSession = data?.activeSession || null;
  const leaderboard = data?.leaderboard || [];
  const hasTakenDemo = data?.hasTakenDemo || false;
  const qotdQuestion = data?.qotdQuestion || null;
  const qotdAttempt = data?.qotdAttempt || null;
  const userStreak = data?.userStreak || null;
  const userBadges = data?.userBadges || [];

  // UI state
  const [showMyStats, setShowMyStats] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Per-user block sort preference (each resident sorts their own list; saved locally)
  const [blockSort, setBlockSort] = useState<'curriculum' | 'name' | 'status'>('curriculum');
  useEffect(() => {
    try {
      const s = localStorage.getItem('fmc_resident_block_sort');
      if (s === 'name' || s === 'status') setBlockSort(s);
    } catch {}
  }, []);
  const changeBlockSort = (m: 'curriculum' | 'name' | 'status') => {
    setBlockSort(m);
    try { localStorage.setItem('fmc_resident_block_sort', m); } catch {}
  };

  // Smart background refetching
  useEffect(() => {
    if (isActive) {
      refetch();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, refetch]);

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
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start gap-2 relative">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex-1 min-w-0 pr-2 flex items-center gap-3">
          <AbfmShield className="w-10 h-10 text-blue-600 hidden sm:block shrink-0" />
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight truncate">FMC Board Review App</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
            <p className="text-slate-500 font-bold text-[10px] md:text-xs tracking-wide uppercase opacity-60 truncate">
              Ascension St. Vincent's FM Residency · {formatDisplayName(profile?.full_name) !== 'Unknown' ? formatDisplayName(profile?.full_name) : user.email}
            </p>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 self-start sm:self-auto"
            >
              <option value={0}>All Time (YoY Trend)</option>
              {getAvailableAcademicYears().map(year => (
                <option key={year} value={year}>{formatAcademicYear(year)}</option>
              ))}
            </select>
          </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 relative z-20 shrink-0">
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
          <a
            href="mailto:jonathan.carbungco@ascension.org?subject=Feedback:%20FMC%20Board%20Review%20App"
            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Send Feedback"
          >
            <MessageSquare className="w-5 h-5" />
          </a>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors" title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Onboarding Banner for New Users */}
      {!hasTakenDemo && !activeSession && !loading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden animate-fade-in">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-blue-100 rounded-xl shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-blue-900 mb-0.5">
                Welcome to the FMC QBank!
              </h3>
              <p className="text-blue-700 text-sm font-medium pr-2">
                We recommend taking the Demo Quiz first to get familiar with the interface, tools, and question formats. It's only 3 questions and won't affect your stats.
              </p>
            </div>
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
            className="shrink-0 whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 text-sm"
          >
            Take Demo Quiz <ChevronRight className="w-4 h-4" />
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
                       {isPastNoon() ? 'Results and stats are now available!' : 'Answer recorded. Come back at 12:30 PM for results!'}
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

          {/* Achievements */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Achievements</h3>
                <button
                  onClick={() => setShowAchievements(true)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" /> View all
                </button>
              </div>
              
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

              {!(userStreak?.current_qotd_streak > 0) && !(userStreak?.current_block_streak > 0) && userBadges.length === 0 && (
                <button
                  onClick={() => setShowAchievements(true)}
                  className="w-full text-left text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors"
                >
                  No badges yet — tap &ldquo;View all&rdquo; to see what you can earn.
                </button>
              )}
            </div>

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

          {/* Resume Saved Block */}
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
                <p className="font-bold">Resume Saved Block</p>
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

          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Board Review Blocks</h3>
            {blocks.length > 1 && (
              <select
                value={blockSort}
                onChange={e => changeBlockSort(e.target.value as 'curriculum' | 'name' | 'status')}
                className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                title="Sort blocks"
              >
                <option value="curriculum">Curriculum order</option>
                <option value="name">Name (A–Z)</option>
                <option value="status">Unfinished first</option>
              </select>
            )}
          </div>

          {fetchError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-4">
              <p className="text-sm font-bold text-red-600 mb-1">Network Error</p>
              <p className="text-xs text-red-500">{fetchError}</p>
              <button onClick={() => window.location.reload()} className="mt-2 text-xs font-bold text-red-600 hover:underline">Retry</button>
            </div>
          ) : loading && blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Syncing Dashboard...</p>
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-sm italic">No blocks available.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {[...blocks].sort((a, b) => {
                if (blockSort === 'name') return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
                if (blockSort === 'status') {
                  const rA = bestResultByTopic.get(a.title); const rB = bestResultByTopic.get(b.title);
                  const doneA = !!rA && (rA.academic_points || 0) > 0;
                  const doneB = !!rB && (rB.academic_points || 0) > 0;
                  return Number(doneA) - Number(doneB);
                }
                return 0; // 'curriculum' — keep server order (by sort_order)
              }).map(block => {
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

      {showAchievements && (
        <AchievementsModal
          userBadges={userBadges}
          onClose={() => setShowAchievements(false)}
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

