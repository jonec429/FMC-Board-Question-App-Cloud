'use client';

import React, { useState, useEffect } from 'react';
import { getQotdHistory, QotdHistoryItem } from '@/lib/qotd';
import { Loader2, ChevronDown, ChevronUp } from './AppIcons';

interface QotdHistoryProps {
  onBack: () => void;
}

export default function QotdHistory({ onBack }: QotdHistoryProps) {
  const [items, setItems] = useState<QotdHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await getQotdHistory(0, 20);
        setItems(result.items);
        setHasMore(result.hasMore);
      } catch (e) {
        console.error('Failed to load QOTD history:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getQotdHistory(items.length, 20);
      setItems(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
    } catch (e) {
      console.error('Failed to load more QOTD history:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Past QOTDs...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 font-bold text-sm">No past QOTDs available yet.</p>
        <p className="text-slate-300 text-xs mt-1">Questions will appear here after the first weekday.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isExpanded = expandedId === item.question.id;
        const correctPct = item.stats
          ? Math.round((item.stats.correct / item.stats.total) * 100)
          : null;

        // Top reactions (non-zero, sorted by count)
        const topReactions = Object.entries(item.reactions)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        return (
          <div
            key={`${item.question.id}-${item.index}`}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
          >
            {/* Collapsed Card */}
            <button
              onClick={() => toggleExpand(item.question.id)}
              className="w-full text-left p-4 focus:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-black text-indigo-500">{item.displayDate}</span>
                    {topReactions.length > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        {topReactions.map(([emoji, count]) => (
                          <span key={emoji} className="flex items-center gap-0.5 text-slate-400">
                            <span className="text-sm">{emoji}</span>
                            <span className="font-bold">{count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={`text-sm font-bold text-slate-700 leading-snug ${!isExpanded ? 'line-clamp-2' : ''}`}>
                    {item.question.question_text}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {/* Correct answer inline */}
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                      ✓ {String.fromCharCode(65 + item.question.correct_index)}. {(item.question.options as string[])[item.question.correct_index]?.substring(0, 60)}{((item.question.options as string[])[item.question.correct_index]?.length || 0) > 60 ? '...' : ''}
                    </span>
                    {/* Stats */}
                    {correctPct !== null && (
                      <span className="text-xs font-bold text-slate-400">
                        {correctPct}% correct · {item.stats!.total} responses
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 mt-1">
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-300" />
                    : <ChevronDown className="w-4 h-4 text-slate-300" />
                  }
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-slate-50">
                {/* All answer choices */}
                <div className="space-y-1.5 pt-3">
                  {(item.question.options as string[]).map((opt: string, oi: number) => (
                    <div
                      key={oi}
                      className={`px-3 py-2 rounded-xl text-sm font-medium ${
                        oi === item.question.correct_index
                          ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100'
                          : 'text-slate-500 bg-slate-50'
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}. {opt}
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                {item.question.explanation && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Explanation</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.question.explanation}</p>
                  </div>
                )}

                {/* Stats bar */}
                {item.stats && item.stats.total > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cohort Performance</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.round((item.stats.correct / item.stats.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-slate-600 tabular-nums">
                        {Math.round((item.stats.correct / item.stats.total) * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.stats.correct} correct · {item.stats.incorrect} incorrect · {item.stats.total} total
                    </p>
                  </div>
                )}

                {/* Reactions */}
                {Object.keys(item.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {['🤯', '🤨', '👍', '🥱', '😴'].map(emoji => {
                      const count = item.reactions[emoji] || 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={emoji}
                          className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1 text-xs"
                        >
                          <span>{emoji}</span>
                          <span className="font-bold text-slate-600">{count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load More Past QOTDs'
          )}
        </button>
      )}
    </div>
  );
}
