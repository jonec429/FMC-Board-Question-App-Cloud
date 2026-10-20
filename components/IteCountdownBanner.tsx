'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, GraduationCap, Users, Info, CheckCircle, X } from './AppIcons';
import { supabase } from '@/lib/supabase';
import { Profile, User } from '@/lib/types';

export interface IteDoctorEntry {
  display: string;
  lastName: string;
  altLastNames?: string[];
  firstInitial?: string;
  defaultAdvisors: string[];
}

export interface IteSession {
  id: 'oct20' | 'oct28';
  label: string;
  shortDate: string;
  fullDateLabel: string;
  timeLabel: string;
  location: string;
  isoTarget: string;
  isoEndTarget: string;
  doctors: IteDoctorEntry[];
}

export const ITE_WHAT_TO_EXPECT = [
  '200 questions',
  '4 hours',
  '7:15 AM arrival',
  'Bring your charger!',
  'Results usually sometime in December',
];

export const ITE_SESSIONS: IteSession[] = [
  {
    id: 'oct20',
    label: 'Session 1',
    shortDate: 'Tue, Oct 20',
    fullDateLabel: 'Tuesday, October 20',
    timeLabel: '7:15 AM',
    location: 'FMC Conference Room A',
    isoTarget: '2026-10-20T07:15:00-04:00',
    isoEndTarget: '2026-10-20T11:30:00-04:00',
    doctors: [
      { display: 'Dr. Carson', lastName: 'carson', defaultAdvisors: ['napuri'] },
      { display: 'Dr. Haddad', lastName: 'haddad', defaultAdvisors: ['peterson'] },
      { display: 'Dr. Hobgood', lastName: 'hobgood', defaultAdvisors: ['snell', 'rowe', 'kellogg'] },
      { display: 'Dr. Keenan', lastName: 'keenan', defaultAdvisors: ['iyengar'] },
      { display: 'Dr. A. Kemmer', lastName: 'kemmer', firstInitial: 'a', defaultAdvisors: ['mcinnes'] },
      { display: 'Dr. B. Kemmer', lastName: 'kemmer', firstInitial: 'b', defaultAdvisors: ['kellogg'] },
      { display: 'Dr. Klem', lastName: 'klem', defaultAdvisors: ['kellogg'] },
      { display: 'Dr. Louis', lastName: 'louis', defaultAdvisors: ['snell', 'rowe'] },
      { display: 'Dr. Nguyen', lastName: 'nguyen', firstInitial: 'a', defaultAdvisors: ['mcinnes', 'dominguez'] },
      { display: 'Dr. Parker', lastName: 'parker', defaultAdvisors: ['snell', 'rowe', 'watson'] },
      { display: 'Dr. Robak', lastName: 'robak', defaultAdvisors: ['dela cruz', 'cruz'] },
      { display: 'Dr. Roland', lastName: 'roland', defaultAdvisors: ['carbungco', 'soldo'] },
      { display: 'Dr. Saavedra', lastName: 'saavedra', defaultAdvisors: ['stephenson'] },
      { display: 'Dr. Simon', lastName: 'simon', defaultAdvisors: ['watson'] },
      { display: 'Dr. Smith', lastName: 'smith', defaultAdvisors: ['peterson', 'largen'] },
      { display: 'Dr. Thiravialingam', lastName: 'thiravialingam', defaultAdvisors: ['dela cruz', 'cruz'] },
      { display: 'Dr. Wilson', lastName: 'wilson', defaultAdvisors: ['peterson'] },
    ],
  },
  {
    id: 'oct28',
    label: 'Session 2',
    shortDate: 'Wed, Oct 28',
    fullDateLabel: 'Wednesday, October 28',
    timeLabel: '7:15 AM',
    location: 'FMC Conference Room A',
    isoTarget: '2026-10-28T07:15:00-04:00',
    isoEndTarget: '2026-10-28T11:30:00-04:00',
    doctors: [
      { display: 'Dr. Ball', lastName: 'ball', defaultAdvisors: ['stephenson'] },
      { display: 'Dr. Boettcher', lastName: 'boettcher', defaultAdvisors: ['iyengar'] },
      { display: 'Dr. Brock', lastName: 'brock', defaultAdvisors: ['watson'] },
      { display: 'Dr. Celmins', lastName: 'celmins', defaultAdvisors: ['potts', 'dela cruz', 'cruz'] },
      { display: 'Dr. Dean', lastName: 'dean', defaultAdvisors: ['watson'] },
      { display: 'Dr. Doerger', lastName: 'doerger', defaultAdvisors: ['mcinnes'] },
      { display: 'Dr. Fedotova', lastName: 'fedotova', defaultAdvisors: ['potts'] },
      { display: 'Dr. Frank', lastName: 'frank', defaultAdvisors: ['napuri'] },
      { display: 'Dr. Lemus', lastName: 'lemus', defaultAdvisors: ['snell', 'rowe'] },
      { display: 'Dr. Martinez', lastName: 'martinez', defaultAdvisors: ['alley', 'napuri'] },
      { display: 'Dr. Miller', lastName: 'miller', altLastNames: ['lin'], defaultAdvisors: ['carbungco'] },
      { display: 'Dr. Parmer', lastName: 'parmer', defaultAdvisors: ['dela cruz', 'cruz', 'potts'] },
      { display: 'Dr. Perez', lastName: 'perez', defaultAdvisors: ['kellogg'] },
      { display: 'Dr. Shih', lastName: 'shih', defaultAdvisors: ['alley'] },
      { display: 'Dr. Shipp', lastName: 'shipp', defaultAdvisors: ['carbungco', 'soldo'] },
      { display: 'Dr. Sollee', lastName: 'sollee', altLastNames: ['gravrok'], defaultAdvisors: ['napuri', 'alley'] },
      { display: 'Dr. Varni', lastName: 'varni', defaultAdvisors: ['watson', 'iyengar'] },
    ],
  },
];

