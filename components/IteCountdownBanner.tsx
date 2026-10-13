'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, GraduationCap, Users, Info, CheckCircle } from './AppIcons';
import { Profile, User } from '@/lib/types';

export interface IteSession {
  id: 'oct20' | 'oct28';
  label: string;
  shortDate: string;
  fullDateLabel: string;
  timeLabel: string;
  location: string;
  isoTarget: string;
  doctors: {
    display: string;
    lastName: string;
    firstInitial?: string;
  }[];
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
    doctors: [
      { display: 'Dr. Carson', lastName: 'carson' },
      { display: 'Dr. Haddad', lastName: 'haddad' },
      { display: 'Dr. Hobgood', lastName: 'hobgood' },
      { display: 'Dr. Keenan', lastName: 'keenan' },
      { display: 'Dr. A. Kemmer', lastName: 'kemmer', firstInitial: 'a' },
      { display: 'Dr. B. Kemmer', lastName: 'kemmer', firstInitial: 'b' },
      { display: 'Dr. Klem', lastName: 'klem' },
      { display: 'Dr. Louis', lastName: 'louis' },
      { display: 'Dr. Nguyen', lastName: 'nguyen' },
      { display: 'Dr. Parker', lastName: 'parker' },
      { display: 'Dr. Robak', lastName: 'robak' },
      { display: 'Dr. Roland', lastName: 'roland' },
      { display: 'Dr. Saavedra', lastName: 'saavedra' },
      { display: 'Dr. Simon', lastName: 'simon' },
      { display: 'Dr. Smith', lastName: 'smith' },
      { display: 'Dr. Thiravialingam', lastName: 'thiravialingam' },
      { display: 'Dr. Wilson', lastName: 'wilson' },
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
    doctors: [
      { display: 'Dr. Ball', lastName: 'ball' },
      { display: 'Dr. Boettcher', lastName: 'boettcher' },
      { display: 'Dr. Brock', lastName: 'brock' },
      { display: 'Dr. Celmins', lastName: 'celmins' },
      { display: 'Dr. Dean', lastName: 'dean' },
      { display: 'Dr. Doerger', lastName: 'doerger' },
      { display: 'Dr. Fedotova', lastName: 'fedotova' },
      { display: 'Dr. Frank', lastName: 'frank' },
      { display: 'Dr. Lemus', lastName: 'lemus' },
      { display: 'Dr. Martinez', lastName: 'martinez' },
      { display: 'Dr. Miller', lastName: 'miller' },
      { display: 'Dr. Parmer', lastName: 'parmer' },
      { display: 'Dr. Perez', lastName: 'perez' },
      { display: 'Dr. Shih', lastName: 'shih' },
      { display: 'Dr. Shipp', lastName: 'shipp' },
      { display: 'Dr. Sollee', lastName: 'sollee' },
      { display: 'Dr. Varni', lastName: 'varni' },
    ],
  },
];

interface TimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isToday: boolean;
}

