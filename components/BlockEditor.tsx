import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, AlertTriangle, Sparkles, Save, Loader2, X, Search, Clock, FileText } from './AppIcons';
import { partitionYears, RECENT_ITE_YEAR_WINDOW, LEGACY_WARNING_TITLE, LEGACY_WARNING_BODY } from '@/lib/questionFilters';

export interface Block {
  id: string;
  title: string;
  block_type?: string;
  question_count?: number;
  sort_order?: number;
  category_filters?: string[];
  keyword_filters?: string[];
  question_ids?: string[];
}

export interface Question {
  id: string;
  question_text: string;
  category: string;
  year: string;
  options: string[];
  correct_index: number;
}

export default function BlockEditor({
  block,
  allQuestions,
  residentsCount,
  onBack,
  onSaved,
}: {
  block: Block;
  allQuestions: Question[];
  residentsCount: number;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  // Selected question IDs in this draft (start from saved value)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(block.question_ids || []));
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Legacy ITE opt-in (admin must confirm to see/include questions > 3 years old)
  const [showLegacyYears, setShowLegacyYears] = useState(false);
  const [showLegacyWarning, setShowLegacyWarning] = useState(false);

  // Distinct filter dimensions, derived from the live question bank
  const { categories, years } = useMemo(() => {
    const cs = new Set<string>();
    const ys = new Set<string>();
    allQuestions.forEach(q => {
      if (q.category) cs.add(q.category);
      if (q.year) ys.add(q.year);
    });
    return {
      categories: Array.from(cs).sort(),
      years: Array.from(ys).sort().reverse(),
    };
  }, [allQuestions]);

  // Recent / legacy split based on the 3-year ITE freshness window
  const { recent: recentYears, legacy: legacyYears } = useMemo(
    () => partitionYears(years, RECENT_ITE_YEAR_WINDOW),
    [years]
  );

  // Apply filters — when legacy isn't revealed, hide all older-year questions entirely
  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const legacySet = new Set(legacyYears);
    return allQuestions.filter(q => {
      if (filterCat && q.category !== filterCat) return false;
      if (filterYear && q.year !== filterYear) return false;
      // Hide legacy-year questions by default unless explicitly revealed
      if (!showLegacyYears && legacySet.has(q.year)) return false;
      if (term && !q.question_text.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allQuestions, filterCat, filterYear, search, legacyYears, showLegacyYears]);

  const requestShowLegacyYears = () => {
    if (showLegacyYears) {
      setShowLegacyYears(false);
      // Reset year filter if it was pointing at a legacy year
      if (legacyYears.includes(filterYear)) setFilterYear('');
    } else {
      setShowLegacyWarning(true);
    }
  };
  const confirmShowLegacyYears = () => {
    setShowLegacyYears(true);
    setShowLegacyWarning(false);
  };

  const targetCount = block.question_count || 40;
  const isDirty = useMemo(() => {
    const a = block.question_ids || [];
    const b = selectedIds;
    if (a.length !== b.size) return true;
    for (const id of a) if (!b.has(id)) return true;
    return false;
  }, [block.question_ids, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoPopulate = () => {
    let pool = filteredQuestions;
    if (filterCat === '' && filterYear === '' && !search && block.category_filters && block.category_filters.length > 0) {
      pool = allQuestions.filter(q => block.category_filters!.includes(q.category));
    }
    if (!showLegacyYears) {
      const legacySet = new Set(legacyYears);
      pool = pool.filter(q => !legacySet.has(q.year));
    }
    const sorted = [...pool].sort((a, b) => (b.year || '').localeCompare(a.year || ''));
    const picked = sorted.slice(0, targetCount);
    setSelectedIds(new Set(picked.map(q => q.id)));
  };

  const save = async () => {
    if (residentsCount > 0) {
      const ok = window.confirm(
        `${residentsCount} resident attempt${residentsCount !== 1 ? 's have' : ' has'} already been recorded for "${block.title}". ` +
        `Changing the question list may break cross-resident comparison for past attempts. Continue?`
      );
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    const ids = Array.from(selectedIds);
    const { error: updateErr } = await supabase
      .from('blocks')
      .update({ question_ids: ids })
      .eq('id', block.id);
    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }
    setSavedNotice(true);
    setSaving(false);
    await onSaved();
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            ← Back to Blocks
          </button>
          {savedNotice && (
            <span className="text-xs font-black text-emerald-600 flex items-center gap-1 animate-in fade-in">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{block.title}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${selectedIds.size === targetCount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {selectedIds.size} / {targetCount} selected
              </span>
              {block.category_filters && block.category_filters.length > 0 && (
                <span className="text-xs font-bold text-slate-400">
                  Categories: {block.category_filters.join(', ')}
                </span>
              )}
              {residentsCount > 0 && (
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {residentsCount} resident attempt{residentsCount !== 1 ? 's' : ''} already recorded
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={autoPopulate}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"
              title="Auto-populate from current filters (or block's saved categories if none applied)"
            >
              <Sparkles className="w-4 h-4" />
              Auto-populate
            </button>
            <button
              onClick={save}
              disabled={!isDirty || saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-100"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl font-bold flex items-center gap-3">
          <X className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text…"
            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700 min-w-[180px]"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700 min-w-[140px]"
        >
          <option value="">{showLegacyYears ? 'All years' : `Recent ${RECENT_ITE_YEAR_WINDOW} years`}</option>
          {recentYears.map(y => <option key={y} value={y}>{y}</option>)}
          {showLegacyYears && legacyYears.map(y => (
            <option key={y} value={y}>{y} (legacy)</option>
          ))}
        </select>
        <button
          onClick={() => { setFilterCat(''); setFilterYear(''); setSearch(''); }}
          className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center justify-between px-2 flex-wrap gap-2">
        <p className="text-xs font-bold text-slate-400">
          Showing {filteredQuestions.length} of {allQuestions.length} questions · {selectedIds.size} selected
        </p>
        {legacyYears.length > 0 && (
          <button
            type="button"
            onClick={requestShowLegacyYears}
            className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${showLegacyYears ? 'text-slate-500 hover:text-slate-700' : 'text-amber-600 hover:text-amber-700'}`}
          >
            <Clock className="w-3 h-3" />
            {showLegacyYears
              ? `Hide legacy ITEs (${legacyYears.length})`
              : `Show legacy ITEs (${legacyYears.length})`}
          </button>
        )}
      </div>

      {/* Question Picker List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
          {filteredQuestions.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-bold">No questions match your filters.</p>
            </div>
          )}
          {filteredQuestions.map(q => {
            const selected = selectedIds.has(q.id);
            return (
              <label
                key={q.id}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-all hover:bg-slate-50/70 ${selected ? 'bg-blue-50/40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelect(q.id)}
                  className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${selected ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                    {q.question_text.slice(0, 180)}{q.question_text.length > 180 ? '…' : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{q.category}</span>
                    <span className="text-[10px] font-bold text-slate-300">·</span>
                    <span className={`text-[10px] font-bold ${legacyYears.includes(q.year) ? 'text-amber-600' : 'text-slate-400'}`}>
                      {q.year}{legacyYears.includes(q.year) ? ' · legacy' : ''}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300">·</span>
                    <span className="text-[10px] font-bold text-slate-400">{q.options?.length || 0} options</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Legacy ITE Year Warning Modal */}
      {showLegacyWarning && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">{LEGACY_WARNING_TITLE}</h3>
              </div>
            </div>
            <div className="p-6 text-sm font-medium text-slate-600 leading-relaxed">
              {LEGACY_WARNING_BODY}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowLegacyWarning(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmShowLegacyYears}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
              >
                Yes, show legacy years
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
