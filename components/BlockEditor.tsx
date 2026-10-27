'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, AlertTriangle, Sparkles, Save, Loader2, X, ChevronLeft } from './AppIcons';
import QuestionPicker from './QuestionPicker';
import { Question } from '@/lib/types';

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
  const [selectedIds, setSelectedIds] = useState<string[]>(block.question_ids || []);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetCount = block.question_count || 40;

  const isDirty = useMemo(() => {
    const orig = block.question_ids || [];
    if (orig.length !== selectedIds.length) return true;
    const origSet = new Set(orig);
    for (const id of selectedIds) {
      if (!origSet.has(id)) return true;
    }
    return false;
  }, [block.question_ids, selectedIds]);

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
    const { error: updateErr } = await supabase
      .from('blocks')
      .update({ question_ids: selectedIds })
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
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Blocks
          </button>
          {savedNotice && (
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <CheckCircle className="w-4 h-4" /> Changes Saved
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{block.title}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                selectedIds.length === targetCount
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}>
                {selectedIds.length} / {targetCount} Questions Selected
              </span>

              {block.category_filters && block.category_filters.length > 0 && (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-400">
                  Block Categories: {block.category_filters.join(', ')}
                </span>
              )}

              {residentsCount > 0 && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {residentsCount} resident attempt{residentsCount !== 1 ? 's' : ''} already recorded
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!isDirty || saving}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-100 dark:shadow-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Block Questions
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-700 dark:text-red-300 p-4 rounded-2xl font-bold flex items-center gap-3">
          <X className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Robust Unified Question Picker */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <QuestionPicker
          allQuestions={allQuestions}
          selectedQuestionIds={selectedIds}
          onChangeSelectedIds={setSelectedIds}
          targetCount={targetCount}
          initialCategoryFilters={block.category_filters || []}
          maxHeight="max-h-[620px]"
        />
      </div>
    </div>
  );
}