function getTimeRemaining(isoTarget: string, nowMs: number): TimeRemaining {
  const targetDate = new Date(isoTarget);
  const targetMs = targetDate.getTime();
  const diff = targetMs - nowMs;

  const nowDate = new Date(nowMs);
  const isToday =
    nowDate.getFullYear() === targetDate.getFullYear() &&
    nowDate.getMonth() === targetDate.getMonth() &&
    nowDate.getDate() === targetDate.getDate();

  if (diff <= 0) {
    return {
      totalMs: diff,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      isToday,
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
    isPast: false,
    isToday,
  };
}

function extractUserIdentity(user: User, profile: Profile | null): { lastName: string; firstInitial: string } {
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

  if (!lastName && user?.email) {
    const localPart = user.email.split('@')[0] || '';
    const emailTokens = localPart
      .replace(/[0-9]/g, '')
      .split(/[._-]+/)
      .filter(Boolean);
    if (emailTokens.length >= 2) {
      lastName = emailTokens[emailTokens.length - 1].toLowerCase();
      if (!firstInitial) {
        firstInitial = emailTokens[0][0]?.toLowerCase() || '';
      }
    } else if (emailTokens.length === 1) {
      lastName = emailTokens[0].toLowerCase();
    }
  }

  return { lastName, firstInitial };
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

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { lastName, firstInitial } = useMemo(
    () => extractUserIdentity(user, profile),
    [user, profile]
  );

  const isStaffOrFaculty = effectiveRole === 'faculty' || effectiveRole === 'gme_staff';

  // Match resident to their assigned session and doctor entry
  const matchedAssignment = useMemo(() => {
    if (!lastName || isStaffOrFaculty) return null;

    for (const session of ITE_SESSIONS) {
      for (const doc of session.doctors) {
        if (doc.lastName === lastName) {
          if (doc.firstInitial && firstInitial && doc.firstInitial !== firstInitial) {
            continue;
          }
          return { session, doctor: doc };
        }
      }
    }
    return null;
  }, [lastName, firstInitial, isStaffOrFaculty]);

  // Hide banner completely after Oct 28, 2026 5:00 PM EDT
  const finalCutoffMs = new Date('2026-10-28T17:00:00-04:00').getTime();
  if (nowMs > finalCutoffMs) {
    return null;
  }

  const session1Remaining = getTimeRemaining(ITE_SESSIONS[0].isoTarget, nowMs);
  const session2Remaining = getTimeRemaining(ITE_SESSIONS[1].isoTarget, nowMs);

  // Determine primary session to count down to
  const primarySession = matchedAssignment
    ? matchedAssignment.session
    : !session1Remaining.isPast
    ? ITE_SESSIONS[0]
    : ITE_SESSIONS[1];

  const primaryRemaining =
    primarySession.id === 'oct20' ? session1Remaining : session2Remaining;

  const isDoctorMatch = (doc: { lastName: string; firstInitial?: string }) => {
    if (!lastName || effectiveRole === 'faculty') return false;
    if (doc.lastName !== lastName) return false;
    if (doc.firstInitial && firstInitial && doc.firstInitial !== firstInitial) return false;
    return true;
  };

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
                2026 ABFM ITE Countdown
              </span>

              {matchedAssignment ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  Assigned: {matchedAssignment.doctor.display}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-indigo-200 border border-white/15">
                  2 Exam Dates Scheduled
                </span>
              )}

              {/* Hover or Click "What to Expect" Trigger */}
              <div
                className="relative inline-block"
                onMouseEnter={() => setShowExpectHover(true)}
                onMouseLeave={() => setShowExpectHover(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowSchedule(prev => !prev)}
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
                      What to Expect on Exam Day
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-100 font-medium">
                      {ITE_WHAT_TO_EXPECT.map(item => (
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

            {matchedAssignment ? (
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
            ) : (
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  In-Training Exam Schedule · FMC Conference Room A
                </h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs sm:text-sm">
                  <div className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${
                    session1Remaining.isPast
                      ? 'bg-white/5 border-white/10 text-slate-400'
                      : 'bg-white/10 border-white/20 text-white'
                  }`}>
                    <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="font-bold">Tue, Oct 20 @ 7:15 AM</span>
                    <span className="text-[11px] text-indigo-200">
                      ({session1Remaining.isPast ? (session1Remaining.isToday ? 'Today' : 'Done') : `${session1Remaining.days}d ${session1Remaining.hours}h`})
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-xl border flex items-center gap-2 ${
                    session2Remaining.isPast
                      ? 'bg-white/5 border-white/10 text-slate-400'
                      : 'bg-white/10 border-white/20 text-white'
                  }`}>
                    <Calendar className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span className="font-bold">Wed, Oct 28 @ 7:15 AM</span>
                    <span className="text-[11px] text-indigo-200">
                      ({session2Remaining.isPast ? (session2Remaining.isToday ? 'Today' : 'Done') : `${session2Remaining.days}d ${session2Remaining.hours}h`})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Countdown + Schedule Toggle */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {!primaryRemaining.isPast ? (
              <div
                onClick={() => setShowSchedule(prev => !prev)}
                title="Click to view What to Expect & Full Schedule"
                className="flex items-center justify-center gap-1.5 sm:gap-2 bg-black/25 hover:bg-black/35 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 cursor-pointer transition-colors"
              >
                <div className="text-center min-w-[42px]">
                  <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                    {String(primaryRemaining.days).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                    Days
                  </div>
                </div>
                <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                <div className="text-center min-w-[42px]">
                  <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                    {String(primaryRemaining.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                    Hrs
                  </div>
                </div>
                <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                <div className="text-center min-w-[42px]">
                  <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-white">
                    {String(primaryRemaining.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                    Min
                  </div>
                </div>
                <span className="text-indigo-400 font-black text-base -mt-2">:</span>
                <div className="text-center min-w-[42px]">
                  <div className="text-lg sm:text-2xl font-black tabular-nums leading-none text-amber-300">
                    {String(primaryRemaining.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                    Sec
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-black text-xs sm:text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-300" />
                {primaryRemaining.isToday
                  ? 'Exam Day — Good Luck!'
                  : `${primarySession.shortDate} Session Completed`}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSchedule(prev => !prev)}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/15 transition-all cursor-pointer shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-indigo-200" />
              <span>{showSchedule ? 'Hide Details' : 'Details & Roster'}</span>
              {showSchedule ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
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
                {ITE_WHAT_TO_EXPECT.map(item => (
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
              {ITE_SESSIONS.map(session => {
                const rem = session.id === 'oct20' ? session1Remaining : session2Remaining;
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
                        <div className="flex items-center gap-2">
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
                        {rem.isPast
                          ? rem.isToday
                            ? 'Today'
                            : 'Completed'
                          : `${rem.days}d ${rem.hours}h left`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {session.doctors.map(doc => {
                        const isMe = isDoctorMatch(doc);
                        return (
                          <span
                            key={doc.display}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              isMe
                                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-sm font-black'
                                : 'bg-white/10 text-indigo-100 border border-white/10'
                            }`}
                          >
                            {doc.display}
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
