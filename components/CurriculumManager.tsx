import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Loader2, Database, Trash2, Calendar, CheckCircle, Save, X, Edit3, Sparkles, Archive } from './AppIcons';
import { AdminData } from '@/hooks/useAdminData';
import { partitionYears, RECENT_ITE_YEAR_WINDOW } from '@/lib/questionFilters';
import { getCurrentAcademicYear } from '@/lib/academicYear';
import BlockEditor from './BlockEditor'; // We will extract this or keep it here

interface CurriculumManagerProps {
  adminData: AdminData;
  onRefresh: () => Promise<void>;
}

export default function CurriculumManager({ adminData, onRefresh }: CurriculumManagerProps) {
  const { blocks, block_schedule, questions, results } = adminData;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Local state for inline edits
  const [editingDates, setEditingDates] = useState<string | null>(null);
  const [dateForm, setDateForm] = useState({ start: '', end: '' });
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Derived data
  const resultsCount = useMemo(() => {
    const counts = new Map<string, number>();
    results.forEach((r: any) => {
      counts.set(r.topic, (counts.get(r.topic) || 0) + 1);
    });
    return counts;
  }, [results]);

  const blockSortKey = (b: any): number => {
    if (b.sort_order != null) return b.sort_order;
    const t = b.title || '';
    if (/^demo/i.test(t)) return 9999;
    const m = t.match(/Block\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    if (/bonus/i.test(t)) return 500;
    return 1000;
  };

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => blockSortKey(a) - blockSortKey(b)), [blocks]);

  const getSchedule = (blockId: string) => block_schedule.find(s => s.block_id === blockId);

  // Auto-populate logic
  const uninitialized = sortedBlocks.filter(
    b => (!b.question_ids || b.question_ids.length === 0) && b.block_type !== 'demo'
  );

  const handleInitializeAll = async () => {
    if (!window.confirm(`Auto-populate ${uninitialized.length} block(s) using their existing category filters?`)) return;
    setInitializing(true);
    
    const allYearsInBank = Array.from(new Set(questions.map(q => q.year).filter(Boolean)));
    const { legacy } = partitionYears(allYearsInBank, RECENT_ITE_YEAR_WINDOW);
    const legacySet = new Set(legacy);

    let errorCount = 0;
    for (const block of uninitialized) {
      const cats = block.category_filters || [];
      if (cats.length === 0) continue;
      
      const matching = questions
        .filter(q => cats.includes(q.category) && !legacySet.has(q.year))
        .sort((a, b) => (b.year || '').localeCompare(a.year || ''))
        .slice(0, block.question_count || 40);
        
      const ids = matching.map(q => q.id);
      if (ids.length === 0) {
        errorCount++;
        continue;
      }
      await supabase.from('blocks').update({ question_ids: ids }).eq('id', block.id);
    }
    
    await onRefresh();
    setInitializing(false);
    if (errorCount > 0) alert(`${errorCount} blocks skipped (no matching questions found).`);
  };

  // Date Saving
  const handleSaveDates = async (blockId: string) => {
    setSaving(true);
    const existing = getSchedule(blockId);
    
    if (existing) {
      await supabase.from('block_schedule').update({
        start_date: dateForm.start,
        end_date: dateForm.end
      }).eq('id', existing.id);
    } else {
      await supabase.from('block_schedule').insert({
        block_id: blockId,
        start_date: dateForm.start,
        end_date: dateForm.end
      });
    }
    
    await onRefresh();
    setEditingDates(null);
    setSaving(false);
  };

  const handleCreateBlock = async () => {
    const title = window.prompt("Enter new block title (e.g., 'Block 15: Special'):");
    if (!title) return;
    await supabase.from('blocks').insert({
      title,
      block_type: 'standard',
      question_count: 40,
      academic_year: getCurrentAcademicYear(),
    });
    await onRefresh();
  };

  const handleDeleteBlock = async (blockId: string, title: string) => {
    const usageCount = resultsCount.get(title) || 0;
    if (usageCount > 0) {
      alert(`Cannot delete: ${usageCount} resident(s) have already recorded scores for this block. Please archive it instead.`);
      return;
    }
    if (!window.confirm(`Permanently delete '${title}'? This cannot be undone.`)) return;
    
    await supabase.from('blocks').delete().eq('id', blockId);
    await onRefresh();
  };

  const handleToggleArchive = async (block: any) => {
    const isArchived = block.is_archived;
    const action = isArchived ? 'Unarchive' : 'Archive';
    if (!window.confirm(`${action} '${block.title}'? ${isArchived ? 'It will be visible to residents again.' : 'It will be hidden from residents, but existing scores will be kept.'}`)) return;
    
    await supabase.from('blocks').update({ is_archived: !isArchived }).eq('id', block.id);
    await onRefresh();
  };

  // If a block is selected for editing questions
  if (selectedBlockId) {
    const block = sortedBlocks.find(b => b.id === selectedBlockId);
    if (!block) return null;
    return (
      <BlockEditor 
        block={block} 
        allQuestions={questions} 
        residentsCount={resultsCount.get(block.title) || 0} 
        onBack={() => setSelectedBlockId(null)}
        onSaved={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Curriculum Manager</h2>
            <p className="text-slate-500 font-medium max-w-2xl mt-1">
              Manage dates and assign question sets for all blocks.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {uninitialized.length > 0 && (
            <button
              onClick={handleInitializeAll}
              disabled={initializing}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              {initializing ? 'Populating...' : `Auto-Populate ${uninitialized.length} Blocks`}
            </button>
          )}
          <button
            onClick={handleCreateBlock}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" /> New Block
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-4 pl-4">Block Title</div>
          <div className="col-span-4 text-center">Schedule Dates</div>
          <div className="col-span-2 text-center">Questions</div>
          <div className="col-span-2 text-right pr-4">Actions</div>
        </div>
        
        <div className="divide-y divide-slate-50">
          {sortedBlocks.map(block => {
            const schedule = getSchedule(block.id);
            const isEditingDates = editingDates === block.id;
            const qCount = block.question_ids?.length || 0;
            const isReady = qCount > 0 && schedule?.start_date && schedule?.end_date;

            return (
              <div key={block.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50/50 transition-colors">
                <div className="col-span-4 pl-4 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${block.is_archived ? 'bg-slate-300' : isReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div>
                    <h3 className={`font-bold ${block.is_archived ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{block.title}</h3>
                    <p className="text-xs font-bold text-slate-400">{resultsCount.get(block.title) || 0} completions {block.is_archived && '· Archived'}</p>
                  </div>
                </div>

                <div className="col-span-4 flex items-center justify-center">
                  {isEditingDates ? (
                    <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                      <input 
                        type="date" 
                        value={dateForm.start} 
                        onChange={e => setDateForm(f => ({ ...f, start: e.target.value }))}
                        className="text-xs font-bold px-2 py-1 rounded bg-white"
                      />
                      <span className="text-slate-400">to</span>
                      <input 
                        type="date" 
                        value={dateForm.end} 
                        onChange={e => setDateForm(f => ({ ...f, end: e.target.value }))}
                        className="text-xs font-bold px-2 py-1 rounded bg-white"
                      />
                      <button onClick={() => handleSaveDates(block.id)} disabled={saving} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingDates(null)} className="p-1 text-slate-400 hover:bg-slate-200 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-3 cursor-pointer" onClick={() => {
                      setEditingDates(block.id);
                      setDateForm({ start: schedule?.start_date || '', end: schedule?.end_date || '' });
                    }}>
                      {schedule ? (
                        <div className="text-center">
                          <p className="font-bold text-slate-700 text-sm">
                            {new Date(schedule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})} - {new Date(schedule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                          </p>
                        </div>
                      ) : (
                        <span className="text-amber-500 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full">Set Dates</span>
                      )}
                      <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex justify-center">
                  {qCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                      <CheckCircle className="w-3.5 h-3.5" /> {qCount} Qs
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
                      <Sparkles className="w-3.5 h-3.5" /> Needs Qs
                    </span>
                  )}
                </div>

                <div className="col-span-2 flex items-center justify-end pr-4 gap-2">
                  <button 
                    onClick={() => setSelectedBlockId(block.id)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs rounded-lg transition-colors"
                  >
                    Builder
                  </button>
                  {block.is_archived ? (
                    <button 
                      onClick={() => handleToggleArchive(block)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleToggleArchive(block)}
                      className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Archive Block"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteBlock(block.id, block.title)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
