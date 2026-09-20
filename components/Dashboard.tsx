'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDisplayName, withTimeout } from '@/lib/utils';
import { canAccessAdmin, getUserRole } from '@/lib/roles';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';
import {
  LogOut, Lock, Trophy, BookOpen, Gem, CheckCircle, ChevronRight,
  PlayCircle, Sparkles, X, Settings, Smartphone, Target, Save, Target as TargetIcon, MessageSquare, Loader2, AbfmShield, Info, Calendar, Users, Sun, Moon
} from './AppIcons';
import ProfileSettings from './ProfileSettings';
import MyStatsModal from './MyStatsModal';
import AchievementsModal from './AchievementsModal';
import InstallAppModal from './InstallAppModal';
import QotdHistoryModal from './QotdHistoryModal';
import ClassYoyModal from './ClassYoyModal';
import AdviseeQuickAccessCard from './AdviseeQuickAccessCard';
import { useTheme } from '@/context/ThemeContext';
import { getQotdQuestion, isPastNoon, getTodayDateString } from '@/lib/qotd';
import { User, Profile, Block, Result, Question, QuizSession, AssignedQuiz } from '@/lib/types';
import { useDashboardData } from '@/hooks/useDashboardData';

export interface StartQuizOptions {
  topic: string;
  quizId?: string;
  count?: number;
  timerEnabled?: boolean;
  forceNew?: boolean;
  questionIds?: string[];
  mode?: 'practice' | 'quiz';
  categories?: string[];
  keywords?: string[];
  years?: string[];
  pool?: 'all' | 'unused' | 'incorrect';
  isQotd?: boolean;
  qotdQuestion?: Question | null;
  isQotdCompleted?: boolean;
  qotdAttempt?: any;
}

interface DashboardProps {
  user: User;
  profile: Profile | null;
  isActive?: boolean;
  currentBlock?: Block | null;
  onOpenAdmin: (tabId?: string) => void;
  onLogout: () => void;
  onStartQuiz: (quiz: StartQuizOptions) => void;
  onOpenBuilder: () => void;
  onProfileUpdate: (updatedProfile: Profile) => void;
}

export interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
  yoyStats?: Record<number, number>;
}

