'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Database, PlusCircle, Search, Edit3, Trash2, Loader2, X, Save, Eye
} from './AppIcons';
import QuestionImporter from './QuestionImporter';
import { DataTable } from './DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { CANONICAL_CATEGORIES } from '@/lib/csvImport';
import { withTimeout } from '@/lib/utils';
import { AdminData } from '@/lib/types';

type SubTab = 'browse' | 'import';

import { useAdminData } from '@/hooks/useAdminData';

export default function QuestionBankManager() {
  const { data: adminData, loading, error, refetch } = useAdminData({ includeQuestions: true });
  const [activeTab, setActiveTab] = useState<SubTab>('browse');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm animate-fade-in">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Question Bank...</p>
      </div>
    );
  }

  if (error || !adminData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-red-100 bg-red-50 shadow-sm animate-fade-in">
        <p className="text-red-500 font-bold">{error?.toString() || 'Failed to load data.'}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 ${activeTab === 'browse' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Database className="w-4 h-4" /> Browse Bank
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 ${activeTab === 'import' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <PlusCircle className="w-4 h-4" /> Bulk Import
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'browse' ? <QuestionBrowser adminData={adminData} onRefresh={refetch} /> : <QuestionImporter />}
    </div>
  );
}

function QuestionBrowser({ adminData, onRefresh }: { adminData: AdminData, onRefresh: () => Promise<void> }) {
  const allQuestions = adminData.questions || [];
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const availableYears = React.useMemo(() => {
    const years = new Set<string>(allQuestions.map((q: any) => q.year).filter(Boolean));
    return Array.from(years).sort((a: string, b: string) => b.localeCompare(a));
  }, [allQuestions]);

  const displayQuestions = React.useMemo(() => {
    let filtered = allQuestions;
    if (categoryFilter) filtered = filtered.filter((q: any) => q.category === categoryFilter);
    if (yearFilter) filtered = filtered.filter((q: any) => q.year === yearFilter);
    return filtered;
  }, [allQuestions, categoryFilter, yearFilter]);

  const columns: ColumnDef<any>[] = React.useMemo(() => [
    {
      accessorKey: 'question_text',
      header: 'Question',
      cell: info => (
        <div className="text-sm font-medium text-slate-800 line-clamp-2" title={info.getValue() as string}>
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: info => (
        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg whitespace-nowrap">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'year',
      header: 'Year',
      cell: info => (
        <span className="text-sm font-bold text-slate-500">
          {(info.getValue() as string) || '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: info => {
        const q = info.row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit Question"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    }
  ], []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this question? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('Error deleting: ' + err.message);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Clean up options array
      const options = editingQuestion.options.filter((opt: string) => opt.trim() !== '');
      
      const payload = {
        question_text: editingQuestion.question_text,
        category: editingQuestion.category,
        year: editingQuestion.year,
        options: options,
        correct_index: parseInt(editingQuestion.correct_index, 10),
        explanation: editingQuestion.explanation,
        resource_link: editingQuestion.resource_link
      };

      const { error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', editingQuestion.id);

      if (error) throw error;

      setShowEditModal(false);
      if (onRefresh) await onRefresh(); // Refresh to ensure data is perfectly in sync
    } catch (err: any) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = async (q: any) => {
    // The bulk admin fetch omits `explanation` and `resource_link` (too large for upfront
    // load). Lazy-fetch them now before opening the editor so the form is pre-populated.
    let full = q;
    try {
      const { data, error } = await withTimeout(
        supabase.from('questions').select('explanation, resource_link').eq('id', q.id).maybeSingle(),
        5000
      );
      if (!error && data) full = { ...q, ...data };
    } catch (err) {
      console.warn('Lazy-fetch of full question failed; opening editor with partial row:', err);
    }
    const paddedOptions = [...(full.options || []), '', '', '', '', ''].slice(0, 5);
    setEditingQuestion({
      ...full,
      options: paddedOptions,
      correct_index: full.correct_index.toString()
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full md:w-48 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-700"
        >
          <option value="">All Categories</option>
          {CANONICAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select 
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full md:w-32 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-700"
        >
          <option value="">All Years</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <DataTable 
        columns={columns} 
        data={displayQuestions} 
        globalSearchPlaceholder="Search question text..."
      />

      {/* Edit Modal */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 py-12 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-3xl w-full my-auto flex flex-col max-h-full">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur z-10 rounded-t-[40px]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-800">Edit Question</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto">
              <form id="edit-question-form" onSubmit={handleEditSave} className="space-y-6">
                
                {/* Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Category</label>
                    <select 
                      required
                      value={editingQuestion.category}
                      onChange={(e) => setEditingQuestion({...editingQuestion, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-700"
                    >
                      <option value="">Select Category...</option>
                      {CANONICAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Year</label>
                    <input 
                      type="text" 
                      value={editingQuestion.year || ''}
                      onChange={(e) => setEditingQuestion({...editingQuestion, year: e.target.value})}
                      placeholder="e.g. 2025"
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-bold text-slate-700"
                    />
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Question Text</label>
                  <textarea 
                    required
                    rows={4}
                    value={editingQuestion.question_text}
                    onChange={(e) => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Options & Correct Answer */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Options</label>
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Correct Answer</label>
                  </div>
                  
                  {['A', 'B', 'C', 'D', 'E'].map((letter, idx) => (
                    <div key={letter} className="flex items-start gap-4">
                      <div className="w-8 h-12 flex items-center justify-center font-black text-slate-400 shrink-0">
                        {letter}
                      </div>
                      <input 
                        type="text"
                        value={editingQuestion.options[idx] || ''}
                        onChange={(e) => {
                          const newOpts = [...editingQuestion.options];
                          newOpts[idx] = e.target.value;
                          setEditingQuestion({...editingQuestion, options: newOpts});
                        }}
                        placeholder={`Option ${letter}`}
                        required={idx < 2} // A and B at least
                        className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-800"
                      />
                      <div className="flex h-12 items-center shrink-0 pr-2">
                        <input 
                          type="radio" 
                          name="correct_index"
                          value={idx}
                          checked={editingQuestion.correct_index === idx.toString()}
                          onChange={(e) => setEditingQuestion({...editingQuestion, correct_index: e.target.value})}
                          className="w-5 h-5 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Explanation (Optional)</label>
                  <textarea 
                    rows={3}
                    value={editingQuestion.explanation || ''}
                    onChange={(e) => setEditingQuestion({...editingQuestion, explanation: e.target.value})}
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Resource Link */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Resource Link (Optional)</label>
                  <input 
                    type="text" 
                    value={editingQuestion.resource_link || ''}
                    onChange={(e) => setEditingQuestion({...editingQuestion, resource_link: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 font-medium text-blue-600"
                  />
                </div>

              </form>
            </div>
            
            {/* Footer */}
            <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50 rounded-b-[40px] flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="edit-question-form"
                disabled={saving}
                className="px-8 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