interface TimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  hasStarted: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
}

function getSessionStatus(session: IteSession, nowMs: number): TimeRemaining {
  const startMs = new Date(session.isoTarget).getTime();
  const endMs = new Date(session.isoEndTarget).getTime();
  const diff = startMs - nowMs;

  if (diff <= 0) {
    const isInProgress = nowMs < endMs;
    return {
      totalMs: diff,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      hasStarted: true,
      isInProgress,
      isCompleted: !isInProgress,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMs: diff,
    days,
    hours,
    minutes,
    seconds,
    hasStarted: false,
    isInProgress: false,
    isCompleted: false,
  };
}

function extractUserIdentity(user: User, profile: Profile | null): {
  lastName: string;
  firstInitial: string;
  emailLastToken: string;
  fullNameLower: string;
} {
  const rawLast = (profile?.last_name || '').trim().toLowerCase();
  const rawFirst = (profile?.first_name || '').trim().toLowerCase();
  const rawFull = (profile?.full_name || '').trim().toLowerCase();

  let lastName = rawLast;
  let firstInitial = rawFirst ? rawFirst[0] : '';

  if (!lastName && rawFull) {
    const parts = rawFull.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      lastName = parts[parts.length - 1].replace(/[^a-z]/g, '');
      if (!firstInitial) {
        firstInitial = parts[0].replace(/[^a-z]/g, '')[0] || '';
      }
    }
  }

  let emailLastToken = '';
  if (user?.email) {
    const localPart = user.email.split('@')[0] || '';
    const emailTokens = localPart
      .replace(/[0-9]/g, '')
      .split(/[._-]+/)
      .filter(Boolean);
    if (emailTokens.length >= 2) {
      emailLastToken = emailTokens[emailTokens.length - 1].toLowerCase();
      if (!lastName) lastName = emailLastToken;
      if (!firstInitial) firstInitial = emailTokens[0][0]?.toLowerCase() || '';
    } else if (emailTokens.length === 1) {
      emailLastToken = emailTokens[0].toLowerCase();
      if (!lastName) lastName = emailLastToken;
    }
  }

  return { lastName, firstInitial, emailLastToken, fullNameLower: rawFull };
}

function matchesDoctorIdentity(
  doc: IteDoctorEntry,
  lastName: string,
  emailLastToken: string,
  firstInitial: string
): boolean {
  const candidateLastNames = [doc.lastName, ...(doc.altLastNames || [])];
  const lastMatches =
    (Boolean(lastName) && candidateLastNames.includes(lastName)) ||
    (Boolean(emailLastToken) && candidateLastNames.includes(emailLastToken));

  if (!lastMatches) return false;
  if (doc.firstInitial && firstInitial && doc.firstInitial !== firstInitial) {
    return false;
  }
  return true;
}

