'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Trophy, Lock, Loader2 } from './AppIcons';

interface BadgeRow {
  id?: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: string | null;
}

interface AchievementsModalProps {
  /** The user's earned badges (already loaded on the dashboard). */
  userBadges: any[];
  onClose: () => void;
}

/**
 * Shows the full achievement catalog — earned badges in color, locked ones greyed
 * out with their "how to earn" description visible. The catalog is the `badges`
 * table; any earned badge missing from it (e.g. a dynamically-created Topic Master)
 * is merged in so it still appears.
 */
export default function AchievementsModal({ userBadges, onClose }: AchievementsModalProps) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<BadgeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    if (b?.name) earnedByName.set(b.name, b);
  });

  // Catalog ∪ earned-not-in-catalog (e.g. dynamic Topic Master badges).
  const merged: BadgeRow[] = [...catalog];
  userBadges.forEach((b) => {
    if (b?.name && !merged.some((m) => m.name === b.name)) {
      merged.push({
        name: b.name,
        description: b.description ?? null,
        icon: b.icon ?? null,
        type: b.type ?? null,
      });
    }
  });

  const groupOf = (t: string | null) => (t === 'qotd' ? 'qotd' : 'block');
  const groups: { key: string; label: string }[] = [
    { key: 'qotd', label: 'Daily Question' },
    { key: 'block', label: 'Practice & Milestones' },
  ];

  const earnedCount = merged.filter((m) => earnedByName.has(m.name)).length;
  const totalCount = merged.length;

  const sortFn = (a: BadgeRow, b: BadgeRow) => {
    const ea = earnedByName.has(a.name) ? 0 : 1;
    const eb = earnedByName.has(b.name) ? 0 : 1;
    if (ea !== eb) return ea - eb; // earned first
    return a.name.localeCompare(b.name);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-50 text-yellow-500 rounded-2xl">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Achievements</h2>
              <p className="text-xs font-bold text-slate-400">
                {loading ? 'Loading…' : `${earnedCount} of ${totalCount} earned`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading achievements…</span>
            </div>
          ) : error ? (
            <div className="text-center text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4">
              Couldn&apos;t load achievements: {error}
            </div>
          ) : totalCount === 0 ? (
            <p className="text-center text-sm font-bold text-slate-400 py-8">No achievements available yet.</p>
          ) : (
            groups.map((g) => {
              const items = merged.filter((m) => groupOf(m.type) === g.key).sort(sortFn);
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{g.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((badge) => {
                      const earned = earnedByName.get(badge.name);
                      return (
                        <div
                          key={badge.name}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                            earned ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div
                            className={`relative flex items-center justify-center w-11 h-11 rounded-xl text-2xl shrink-0 ${
                              earned ? 'bg-white shadow-sm' : 'bg-slate-200/60 grayscale opacity-50'
                            }`}
                          >
                            {badge.icon || '🏅'}
                            {!earned && (
                              <div className="absolute -bottom-1 -right-1 bg-slate-400 text-white rounded-full p-1">
                                <Lock className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-black text-sm ${earned ? 'text-indigo-800' : 'text-slate-500'}`}>
                              {badge.name}
                            </p>
                            <p className={`text-xs font-medium mt-0.5 ${earned ? 'text-indigo-600/80' : 'text-slate-400'}`}>
                              {badge.description || 'Keep going to unlock this one.'}
                            </p>
                            {earned?.earned_at && (
                              <p className="text-[10px] font-bold text-indigo-400 mt-1">
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
