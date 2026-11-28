'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Trophy, Lock, Loader2, CheckCircle } from './AppIcons';
import { UserBadge } from '@/lib/types';

interface BadgeRow {
  id?: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: string | null;
}

interface AchievementsModalProps {
  /** The user's earned badges (already loaded on the dashboard). */
  userBadges: UserBadge[];
  onClose: () => void;
}

export type AchievementCategoryKey = 'qotd' | 'blueprint' | 'practice' | 'milestones';

export function categorizeBadge(badge: { name: string; type?: string | null }): AchievementCategoryKey {
  const n = (badge.name || '').toLowerCase();
  if (badge.type === 'qotd') return 'qotd';
  if (
    badge.type === 'general' ||
    n.includes('leaderboard') ||
    n.includes('podium') ||
    n.includes('top of the class') ||
    n.includes('has-been') ||
    n.includes('century club') ||
    n.includes('ap milestone') ||
    n.includes('graduation ready') ||
    n.includes('conference regular') ||
    n.includes('advisor check-in')
  ) {
    return 'milestones';
  }
  if (
    n.includes('care continuum') ||
    n.includes('preventive') ||
    n.includes('acute specialist') ||
    n.includes('chronic care') ||
    n.includes('triage ace') ||
    n.includes('foundations scholar') ||
    n.includes('systems explorer') ||
    n.includes('topic master') ||
    n.includes('pearl diver') ||
    n.includes('repeat master') ||
    n.includes('ite sprint')
  ) {
    return 'blueprint';
  }
  return 'practice';
}

export const ACHIEVEMENT_GROUPS: { key: AchievementCategoryKey; label: string }[] = [
  { key: 'qotd', label: 'Daily Question (QOTD)' },
  { key: 'blueprint', label: 'ABFM Care Dimensions & Systems' },
  { key: 'practice', label: 'Practice, Flashcards & Growth' },
  { key: 'milestones', label: 'Residency & AP Milestones' },
];

/**
 * Shows the full achievement catalog — earned badges in color, locked ones muted
 * with their "how to unlock" description visible. The catalog is the `badges`
 * table; any earned badge missing from it (e.g. a dynamically-created Topic Master)
 * is merged in so it still appears.
 */
export default function AchievementsModal({ userBadges, onClose }: AchievementsModalProps) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<BadgeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('id, name, description, icon, type');
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setCatalog((data as BadgeRow[]) || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const earnedByName = new Map<string, any>();
  userBadges.forEach((b) => {
    const name = b?.badges?.name || b?.name;
    if (name) earnedByName.set(name, b);
  });

  // Catalog ∪ earned-not-in-catalog (e.g. dynamic Topic Master badges).
  const merged: BadgeRow[] = [...catalog];
  userBadges.forEach((b) => {
    const name = b?.badges?.name || b?.name;
    if (name && !merged.some((m) => m.name === name)) {
      merged.push({
        name,
        description: b?.badges?.description ?? b.description ?? null,
        icon: b?.badges?.icon ?? b.icon ?? null,
        type: b?.badges?.type ?? b.type ?? null,
      });
    }
  });

  const earnedCount = merged.filter((m) => earnedByName.has(m.name)).length;
  const totalCount = merged.length;
  const lockedCount = Math.max(0, totalCount - earnedCount);
  const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  const sortFn = (a: BadgeRow, b: BadgeRow) => {
    const ea = earnedByName.has(a.name) ? 0 : 1;
    const eb = earnedByName.has(b.name) ? 0 : 1;
    if (ea !== eb) return ea - eb; // earned first
    return a.name.localeCompare(b.name);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-500 dark:text-yellow-400 rounded-2xl">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">Achievements</h2>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {loading ? 'Loading…' : `${earnedCount} of ${totalCount} unlocked (${pct}%)`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!loading && !error && totalCount > 0 && (
            <div className="space-y-3">
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'all' as const, label: `All (${totalCount})` },
                  { id: 'earned' as const, label: `Earned (${earnedCount})` },
                  { id: 'locked' as const, label: `To Unlock (${lockedCount})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilter(pill.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      filter === pill.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading achievements…</span>
            </div>
          ) : error ? (
            <div className="text-center text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-2xl p-4">
              Couldn&apos;t load achievements: {error}
            </div>
          ) : totalCount === 0 ? (
            <p className="text-center text-sm font-bold text-slate-400 dark:text-slate-500 py-8">No achievements available yet.</p>
          ) : (
            ACHIEVEMENT_GROUPS.map((g) => {
              const items = merged
                .filter((m) => categorizeBadge(m) === g.key)
                .filter((m) => {
                  const isEarned = earnedByName.has(m.name);
                  if (filter === 'earned') return isEarned;
                  if (filter === 'locked') return !isEarned;
                  return true;
                })
                .sort(sortFn);
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{g.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((badge) => {
                      const earned = earnedByName.get(badge.name);
                      return (
                        <div
                          key={badge.name}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                            earned 
                              ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60' 
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div
                            className={`relative flex items-center justify-center w-11 h-11 rounded-xl text-2xl shrink-0 ${
                              earned 
                                ? 'bg-white dark:bg-slate-800 shadow-sm' 
                                : 'bg-slate-200/60 dark:bg-slate-700/60 grayscale opacity-55'
                            }`}
                          >
                            {badge.icon || '🏅'}
                            {!earned ? (
                              <div className="absolute -bottom-1 -right-1 bg-slate-400 dark:bg-slate-600 text-white rounded-full p-1">
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                            ) : (
                              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                                <CheckCircle className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-black text-sm ${earned ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'}`}>
                              {badge.name}
                            </p>
                            <p className={`text-xs font-medium mt-0.5 ${earned ? 'text-indigo-600/80 dark:text-indigo-400/80' : 'text-slate-400 dark:text-slate-500'}`}>
                              {badge.description || 'Keep practicing to unlock this achievement.'}
                            </p>
                            {earned?.earned_at && (
                              <p className="text-[10px] font-bold text-indigo-400 dark:text-indigo-400/80 mt-1">
                                Earned {new Date(earned.earned_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