export default function Dashboard({ user, profile, isActive = true, currentBlock, onOpenAdmin, onLogout, onStartQuiz, onOpenBuilder, onProfileUpdate }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  // Use centralized role helper (3-tier: resident / faculty / admin)
  const isSuperAdmin = canAccessAdmin(user, profile);
  const effectiveRole = getUserRole(user, profile);

  // Default to current academic year as requested, since cumulative APs are the primary goal
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());
  const [showAchievements, setShowAchievements] = useState(false);
  const [showInstallApp, setShowInstallApp] = useState(false);
  const [selectedYoyClass, setSelectedYoyClass] = useState<string | null>(null);
  const [recentBadges, setRecentBadges] = useState<any[]>([]);
  
  const { data, loading, error, refetch } = useDashboardData(user.id, user.email, selectedYear);
  const fetchError = error ? error.message : null;

  // Check for recently earned badges
  useEffect(() => {
    try {
      const recent = localStorage.getItem('recent_badges');
      if (recent) {
        const parsedBadges = JSON.parse(recent);
        if (parsedBadges && parsedBadges.length > 0) {
          setRecentBadges(parsedBadges);
          localStorage.removeItem('recent_badges');
          
          // Fire massive confetti
          import('canvas-confetti').then((confetti) => {
            const duration = 3000;
            const end = Date.now() + duration;

            (function frame() {
              confetti.default({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
              });
              confetti.default({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
              });

              if (Date.now() < end) {
                requestAnimationFrame(frame);
              }
            }());
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse recent badges', e);
    }
  }, []);

  const blocks = data?.blocks || [];
  const myResults = data?.myResults || [];
  const activeSessions = data?.activeSessions || [];
  const mostRecentSession = activeSessions.length > 0 ? activeSessions[0] : null;

  const getSessionForBlock = (topic: string) => activeSessions.find((s: QuizSession) => s.topic === topic);
  const leaderboard = data?.leaderboard || [];
  const hasTakenDemo = data?.hasTakenDemo || false;
  const qotdQuestion = data?.qotdQuestion || null;
  const qotdAttempt = data?.qotdAttempt || null;
  const userStreak = data?.userStreak || null;
  const userBadges = data?.userBadges || [];

  // UI state
  const [showMyStats, setShowMyStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQotdHistoryModal, setShowQotdHistoryModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(`fmc_demo_banner_dismissed_${user.id}`) === 'true' ||
        localStorage.getItem(`fmc_demo_completed_${user.id}`) === 'true'
      ) {
        setDemoBannerDismissed(true);
      }
    } catch {}
  }, [user.id]);

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

  // QOTD Stats (fetched if past noon)
  const [qotdStats, setQotdStats] = useState<{correct: number, incorrect: number, total: number} | null>(null);

  useEffect(() => {
    if (qotdQuestion && isPastNoon()) {
      supabase.rpc('get_qotd_cohort_stats', { p_question_ids: [qotdQuestion.id] })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const correct = Number(data[0].correct) || 0;
            const incorrect = Number(data[0].incorrect) || 0;
            setQotdStats({ correct, incorrect, total: correct + incorrect });
          }
        });
    }
  }, [qotdQuestion]);

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
    .filter(r => (r.academic_points || 0) > 0 || r.timing_status != null)
    .forEach(r => {
      const cur = topicBestPts.get(r.topic) || 0;
      if ((r.academic_points || 0) > cur || !topicBestPts.has(r.topic)) {
        topicBestPts.set(r.topic, r.academic_points || 0);
      }
    });

  const blocksCompleted = topicBestPts.size;
  const totalPoints = Array.from(topicBestPts.values()).reduce((a, b) => a + b, 0);
  const avgPct = myResults.length > 0
    ? myResults.reduce((a, r) => a + (r.percentage || 0), 0) / myResults.length
    : null;

  const myRankIdx = leaderboard.findIndex(d => Boolean(d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase()));
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // Advisor Meeting logic
  const [claimingAdvisorMeeting, setClaimingAdvisorMeeting] = useState(false);
  const [advisorMeetingError, setAdvisorMeetingError] = useState<string | null>(null);

  const advisorTopicStr = currentBlock ? `[Attendance] [AY ${currentBlock.academic_year || getCurrentAcademicYear()}] Block: ${currentBlock.title} - Advisor Meeting` : '';
  const advisorMeetingCompleted = currentBlock ? myResults.some(r => r.topic === advisorTopicStr) : false;

  const handleClaimAdvisorMeeting = async () => {
    if (!currentBlock) return;
    setClaimingAdvisorMeeting(true);
    setAdvisorMeetingError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/resident/advisor-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          blockId: currentBlock.id,
          blockTitle: currentBlock.title,
          selectedYear: currentBlock.academic_year || getCurrentAcademicYear()
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to claim advisor meeting point');
      }

      // Re-fetch dashboard data
      refetch();
    } catch (err: any) {
      setAdvisorMeetingError(err.message);
    } finally {
      setClaimingAdvisorMeeting(false);
    }
  };

  // === RESIDENT TOPIC-SELECT VIEW ===
  const renderTopicSelect = () => (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start gap-2 relative">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex-1 min-w-0 pr-2 flex items-center gap-3">
          <AbfmShield className="w-10 h-10 text-blue-600 dark:text-blue-500 hidden sm:block shrink-0" />
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">FMC Board Review App</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
            <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] md:text-xs tracking-wide uppercase opacity-60 truncate">
              Ascension St. Vincent's FM Residency · {formatDisplayName(profile?.full_name) !== 'Unknown' ? formatDisplayName(profile?.full_name) : user.email}
            </p>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 self-start sm:self-auto"
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
              onClick={() => onOpenAdmin()}
              className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Admin Console"
            >
              <Lock className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-400 dark:text-slate-300 hover:text-amber-500 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title={`Current Theme: ${theme.toUpperCase()} (Click to cycle Light / Dark / Midnight)`}
          >
            {theme === 'light' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : theme === 'dark' ? (
              <Moon className="w-5 h-5 text-blue-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-indigo-400" />
            )}
          </button>
          <button onClick={() => setShowInstallApp(true)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors" title="Install app on your phone">
            <Smartphone className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" title="Profile Settings">
            <Settings className="w-5 h-5" />
          </button>
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=jonathan.carbungco@ascension.org&su=Feedback:%20FMC%20Board%20Question%20App${user.email ? `&authuser=${encodeURIComponent(user.email)}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
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
      {!hasTakenDemo && !demoBannerDismissed && !mostRecentSession && !loading && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden animate-fade-in">
          <div className="flex items-start gap-3 flex-1 min-w-0 pr-8 md:pr-0">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/60 rounded-xl shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-100 mb-0.5">
                Welcome to the FMC Board Review App!
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm font-medium pr-2">
                We recommend taking the Demo Quiz first to get familiar with the interface, tools, and question formats. It's only 3 questions and won't affect your stats.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
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
            <button
              onClick={() => {
                setDemoBannerDismissed(true);
                try {
                  localStorage.setItem(`fmc_demo_banner_dismissed_${user.id}`, 'true');
                } catch {}
              }}
              className="p-2 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Two-column body */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* LEFT SIDEBAR */}
        <div className="hidden md:flex md:w-80 flex-col gap-4 shrink-0">
          
          {/* My Performance — yellow gradient (Positioned on top per user request) */}
          <button
            onClick={() => setShowMyStats(true)}
            className="w-full flex items-center gap-4 p-5 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-3xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group"
          >
            <div className="p-3 bg-white/60 dark:bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base">My Performance</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Stats, badges &amp; history</p>
            </div>
          </button>

          {/* Achievements */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Achievements</h3>
              <button
                onClick={() => setShowAchievements(true)}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Info className="w-3.5 h-3.5" /> View all
              </button>
            </div>
            
            {userStreak?.current_qotd_streak > 0 && (
              <div 
                className="flex items-center gap-3 mb-4 p-3 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 rounded-xl border border-orange-100 dark:border-orange-900/40 cursor-help transition-all hover:bg-orange-100 dark:hover:bg-orange-900/60"
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
                className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/40 cursor-help transition-all hover:bg-blue-100 dark:hover:bg-blue-900/60"
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
                  <div key={idx} title={badge.name + ' - ' + badge.description} className="flex items-center justify-center w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full text-xl cursor-help hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
                    {badge.icon}
                  </div>
                ))}
              </div>
            )}

            {!(userStreak?.current_qotd_streak > 0) && !(userStreak?.current_block_streak > 0) && userBadges.length === 0 && (
              <button
                onClick={() => setShowAchievements(true)}
                className="w-full text-left text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                No badges yet — tap &ldquo;View all&rdquo; to see what you can earn.
              </button>
            )}
          </div>

          {leaderboard.length > 0 && (
            <div className="space-y-4">
              <LeaderboardWidget data={leaderboard} myEmail={user.email} />
              <ClassLeaderboardWidget data={leaderboard} myPgy={profile?.pgy} onClassClick={(pgy) => setSelectedYoyClass(pgy)} />
            </div>
          )}
        </div>

        {/* RIGHT MAIN */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* TOP ROW: 3 Compact Square-Styled Blocks (QOTD, Quiz Builder, Resume Block / Active Jump) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
            
            {/* Block 1: Question of the Day */}
            <div className="order-1 md:order-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 transition-all group min-h-[170px]">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-black text-sm sm:text-base flex items-center gap-1.5 text-white">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    QOTD
                  </span>
                  {userStreak?.current_qotd_streak > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-black text-amber-200 flex items-center gap-0.5">
                      🔥 {userStreak.current_qotd_streak}d
                    </span>
                  )}
                </div>

                <p className="text-indigo-100 text-xs line-clamp-2 mb-3 leading-snug">
                  {qotdQuestion ? (
                    qotdAttempt || isPastNoon() ? (
                      qotdAttempt ? (
                        isPastNoon()
                          ? qotdStats && qotdStats.total > 0
                            ? `${qotdStats.total} answered · ${Math.round((qotdStats.correct / qotdStats.total) * 100)}% correct`
                            : 'Results and stats are now available!'
                          : 'Answer saved. Stats at 12:30 PM!'
                      ) : (
                        qotdStats && qotdStats.total > 0
                          ? `Missed today's QOTD (${Math.round((qotdStats.correct / qotdStats.total) * 100)}% correct).`
                          : "Missed today's QOTD. Answer available."
                      )
                    ) : (
                      'A new high-yield board review question is ready.'
                    )
                  ) : (
                    'Enjoy your weekend! No QOTD scheduled today.'
                  )}
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-1.5 mt-auto">
                {qotdQuestion ? (
                  qotdAttempt || isPastNoon() ? (
                    <>
                      <button
                        onClick={() => onStartQuiz({ 
                          isQotd: true, 
                          qotdQuestion, 
                          topic: 'Question of the Day', 
                          isQotdCompleted: true, 
                          qotdAttempt: qotdAttempt || { is_skipped: true } 
                        })}
                        className="flex-1 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all text-xs backdrop-blur-sm border border-white/20 text-center truncate"
                      >
                        {qotdAttempt ? (isPastNoon() ? 'Results' : 'Review') : 'Answer'}
                      </button>
                      <button
                        onClick={() => setShowQotdHistoryModal(true)}
                        className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all text-xs backdrop-blur-sm border border-white/10 shrink-0"
                        title="Past QOTDs"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onStartQuiz({ isQotd: true, qotdQuestion, topic: 'Question of the Day', count: 1 })}
                        className="flex-1 py-2 bg-white text-indigo-600 rounded-xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1 text-xs"
                      >
                        Take QOTD <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowQotdHistoryModal(true)}
                        className="px-2.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all text-xs backdrop-blur-sm border border-white/20 shrink-0"
                        title="Past QOTDs"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </>
                  )
                ) : (
                  <button
                    onClick={() => setShowQotdHistoryModal(true)}
                    className="w-full py-2 bg-white text-indigo-600 rounded-xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Past QOTDs
                  </button>
                )}
              </div>
            </div>

            {/* Block 2: Quiz Builder */}
            <button
              onClick={onOpenBuilder}
              className="order-3 md:order-2 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col justify-between text-left relative overflow-hidden min-h-[170px]"
            >
              <div className="flex items-center justify-between gap-2 mb-2 w-full">
                <span className="font-black text-sm sm:text-base flex items-center gap-1.5 text-indigo-900 dark:text-indigo-100">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg group-hover:rotate-6 transition-transform">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  Quiz Builder
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-bold">
                  Custom
                </span>
              </div>

              <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium line-clamp-2 mb-3">
                Target weak areas, filter by difficulty, or start a mixed review quiz.
              </p>

              <div className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform mt-auto">
                Launch Builder <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Block 3: Resume Saved Block or Active Curriculum Jump */}
            {mostRecentSession ? (
              <button
                onClick={() => {
                  const matchedBlock = blocks.find(b => b.title === mostRecentSession.topic || b.id === mostRecentSession.quiz_id);
                  onStartQuiz({
                    topic: mostRecentSession.topic,
                    quizId: mostRecentSession.quiz_id || matchedBlock?.id,
                    count: 40,
                  });
                }}
                className="order-2 md:order-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col justify-between text-left relative overflow-hidden min-h-[170px]"
              >
                <div className="flex items-center justify-between gap-2 mb-2 w-full">
                  <span className="font-black text-sm sm:text-base flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                    <div className="p-1.5 bg-amber-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-3.5 h-3.5" />
                    </div>
                    Resume Block
                  </span>
                  <span className="px-2 py-0.5 bg-amber-200/80 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 rounded-full text-[10px] font-bold">
                    In Progress
                  </span>
                </div>

                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium truncate mb-3" title={mostRecentSession.topic}>
                  {mostRecentSession.topic} · Q{(mostRecentSession.current_index || 0) + 1}
                </p>

                <div className="flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform mt-auto">
                  Continue Block <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ) : currentBlock ? (
              <button
                onClick={() => onStartQuiz({ topic: currentBlock.title, quizId: currentBlock.id, count: 40 })}
                className="order-2 md:order-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col justify-between text-left relative overflow-hidden min-h-[170px]"
              >
                <div className="flex items-center justify-between gap-2 mb-2 w-full">
                  <span className="font-black text-sm sm:text-base flex items-center gap-1.5 text-emerald-900 dark:text-emerald-100">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    Active Block
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-200/80 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 rounded-full text-[10px] font-bold">
                    Scheduled
                  </span>
                </div>

                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 font-medium truncate mb-3" title={currentBlock.title}>
                  {currentBlock.title}
                </p>

                <div className="flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300 group-hover:translate-x-0.5 transition-transform mt-auto">
                  Start Block <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ) : (
              <div className="order-2 md:order-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between text-left min-h-[170px]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-black text-sm sm:text-base flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Up to Date
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">
                  No paused sessions. All submitted quizzes are saved.
                </p>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-auto">
                  Ready for review
                </span>
              </div>
            )}
          </div>

          {/* MOBILE ONLY: 3 Compact App-Icon Cards (Performance, Badges, Leaderboard) */}
          <div className="grid grid-cols-3 gap-2.5 mb-4 md:hidden">
            {/* Card 1: Performance */}
            <button
              onClick={() => setShowMyStats(true)}
              className="p-3 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 dark:from-amber-500/15 dark:to-yellow-500/15 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl flex flex-col items-center justify-center text-center group hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center mb-1.5 shadow-md shadow-amber-500/20 group-hover:rotate-6 transition-transform">
                <Trophy className="w-4.5 h-4.5 text-amber-950" />
              </div>
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate w-full">
                Performance
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate w-full">
                {totalPoints} AP{myRank ? ` · #${myRank}` : ''}
              </span>
            </button>

            {/* Card 2: Badges & Achievements */}
            <button
              onClick={() => setShowAchievements(true)}
              className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/15 dark:to-pink-500/15 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl flex flex-col items-center justify-center text-center group hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center mb-1.5 shadow-md shadow-purple-500/20 group-hover:rotate-6 transition-transform">
                <Sparkles className="w-4.5 h-4.5 text-yellow-300" />
              </div>
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate w-full">
                Badges
              </span>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 truncate w-full">
                {userStreak?.current_qotd_streak > 0 
                  ? `🔥 ${userStreak.current_qotd_streak}d streak` 
                  : userBadges.length > 0 
                  ? `${userBadges.length} earned` 
                  : 'View all'}
              </span>
            </button>

            {/* Card 3: Leaderboard */}
            <button
              onClick={() => setShowLeaderboardModal(true)}
              className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/15 dark:to-cyan-500/15 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl flex flex-col items-center justify-center text-center group hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center mb-1.5 shadow-md shadow-blue-500/20 group-hover:rotate-6 transition-transform">
                <Trophy className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate w-full">
                Leaderboard
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate w-full">
                {myRank ? `Rank #${myRank}` : 'Standings'}
              </span>
            </button>
          </div>

          {/* Advisee Hub for Faculty and Admins (Moved Below Top 3 Blocks, Default Collapsed) */}
          {isSuperAdmin && (
            <AdviseeQuickAccessCard
              user={user}
              profile={profile}
              selectedYear={selectedYear}
              onOpenAdmin={onOpenAdmin}
              currentBlock={currentBlock}
            />
          )}

          {/* Assigned Quizzes (Row below Advisee Hub) */}
          {data?.assignedQuizzes && data.assignedQuizzes.length > 0 && (
            <div className="space-y-3 mb-4">
              {data.assignedQuizzes.map((aq: AssignedQuiz) => (
                <button
                  key={aq.id}
                  onClick={() => {
                    onStartQuiz({
                      topic: aq.title || 'Assigned Quiz',
                      quizId: `assigned-${aq.id}`,
                      questionIds: aq.question_ids,
                      count: aq.question_ids.length,
                      timerEnabled: true,
                    });
                  }}
                  className="w-full text-left p-3.5 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 bg-purple-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider">Assigned</div>
                  <Sparkles className="w-5 h-5 shrink-0 text-purple-500" />
                  <div className="text-left flex-1 min-w-0 pr-14">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm sm:text-base text-purple-900 dark:text-purple-100">{aq.title}</p>
                      <span className="px-2 py-0.5 bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-[10px] font-bold rounded">Practice (0 AP)</span>
                    </div>
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 opacity-80 truncate mt-0.5">
                      {aq.question_ids?.length} Questions • Assigned by your advisor • Practice &amp; Remediation
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Active Block Advisor Meeting Self-Check */}
          {currentBlock && effectiveRole !== 'faculty' && effectiveRole !== 'admin' && (
            <div className="mb-8 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl shrink-0 ${advisorMeetingCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    {advisorMeetingCompleted ? <CheckCircle className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg">
                      {currentBlock.title} — Advisor Meeting
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {advisorMeetingCompleted 
                        ? 'Meeting completed. You earned 1 attendance point!' 
                        : 'Honor system: Mark your block advisor meeting complete.'}
                    </p>
                    {advisorMeetingError && (
                      <p className="text-xs text-red-500 font-bold mt-1 bg-red-50 dark:bg-red-950/40 inline-block px-2 py-1 rounded">{advisorMeetingError}</p>
                    )}
                  </div>
                </div>
                {!advisorMeetingCompleted ? (
                  <button
                    onClick={handleClaimAdvisorMeeting}
                    disabled={claimingAdvisorMeeting}
                    className="shrink-0 w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {claimingAdvisorMeeting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Mark Complete
                  </button>
                ) : (
                  <div className="shrink-0 w-full md:w-auto px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 rounded-xl font-black flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-xs">Board Review Blocks</h3>
            {blocks.length > 1 && (
              <select
                value={blockSort}
                onChange={e => changeBlockSort(e.target.value as 'curriculum' | 'name' | 'status')}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
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
                  const isDemoA = a.block_type === 'demo' || (a.title || '').toLowerCase().includes('demo');
                  const isDemoB = b.block_type === 'demo' || (b.title || '').toLowerCase().includes('demo');
                  const doneA = isDemoA ? hasTakenDemo : !!rA && ((rA.academic_points || 0) > 0 || rA.timing_status != null);
                  const doneB = isDemoB ? hasTakenDemo : !!rB && ((rB.academic_points || 0) > 0 || rB.timing_status != null);
                  return Number(doneA) - Number(doneB);
                }
                return 0; // 'curriculum' — keep server order (by sort_order)
              }).map(block => {
                const result = bestResultByTopic.get(block.title);
                const titleLc = (block.title || '').toLowerCase();
                const isDemoBlock = block.block_type === 'demo' || titleLc.includes('demo');
                const isCompleted = isDemoBlock 
                  ? hasTakenDemo 
                  : !!result && ((result.academic_points || 0) > 0 || result.timing_status != null);
                // Sprint 5: prefer the fixed assigned question set so every resident sees the
                // same questions (order is still randomized client-side in QuizEngine).
                // Falls back to category filters for legacy/uninitialized blocks.
                const hasFixedSet = block.question_ids && block.question_ids.length > 0;
                const displayCount = hasFixedSet
                  ? block.question_ids.length
                  : (block.question_count || 40);

                const activeSession = getSessionForBlock(block.title);
                const hasResume = !!activeSession;

                // Themed block icon: green check when done, otherwise by type —
                // play = demo, gem = bonus, open book = standard board-review block.
                const isBonusBlock = titleLc.includes('bonus');
                const BlockIcon = isCompleted ? CheckCircle : isDemoBlock ? PlayCircle : isBonusBlock ? Gem : BookOpen;
                
                const blockIconBadge = isCompleted 
                    ? 'bg-green-50 dark:bg-emerald-950/50 text-green-600 dark:text-emerald-400'
                    : hasResume
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                    : isDemoBlock
                    ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400';
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
                    className="shrink-0 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex justify-between items-center cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-800/80 hover:ring-blue-400 dark:hover:ring-blue-500"
                  >
                    {hasResume && !isCompleted && (
                      <div className="absolute top-0 right-0 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-black text-[10px] px-2 py-0.5 rounded-bl-xl shadow-sm border-b border-l border-amber-200 dark:border-amber-900/50">
                        In Progress
                      </div>
                    )}
                    <div className="flex gap-3 items-center min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${blockIconBadge}`}>
                        <BlockIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-base text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
                          {block.title}
                          {isCompleted && (
                            <span className="text-[10px] bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-green-200 dark:border-emerald-900/50 uppercase tracking-wider shrink-0">
                              Done
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
                          {result ? `Best: ${(result.percentage || 0).toFixed(1)}%` : `${displayCount} Questions`}
                          {!isCompleted && hasResume && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold">
                              • In Progress (Q{(activeSession.current_index || 0) + 1}/{displayCount})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
          selectedYear={selectedYear}
          onYearChange={(year: number) => setSelectedYear(year)}
        />
      )}

      {showQotdHistoryModal && (
        <QotdHistoryModal onClose={() => setShowQotdHistoryModal(false)} />
      )}

      {selectedYoyClass && (
        <ClassYoyModal 
          selectedClass={selectedYoyClass}
          leaderboardData={leaderboard}
          onClose={() => setSelectedYoyClass(null)}
        />
      )}

      {/* Mobile Leaderboard Modal */}
      {showLeaderboardModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
          onClick={() => setShowLeaderboardModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl transition-colors overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white">Leaderboards</h2>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    {formatAcademicYear(selectedYear)} Standings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {userStreak && (userStreak.current_qotd_streak > 0 || userStreak.current_block_streak > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {userStreak.current_qotd_streak > 0 && (
                    <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 rounded-xl border border-orange-100 dark:border-orange-900/40 flex items-center gap-2">
                      <span className="text-lg">🔥</span>
                      <div className="min-w-0">
                        <div className="font-black text-xs truncate">{userStreak.current_qotd_streak}d Streak</div>
                        <div className="text-[9px] font-bold opacity-75 truncate">QOTD</div>
                      </div>
                    </div>
                  )}
                  {userStreak.current_block_streak > 0 && (
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      <div className="min-w-0">
                        <div className="font-black text-xs truncate">{userStreak.current_block_streak} Blk Streak</div>
                        <div className="text-[9px] font-bold opacity-75 truncate">On-Time</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {leaderboard.length > 0 ? (
                <>
                  <LeaderboardWidget data={leaderboard} myEmail={user.email} />
                  <ClassLeaderboardWidget data={leaderboard} myPgy={profile?.pgy} onClassClick={(pgy) => {
                    setShowLeaderboardModal(false);
                    setSelectedYoyClass(pgy);
                  }} />
                </>
              ) : (
                <p className="text-center py-6 text-slate-400 text-sm italic">No leaderboard data available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showInstallApp && <InstallAppModal onClose={() => setShowInstallApp(false)} />}

      {/* New Badge Overlay Modal */}
      {recentBadges.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setRecentBadges([])}>
          <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
            <button onClick={() => setRecentBadges([])} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">Achievement Unlocked!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">You've earned {recentBadges.length === 1 ? 'a new badge' : 'new badges'}!</p>
            
            <div className="space-y-4">
              {recentBadges.map((badge, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded-2xl shadow-inner">
                  <div className="text-7xl mb-4 drop-shadow-md animate-bounce">{badge.icon || '🏆'}</div>
                  <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200">{badge.name}</h3>
                  {badge.description && <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-2 font-medium leading-relaxed">{badge.description}</p>}
                </div>
              ))}
            </div>
            
            <button onClick={() => setRecentBadges([])} className="mt-8 w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-2xl font-bold transition-all transform active:scale-95 shadow-lg flex justify-center items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Awesome!
            </button>
          </div>
        </div>
      )}
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      {renderTopicSelect()}
    </div>
  );
}

// === LEADERBOARD WIDGET ===
function LeaderboardWidget({ data, myEmail }: { data: LeaderboardEntry[]; myEmail: string }) {
  const top = data.slice(0, 5);
  const myEntry = data.find(d => d.email.toLowerCase() === myEmail?.toLowerCase());
  const myRank = myEntry ? data.findIndex(d => d.email === myEntry.email) + 1 : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Academic Points Leaderboard</h3>
        </div>
        {myRank && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">You: #{myRank}</span>}
      </div>
      <div className="space-y-1">
        {top.map((r, i) => {
          const isMe = r.email.toLowerCase() === myEmail?.toLowerCase();
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div
              key={r.email}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${isMe ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0">
                  {medal || `#${i + 1}`}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${isMe ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {formatDisplayName(r.name)}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {r.pgy.replace('Class of ', "'")}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-black shrink-0 ml-2 ${isMe ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                {r.totalPoints} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === CLASS LEADERBOARD WIDGET ===
function ClassLeaderboardWidget({ data, myPgy, onClassClick }: { data: LeaderboardEntry[]; myPgy?: string; onClassClick: (pgy: string) => void }) {
  const classTotals = data.reduce((acc, curr) => {
    // Only group by actual classes, ignoring empty/faculty
    if (!curr.pgy || curr.pgy === 'Faculty') return acc;
    if (!acc[curr.pgy]) acc[curr.pgy] = 0;
    acc[curr.pgy] += curr.totalPoints;
    return acc;
  }, {} as Record<string, number>);

  const classes = Object.entries(classTotals)
    .map(([pgy, totalPoints]) => ({ pgy, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  if (classes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Class Leaderboard</h3>
        </div>
      </div>
      <div className="space-y-1">
        {classes.map((c, i) => {
          const isMyClass = c.pgy === myPgy;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <button
              key={c.pgy}
              onClick={() => onClassClick(c.pgy)}
              className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${isMyClass ? 'bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0">
                  {medal || `#${i + 1}`}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${isMyClass ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {c.pgy.replace('Class of ', 'Class ')}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-black shrink-0 ml-2 ${isMyClass ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                {c.totalPoints} pts
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
