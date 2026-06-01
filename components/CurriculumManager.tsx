import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Loader2, Database, Trash2, Calendar, CheckCircle, Save, X, Edit3, Sparkles, Archive, ArchiveRestore, Copy } from './AppIcons';
import { AdminData } from '@/lib/types';
import { partitionYears, RECENT_ITE_YEAR_WINDOW } from '@/lib/questionFilters';
import { getCurrentAcademicYear, formatAcademicYear } from '@/lib/academicYear';
import BlockEditor from './BlockEditor'; // We will extract this or keep it here
import { useAdminData } from '@/hooks/useAdminData';

export default function CurriculumManager() {
  const { data: adminData, loading, error, refetch } = useAdminData({ includeQuestions: true });

  const { blocks, block_schedule, questions, results } = adminData || { blocks: [], block_schedule: [], questions: [], results: [] };
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const onRefresh = async () => {
    await refetch();
  };

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

  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());

  const allAcademicYears = useMemo(() => {
    const years = new Set<number>();
    blocks.forEach(b => {
      const val = b.academic_year ? Number(b.academic_year) : getCurrentAcademicYear();
      if (!isNaN(val) && val > 0) years.add(val);
    });
    if (!isNaN(selectedYear) && selectedYear > 0) years.add(selectedYear);
    return Array.from(years).sort().reverse();
  }, [blocks, selectedYear]);

  const sortedBlocks = useMemo(() => {
    return [...blocks]
      .filter(b => {
        const val = b.academic_year ? Number(b.academic_year) : getCurrentAcademicYear();
        const year = !isNaN(val) && val > 0 ? val : getCurrentAcademicYear();
        return year === selectedYear;
      })
      .sort((a, b) => blockSortKey(a) - blockSortKey(b));
  }, [blocks, selectedYear]);

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
    try {
      setSaving(true);
      const existing = getSchedule(blockId);
      
      if (!dateForm.start || !dateForm.end) {
        alert("Both start and end dates are required.");
        setSaving(false);
        return;
      }

      let resultError = null;

      if (existing) {
        const { error } = await supabase.from('block_schedule').update({
          start_date: dateForm.start,
          end_date: dateForm.end
        }).eq('id', existing.id);
        resultError = error;
      } else {
        const { error } = await supabase.from('block_schedule').insert({
          id: crypto.randomUUID(), // Explicitly generate ID to bypass any DB default issues
          block_id: blockId,
          start_date: dateForm.start,
          end_date: dateForm.end
        });
        resultError = error;
      }
      
      if (resultError) {
        console.error("Failed to save dates:", resultError);
        alert("Database Error saving dates: " + resultError.message);
      } else {
        // Automatically sync the block's Academic Year based on the Due Date (end_date)
        const dueDateObj = new Date(dateForm.end + "T12:00:00Z");
        const derivedAy = getCurrentAcademicYear(dueDateObj);
        
        await supabase.from('blocks').update({ academic_year: derivedAy }).eq('id', blockId);
        
        alert(`Dates saved successfully! Block assigned to ${formatAcademicYear(derivedAy)}.`);
      }
      
      await onRefresh();
      setEditingDates(null);
    } catch (err: any) {
      console.error("App Crash during save:", err);
      alert("App Crash saving dates: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateBlock = async (block: any) => {
    const targetYearStr = window.prompt(`Copy '${block.title}' to which Academic Year? (Enter the ending year, e.g. 2025 for 2024-2025)`, String(selectedYear));
    if (!targetYearStr || isNaN(Number(targetYearStr))) return;
    const targetYear = Number(targetYearStr);
    
    const { error } = await supabase.from('blocks').insert({
      id: crypto.randomUUID(),
      title: `${block.title} (Copy)`,
      block_type: block.block_type,
      question_count: block.question_count,
      academic_year: targetYear,
      is_archived: false,
      category_filters: block.category_filters,
      keyword_filters: block.keyword_filters,
      question_ids: block.question_ids,
      sort_order: block.sort_order,
    });
    
    if (error) {
      console.error(error);
      alert("Error duplicating block: " + error.message);
    } else {
      await onRefresh();
      setSelectedYear(targetYear);
    }
  };

  const handleCreateBlock = async () => {
    const title = window.prompt("Enter new block title (e.g., 'Block 15: Special'):");
    if (!title) return;
    const { error } = await supabase.from('blocks').insert({
      id: crypto.randomUUID(),
      title,
      block_type: 'assigned',
      question_count: 40,
      academic_year: selectedYear,
      is_archived: false,
    });
    
    if (error) {
      console.error(error);
      alert("Error creating block: " + error.message);
    } else {
      await onRefresh();
    }
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
    
    const { error } = await supabase.from('blocks').update({ is_archived: !isArchived }).eq('id', block.id);
    if (error) {
      console.error('Archive error:', error);
      alert('Error updating block: ' + error.message);
    }
    await onRefresh();
  };

  // If a block is selected for editing questions
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Curriculum Data...</p>
      </div>
    );
  }

  if (error || !adminData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-red-100 bg-red-50 shadow-sm">
        <p className="text-red-500 font-bold">{error?.toString() || 'Failed to load data.'}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Retry</button>
      </div>
    );
  }

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

      {/* Year Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allAcademicYears.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-4 py-2 font-bold rounded-xl whitespace-nowrap transition-colors ${selectedYear === year ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
          >
            {formatAcademicYear(year)}
          </button>
        ))}
        <button
          onClick={() => {
            const newYearStr = window.prompt("Enter new Academic Year ending year (e.g. 2026 for 2025-2026):");
            if (newYearStr && !isNaN(Number(newYearStr))) setSelectedYear(Number(newYearStr));
          }}
          className="px-4 py-2 font-bold rounded-xl whitespace-nowrap transition-colors bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> Add Year
        </button>
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
                    <p className="text-xs font-bold text-slate-400">{resultsCount.get(block.title) || 0} completions{block.is_archived && ' • Archived'}</p>
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
                      <button onClick={() => handleSaveDates(block.id)} disabled={saving} className="p-2 ml-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg shadow-sm transition-all flex items-center justify-center">
                        <Save className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingDates(null)} className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg shadow-sm transition-all flex items-center justify-center">
                        <X className="w-5 h-5" />
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
                  <button 
                    onClick={() => handleDuplicateBlock(block)}
                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Duplicate Block"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {block.is_archived ? (
                    <button 
                      onClick={() => handleToggleArchive(block)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Unarchive Block"
                    >
                      <ArchiveRestore className="w-4 h-4" />
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
