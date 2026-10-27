'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, AlertTriangle, Sparkles, Save, Loader2, X, ChevronLeft } from './AppIcons';
import { Printer, AlertCircle, FileText } from 'lucide-react';
import QuestionPicker from './QuestionPicker';
import PrintReviewModal from './PrintReviewModal';
import { Question, Block } from '@/lib/types';

export default function BlockEditor({
  block,
  allQuestions,
  residentsCount,
  allBlocks = [],
  onBack,
  onSaved,
}: {
  block: Block;
  allQuestions: Question[];
  residentsCount: number;
  allBlocks?: Block[];
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(block.question_ids || []);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const targetCount = block.question_count || 40;

  // Build map of questions used in other blocks for overlap detection
  const overlappingQuestionMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allBlocks.forEach(b => {
      if (b.id === block.id) return;
      // If block has academic_year, prefer blocks in the same academic year
      if (block.academic_year && b.academic_year && String(b.academic_year) !== String(block.academic_year)) {
        return;
      }
      (b.question_ids || []).forEach(qId => {
        if (!map[qId]) map[qId] = [];
        if (!map[qId].includes(b.title)) {
          map[qId].push(b.title);
        }
      });
    });
    return map;
  }, [allBlocks, block.id, block.academic_year]);

  // Questions currently selected as Question objects for the Print Packet
  const selectedQuestionObjects = useMemo(() => {
    const qMap = new Map(allQuestions.map(q => [q.id, q]));
    return selectedIds
      .map(id => qMap.get(id))
      .filter((q): q is Question => q !== undefined);
  }, [allQuestions, selectedIds]);

  // Count overlapping questions currently in this block's selection
  const selectedOverlapCount = useMemo(() => {
    return selectedIds.filter(id => (overlappingQuestionMap[id]?.length || 0) > 0).length;
  }, [selectedIds, overlappingQuestionMap]);

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

              {selectedOverlapCount > 0 && (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  {selectedOverlapCount} questions overlap with other blocks
                </span>
              )}

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

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Export / Print Review Packet Button */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              disabled={selectedIds.length === 0}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              title="Print question worksheets or faculty answer key"
            >
              <Printer className="w-4 h-4 text-indigo-500" />
              <span>Print Review Packet</span>
            </button>

            {/* Save Button */}
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

      {/* Robust Unified Question Picker with Overlap & Performance Stats */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <QuestionPicker
          allQuestions={allQuestions}
          selectedQuestionIds={selectedIds}
          onChangeSelectedIds={setSelectedIds}
          targetCount={targetCount}
          initialCategoryFilters={block.category_filters || []}
          overlappingQuestionMap={overlappingQuestionMap}
          maxHeight="max-h-[620px]"
        />
      </div>

      {/* Print / Export Modal */}
      {showPrintModal && (
        <PrintReviewModal
          title={block.title}
          questions={selectedQuestionObjects}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