interface IteCountdownBannerProps {
  user: User;
  profile: Profile | null;
  effectiveRole: string;
}

export default function IteCountdownBanner({ user, profile, effectiveRole }: IteCountdownBannerProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showSchedule, setShowSchedule] = useState(false);
  const [showExpectHover, setShowExpectHover] = useState(false);
  const [postIteDismissed, setPostIteDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('fmc_ite_banner_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fmc_ite_banner_collapsed', String(next));
      } catch {}
      return next;
    });
  };
  const [liveAdvisorMap, setLiveAdvisorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load persisted dismissal state for completed ITE banner
  useEffect(() => {
    try {
      if (localStorage.getItem(`fmc_ite_2026_completed_dismissed_${user.id}`) === 'true') {
        setPostIteDismissed(true);
      }
    } catch {}
  }, [user.id]);

  const isFacultyOrAdmin =
    effectiveRole === 'faculty' || effectiveRole === 'admin' || effectiveRole === 'gme_staff';

  // Fetch live advisor mappings from authorized_roster for faculty/admin users
  useEffect(() => {
    if (!isFacultyOrAdmin) return;
    let isMounted = true;
    supabase
      .from('authorized_roster')
      .select('first_name, last_name, name, advisor, status')
      .neq('pgy', 'Faculty')
      .then(({ data }) => {
        if (!isMounted || !data) return;
        const map: Record<string, string> = {};
        data.forEach((row) => {
          if (row.status === 'graduated') return;
          const rLast = (row.last_name || row.name?.split(' ').slice(-1)[0] || '').trim().toLowerCase();
          const rFirstInit = (row.first_name || row.name || '').trim().toLowerCase()[0] || '';
          if (rLast && row.advisor) {
            map[`${rLast}_${rFirstInit}`] = row.advisor.toLowerCase();
            map[rLast] = row.advisor.toLowerCase();
          }
        });
        setLiveAdvisorMap(map);
      });
    return () => {
      isMounted = false;
    };
  }, [isFacultyOrAdmin]);

  const { lastName, firstInitial, emailLastToken, fullNameLower } = useMemo(
    () => extractUserIdentity(user, profile),
    [user, profile]
  );

  const isGraduated2026 = profile?.pgy === 'Class of 2026';

  // Match resident to their assigned session and doctor entry
  const matchedAssignment = useMemo(() => {
    if (isFacultyOrAdmin || isGraduated2026 || (!lastName && !emailLastToken)) return null;

    for (const session of ITE_SESSIONS) {
      for (const doc of session.doctors) {
        if (matchesDoctorIdentity(doc, lastName, emailLastToken, firstInitial)) {
          return { session, doctor: doc };
        }
      }
    }
    return null;
  }, [lastName, emailLastToken, firstInitial, isFacultyOrAdmin, isGraduated2026]);

  // Determine whether a doctor entry is an advisee of the logged-in faculty/admin
  const isMyAdvisee = useMemo(() => {
    return (doc: IteDoctorEntry): boolean => {
      if (!isFacultyOrAdmin || (!lastName && !fullNameLower)) return false;

      // Check live roster advisor string first if available
      const specificKey = doc.firstInitial ? `${doc.lastName}_${doc.firstInitial}` : doc.lastName;
      const liveAdvisorStr = liveAdvisorMap[specificKey] || liveAdvisorMap[doc.lastName];
      if (liveAdvisorStr) {
        if (lastName && liveAdvisorStr.includes(lastName)) return true;
        if (emailLastToken && liveAdvisorStr.includes(emailLastToken)) return true;
        if (fullNameLower && liveAdvisorStr.includes(fullNameLower)) return true;
        return false;
      }

      // Fallback to built-in roster advisor tokens
      return doc.defaultAdvisors.some(
        (advToken) =>
          (Boolean(lastName) && (lastName.includes(advToken) || advToken.includes(lastName))) ||
          (Boolean(emailLastToken) && (emailLastToken.includes(advToken) || advToken.includes(emailLastToken))) ||
          (Boolean(fullNameLower) && fullNameLower.includes(advToken))
      );
    };
  }, [isFacultyOrAdmin, lastName, emailLastToken, fullNameLower, liveAdvisorMap]);

  const myAdviseesBySession = useMemo(() => {
    if (!isFacultyOrAdmin) return { oct20: [] as IteDoctorEntry[], oct28: [] as IteDoctorEntry[], total: 0 };
    const oct20 = ITE_SESSIONS[0].doctors.filter((d) => isMyAdvisee(d));
    const oct28 = ITE_SESSIONS[1].doctors.filter((d) => isMyAdvisee(d));
    return { oct20, oct28, total: oct20.length + oct28.length };
  }, [isFacultyOrAdmin, isMyAdvisee]);

  // Auto-hide for everyone after Oct 29, 2026 (end of day EDT)
  const finalCutoffMs = new Date('2026-10-30T00:00:00-04:00').getTime();
  if (nowMs > finalCutoffMs) {
    return null;
  }

  const session1Status = getSessionStatus(ITE_SESSIONS[0], nowMs);
  const session2Status = getSessionStatus(ITE_SESSIONS[1], nowMs);
  const bothSessionsCompleted = session1Status.isCompleted && session2Status.isCompleted;

  // Determine primary session to count down to
  const primarySession = matchedAssignment
    ? matchedAssignment.session
    : !session1Status.isCompleted
    ? ITE_SESSIONS[0]
    : ITE_SESSIONS[1];

  const primaryStatus =
    primarySession.id === 'oct20' ? session1Status : session2Status;

  // Check if the current user's relevant ITE has completed
  const isUserIteCompleted = matchedAssignment
    ? primaryStatus.isCompleted
    : bothSessionsCompleted;

  if (isUserIteCompleted && postIteDismissed) {
    return null;
  }

  const handleDismissCompleted = () => {
    setPostIteDismissed(true);
    try {
      localStorage.setItem(`fmc_ite_2026_completed_dismissed_${user.id}`, 'true');
    } catch {}
  };

  const isDoctorSelfMatch = (doc: IteDoctorEntry) => {
    if (isFacultyOrAdmin || isGraduated2026) return false;
    return matchesDoctorIdentity(doc, lastName, emailLastToken, firstInitial);
  };

  if (isCollapsed) {
    return (
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-slate-900/90 border border-indigo-500/30 p-3 sm:px-4 text-white shadow-sm flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-amber-400/20 text-amber-300 rounded-lg shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-white truncate">
              2026 ABFM ITE
            </span>
            {matchedAssignment ? (
              <span className="text-xs text-indigo-200 truncate">
                • {matchedAssignment.doctor.display} ({matchedAssignment.session.shortDate} @ {matchedAssignment.session.timeLabel})
              </span>
            ) : (
              <span className="text-xs text-indigo-200 truncate hidden sm:inline">
                • Tue Oct 20 &amp; Wed Oct 28
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              primaryStatus.isCompleted 
                ? 'bg-emerald-400/20 text-emerald-200' 
                : 'bg-white/10 text-amber-200'
            }`}>
              {primaryStatus.isCompleted ? 'Completed 🎉' : `${primaryStatus.days}d ${primaryStatus.hours}h left`}
            </span>
          </div>
        </div>
        <button
          onClick={toggleCollapsed}
          className="px-2.5 py-1 text-xs font-bold text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          title="Expand ITE Countdown Details"
        >
          <span>Expand</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 text-white shadow-lg border border-indigo-500/30 relative animate-fade-in">
      {/* Subtle decorative glow */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Info Column */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <GraduationCap className="w-3.5 h-3.5" />
                {isUserIteCompleted ? '2026 ABFM ITE' : '2026 ABFM ITE Countdown'}
              </span>

              {matchedAssignment ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  Assigned: {matchedAssignment.doctor.display}
                </span>
              ) : myAdviseesBySession.total > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  Your Advisees ({myAdviseesBySession.total})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-indigo-200 border border-white/15">
                  2 ITE Dates Scheduled
                </span>
              )}

                            {/* Collapse Toggle Button */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/15 transition-colors cursor-pointer"
                title="Collapse ITE Banner"
              >
                <span>Collapse</span>
                <ChevronUp className="w-3 h-3" />
              </button>

              {/* Hover or Click "What to Expect" Trigger */}
              <div
                className="relative inline-block"
                onMouseEnter={() => setShowExpectHover(true)}
                onMouseLeave={() => setShowExpectHover(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowSchedule((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-400/20 hover:bg-indigo-400/30 text-indigo-100 border border-indigo-300/30 transition-colors cursor-pointer"
                >
                  <Info className="w-3 h-3 text-amber-300" />
                  What to Expect
                </button>

                {/* Hover Popover Card */}
                {showExpectHover && !showSchedule && (
                  <div className="hidden sm:block absolute left-0 top-full mt-2 w-72 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-indigo-400/40 shadow-2xl z-50 text-left animate-fade-in">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-2 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      What to Expect on ITE Day
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
                      {ITE_WHAT_TO_EXPECT.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-amber-400 font-black leading-tight">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-indigo-300 mt-2.5 pt-2 border-t border-white/10">
                      Click to view full resident schedule &amp; details
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Content Area: Resident Completed vs Resident Upcoming vs Faculty Advisees First vs General */}
            {isUserIteCompleted ? (
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>ITE Completed! 🎉 Results expected in December</span>
                </h3>
                <p className="text-xs sm:text-sm text-indigo-200 font-medium mt-0.5">
                  {matchedAssignment
                    ? `Great job completing your ${matchedAssignment.session.fullDateLabel} ITE session. Official ABFM score reports are typically released in December.`
                    : 'Both 2026 ITE sessions have concluded. Official ABFM score reports are typically released in December.'}
                </p>
              </div>
            ) : matchedAssignment ? (
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{matchedAssignment.session.fullDateLabel}</span>
                  <span className="text-indigo-300 font-bold">@ {matchedAssignment.session.timeLabel}</span>
                </h3>
                <p className="text-xs sm:text-sm text-indigo-200 font-medium mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>📍 {matchedAssignment.session.location}</span>
                  <span className="text-indigo-300/90">
                    • 200 questions · 4 hours · Bring your charger!
                  </span>
                </p>
              </div>
            ) : myAdviseesBySession.total > 0 ? (
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white mb-1.5">
                  Your Advisees&apos; ITE Schedule · FMC Conference Room A (7:15 AM)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Session 1 Advisees */}
                  <div
                    className={`px-3 py-2 rounded-xl border ${
                      session1Status.isCompleted
                        ? 'bg-white/5 border-white/10 text-slate-300'
                        : 'bg-white/10 border-amber-400/30 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5 text-amber-300">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Tue, Oct 20 @ 7:15 AM
                      </span>
                      <span className="text-[10px] font-bold text-indigo-200">
                        {session1Status.isCompleted
                          ? 'ITE Completed 🎉'
                          : session1Status.isInProgress
                          ? 'In Progress'
                          : `${session1Status.days}d ${session1Status.hours}h`}
                      </span>
                    </div>
                    {myAdviseesBySession.oct20.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {myAdviseesBySession.oct20.map((doc) => (
                          <span
                            key={doc.display}
                            className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/40 text-amber-100 text-[11px] font-bold"
                          >
                            {doc.display}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-indigo-300/70 italic">No advisees assigned to Oct 20</p>
                    )}
                  </div>

                  {/* Session 2 Advisees */}
                  <div
                    className={`px-3 py-2 rounded-xl border ${
                      session2Status.isCompleted
                        ? 'bg-white/5 border-white/10 text-slate-300'
                        : 'bg-white/10 border-cyan-400/30 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5 text-cyan-300">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Wed, Oct 28 @ 7:15 AM
                      </span>
                      <span className="text-[10px] font-bold text-indigo-200">
                        {session2Status.isCompleted
                          ? 'ITE Completed 🎉'
                          : session2Status.isInProgress
                          ? 'In Progress'
                          : `${session2Status.days}d ${session2Status.hours}h`}
                      </span>
                    </div>
                    {myAdviseesBySession.oct28.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {myAdviseesBySession.oct28.map((doc) => (
                          <span
                            key={doc.display}
                            className="px-2 py-0.5 rounded-md bg-cyan-400/20 border border-cyan-300/40 text-cyan-100 text-[11px] font-bold"
                          >
                            {doc.display}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-indigo-300/70 italic">No advisees assigned to Oct 28</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  In-Training Exam (ITE) Schedule · FMC Conference Room A
                </h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs sm:text-sm">
                  <div
                    className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${
                      session1Status.isCompleted
                        ? 'bg-white/5 border-white/10 text-slate-400'
                        : 'bg-white/10 border-white/20 text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="font-bold">Tue, Oct 20 @ 7:15 AM</span>
                    <span className="text-[11px] text-indigo-200">
                      (
                      {session1Status.isCompleted
                        ? 'Completed'
                        : session1Status.isInProgress
                        ? 'In Progress'
                        : `${session1Status.days}d ${session1Status.hours}h`}
                      )
                    </span>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${
                      session2Status.isCompleted
                        ? 'bg-white/5 border-white/10 text-slate-400'
                        : 'bg-white/10 border-white/20 text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span className="font-bold">Wed, Oct 28 @ 7:15 AM</span>
                    <span className="text-[11px] text-indigo-200">
                      (
                      {session2Status.isCompleted
                        ? 'Completed'
                        : session2Status.isInProgress
                        ? 'In Progress'
                        : `${session2Status.days}d ${session2Status.hours}h`}
                      )
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Countdown + Schedule Toggle + Optional Dismiss */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {!primaryStatus.hasStarted ? (
              <div
                onClick={() => setShowSchedule((prev) => !prev)}
                title={`Countdown to ${primarySession.shortDate} @ 7:15 AM — Click for details`}
                className="flex flex-col items-center bg-black/25 hover:bg-black/35 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 cursor-pointer transition-colors"
              >
                {!matchedAssignment && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 mb-1">
                    Next: {primarySession.shortDate}
                  </span>
                )}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <div className="text-center min-w-[38px]">
                    <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                      {String(primaryStatus.days).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                      Days
                    </div>
                  </div>
                  <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                  <div className="text-center min-w-[38px]">
                    <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                      {String(primaryStatus.hours).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                      Hrs
                    </div>
                  </div>
                  <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                  <div className="text-center min-w-[38px]">
                    <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                      {String(primaryStatus.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                      Min
                    </div>
                  </div>
                  <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                  <div className="text-center min-w-[38px]">
                    <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-amber-300">
                      {String(primaryStatus.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                      Sec
                    </div>
                  </div>
                </div>
              </div>
            ) : primaryStatus.isInProgress ? (
              <div className="px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>ITE Day — Good Luck!</span>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Results: December</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSchedule((prev) => !prev)}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/15 transition-all cursor-pointer shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-indigo-200" />
                <span>{showSchedule ? 'Hide Details' : 'Details & Roster'}</span>
                {showSchedule ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isUserIteCompleted && (
                <button
                  type="button"
                  onClick={handleDismissCompleted}
                  title="Dismiss ITE banner"
                  aria-label="Dismiss ITE banner"
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white border border-white/15 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable What to Expect + Two-Day Schedule & Resident Roster */}
        {showSchedule && (
          <div className="mt-4 pt-4 border-t border-white/15 space-y-3.5 animate-fade-in">
            {/* What to Expect Card */}
            <div className="rounded-2xl p-4 bg-indigo-950/60 border border-indigo-400/30">
              <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider text-amber-300 mb-2.5 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-300" />
                What to Expect
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {ITE_WHAT_TO_EXPECT.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-bold text-white"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-Day Session Roster Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ITE_SESSIONS.map((session) => {
                const status = session.id === 'oct20' ? session1Status : session2Status;
                const isUserSession = matchedAssignment?.session.id === session.id;

                return (
                  <div
                    key={session.id}
                    className={`rounded-2xl p-4 border transition-all ${
                      isUserSession
                        ? 'bg-white/15 border-amber-400/50 shadow-inner'
                        : 'bg-black/20 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm sm:text-base text-white">
                            {session.fullDateLabel} @ {session.timeLabel}
                          </h4>
                          {isUserSession && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase">
                              Your Day
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-indigo-200 font-semibold">
                          {session.location} · {session.doctors.length} Residents
                        </p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-indigo-100 shrink-0">
                        {status.isCompleted
                          ? 'ITE Completed 🎉'
                          : status.isInProgress
                          ? 'In Progress'
                          : `${status.days}d ${status.hours}h left`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {session.doctors.map((doc) => {
                        const isMe = isDoctorSelfMatch(doc);
                        const adviseeMatch = isMyAdvisee(doc);
                        return (
                          <span
                            key={doc.display}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              isMe
                                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-sm font-black'
                                : adviseeMatch
                                ? 'bg-emerald-400/25 text-emerald-100 border border-emerald-300/50 ring-1 ring-emerald-400/30 font-black'
                                : 'bg-white/10 text-indigo-100 border border-white/10'
                            }`}
                          >
                            <span>{doc.display}</span>
                            {adviseeMatch && !isMe && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded bg-emerald-400/30 text-emerald-200">
                                Advisee
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
