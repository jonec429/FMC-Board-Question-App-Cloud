'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Database, PlusCircle, Search, Edit3, Trash2, Loader2, X, Save, Eye
} from './AppIcons';
import QuestionImporter from './QuestionImporter';
import { CANONICAL_CATEGORIES } from '@/lib/csvImport';
import { withTimeout } from '@/lib/utils';
import { AdminData } from '@/hooks/useAdminData';

type SubTab = 'browse' | 'import';

interface QuestionBankManagerProps {
  adminData?: AdminData;
  onRefresh?: () => Promise<void>;
}

export default function QuestionBankManager({ adminData, onRefresh }: QuestionBankManagerProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('browse');

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
      {activeTab === 'browse' ? <QuestionBrowser adminData={adminData} onRefresh={onRefresh} /> : <QuestionImporter />}
    </div>
  );
}

function QuestionBrowser({ adminData, onRefresh }: QuestionBankManagerProps) {
  const allQuestions = adminData?.questions || [];
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Pagination (Simple limit for now)
  const [limit, setLimit] = useState(50);

  const [error, setError] = useState<string | null>(null);

  const displayQuestions = React.useMemo(() => {
    let filtered = allQuestions;
    if (categoryFilter) filtered = filtered.filter(q => q.category === categoryFilter);
    if (yearFilter) filtered = filtered.filter(q => q.year === yearFilter);
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(q => q.question_text.toLowerCase().includes(term));
    }
    return filtered.slice(0, limit);
  }, [allQuestions, search, categoryFilter, yearFilter, limit]);

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

  const openEditModal = (q: any) => {
    // Pad options to 5 for the form
    const paddedOptions = [...(q.options || []), '', '', '', '', ''].slice(0, 5);
    setEditingQuestion({
      ...q,
      options: paddedOptions,
      correct_index: q.correct_index.toString()
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search question text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium"
          />
        </div>
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
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-[60%]">Question</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Year</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayQuestions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 font-bold">
                    <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No questions found matching your filters.
                  </td>
                </tr>
              ) : (
                displayQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">
                        {q.question_text}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg whitespace-nowrap">
                        {q.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">
                      {q.year || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(q)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Question"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {displayQuestions.length === limit && (
          <div className="p-4 border-t border-slate-50 flex justify-center">
            <button 
              onClick={() => setLimit(l => l + 50)}
              className="px-6 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>

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
