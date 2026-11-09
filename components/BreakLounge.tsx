'use client';

import React, { useState, useEffect } from 'react';
import { Coffee, Waves, Heart, Apple, BatteryCharging, Clock, ArrowRight, Sparkles, AlertTriangle, Shield } from 'lucide-react';

interface BreakLoungeProps {
  completedSection: number;
  totalSections: number;
  pooledBreakTimeLeft: number;
  onEndBreak: () => void;
  nextSectionQuestionsCount: number;
  nextSectionTimeMinutes: number;
  onEmergencyPause?: () => void;
}

interface BreakTheme {
  id: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  tip: string;
  gradient: string;
  accentBg: string;
  textColor: string;
}

const BREAK_THEMES: BreakTheme[] = [
  {
    id: 'coffee',
    emoji: '☕',
    icon: Coffee,
    title: 'The Residency Coffee Lounge',
    tagline: 'Hydrate, caffeinate, and breathe.',
    tip: 'Step away from the screen, grab some water or coffee, unclench your jaw, and roll your shoulders back. You conquered this block!',
    gradient: 'from-amber-500/15 via-orange-500/10 to-transparent dark:from-amber-950/40 dark:via-orange-950/20',
    accentBg: 'bg-amber-500 text-white shadow-amber-200 dark:shadow-none',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'beach',
    emoji: '🏖️',
    icon: Waves,
    title: 'Mental Reset Shoreline',
    tagline: 'Rest your eyes on the horizon.',
    tip: 'Look 20 feet away for 20 seconds to relieve ciliary muscle eye strain. Active mental decompression restores cognitive agility for the next block.',
    gradient: 'from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-950/40 dark:via-blue-950/20',
    accentBg: 'bg-cyan-600 text-white shadow-cyan-200 dark:shadow-none',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'breath',
    emoji: '🧘',
    icon: Heart,
    title: 'Parasympathetic Reset Station',
    tagline: 'Box Breathing: Inhale 4s • Hold 4s • Exhale 4s • Hold 4s.',
    tip: 'Three cycles of slow diaphragmatic breathing drop your systemic cortisol, lower sympathetic tone, and sharpen executive clinical recall.',
    gradient: 'from-purple-500/15 via-indigo-500/10 to-transparent dark:from-purple-950/40 dark:via-indigo-950/20',
    accentBg: 'bg-purple-600 text-white shadow-purple-200 dark:shadow-none',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'fuel',
    emoji: '🍎',
    icon: Apple,
    title: 'Brain Fuel Depot',
    tagline: 'Your brain consumes 20% of your metabolic energy.',
    tip: 'A small handful of almonds, an apple, or a sip of cold water prevents hypoglycemia and late-exam decision fatigue.',
    gradient: 'from-emerald-500/15 via-teal-500/10 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20',
    accentBg: 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'battery',
    emoji: '🔋',
    icon: BatteryCharging,
    title: 'Neural Supercharger',
    tagline: 'Stamina is a skill built one block at a time.',
    tip: "You're building real board exam endurance. Pacing is everything—trust your instincts and clinical training.",
    gradient: 'from-blue-500/15 via-indigo-500/10 to-transparent dark:from-blue-950/40 dark:via-indigo-950/20',
    accentBg: 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
];

export default function BreakLounge({
  completedSection,
  totalSections,
  pooledBreakTimeLeft,
  onEndBreak,
  nextSectionQuestionsCount,
  nextSectionTimeMinutes,
  onEmergencyPause,
}: BreakLoungeProps) {
  const [themeIndex, setThemeIndex] = useState(() => (completedSection - 1) % BREAK_THEMES.length);

  // Automatically cycle themes periodically for delight
  useEffect(() => {
    const timer = setInterval(() => {
      setThemeIndex((prev) => (prev + 1) % BREAK_THEMES.length);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const currentTheme = BREAK_THEMES[themeIndex];
  const ThemeIcon = currentTheme.icon;

  // Format MM:SS or -MM:SS if expired
  const isExpired = pooledBreakTimeLeft <= 0;
  const absSeconds = Math.abs(pooledBreakTimeLeft);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;
  const formattedTime = `${isExpired ? '-' : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 animate-fade-in font-sans">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all">
        {/* Top Header Banner */}
        <div className={`p-6 sm:p-8 bg-gradient-to-br ${currentTheme.gradient} border-b border-slate-100 dark:border-slate-800 transition-colors`}>
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-full bg-slate-900/10 dark:bg-white/10 text-slate-800 dark:text-slate-200 backdrop-blur-sm">
              Section {completedSection} of {totalSections} Complete
            </span>

            <button
              onClick={() => setThemeIndex((prev) => (prev + 1) % BREAK_THEMES.length)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title="Change Break Theme"
            >
              <span>{currentTheme.emoji}</span>
              <span className="hidden sm:inline">Change Theme</span>
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl ${currentTheme.accentBg} flex items-center justify-center shrink-0 shadow-lg text-2xl animate-bounce-gentle`}>
              <ThemeIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentTheme.title}
              </h2>
              <p className={`text-sm sm:text-base font-bold mt-1 ${currentTheme.textColor}`}>
                {currentTheme.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Pooled Break Clock */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-950/70 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <Clock className="w-4 h-4" />
              <span>Pooled Break Time Remaining</span>
            </div>

            <div className={`text-5xl sm:text-6xl font-black tracking-tight font-mono ${isExpired ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
              {formattedTime}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {isExpired ? (
                <span className="text-red-500 font-bold">
                  ⚠️ Your pooled break time has expired. Any additional time taken is deducting from your next section clock!
                </span>
              ) : (
                <>Take as much or as little time as you need. Unused break minutes will carry over to subsequent breaks.</>
              )}
            </p>
          </div>

          {/* Clinical Stamina Tip Card */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Resident Wellness Tip:</strong> {currentTheme.tip}
            </p>
          </div>

          {/* Action Row */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onEndBreak}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-98 shadow-xl shadow-emerald-200 dark:shadow-none cursor-pointer"
            >
              <span>Begin Section {completedSection + 1}</span>
              <span className="text-xs font-normal text-emerald-100 hidden sm:inline">
                ({nextSectionQuestionsCount} Qs • {nextSectionTimeMinutes} min)
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {onEmergencyPause && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onEmergencyPause}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  <span>Need to leave? Freeze &amp; Pause Exam</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
