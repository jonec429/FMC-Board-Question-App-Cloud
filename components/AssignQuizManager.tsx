'use client';

import React, { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { User, Profile, RosterEntry } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { Loader2, Sparkles, CheckCircle, AlertTriangle, Users, BookOpen } from './AppIcons';

interface AssignQuizManagerProps {
  user?: User | null;
  profile?: Profile | null;
}

export default function AssignQuizManager({ user, profile }: AssignQuizManagerProps) {
  const { data, loading, error } = useAdminData({ includeQuestions: true });
  
  const [selectedAdvisees, setSelectedAdvisees] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [bulkCount, setBulkCount] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Determine eligible residents to assign to (ALL residents, advisees sorted to top)
  const eligibleResidents = useMemo(() => {
    if (!data?.roster) return [];
    
    const isAdmin = profile?.role === 'admin' && profile?.view_as !== 'faculty';
    const facultyName = profile?.full_name || (profile?.first_name + ' ' + profile?.last_name);
    
    return data.roster
      .filter(r => r.role === 'resident' || r.role === 'chief')
      .sort((a, b) => {
        if (isAdmin) return (a.name || '').localeCompare(b.name || '');
        const aIsAdvisee = a.advisor === facultyName;
        const bIsAdvisee = b.advisor === facultyName;
        if (aIsAdvisee && !bIsAdvisee) return -1;
        if (!aIsAdvisee && bIsAdvisee) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [data?.roster, profile]);

  // Helper to check if a resident is an advisee
  const isAdvisee = (r: RosterEntry) => {
    const facultyName = profile?.full_name || (profile?.first_name + ' ' + profile?.last_name);
    return r.advisor === facultyName;
  };

  // 2. Extract unique categories from questions
  const availableCategories = useMemo(() => {
    if (!data?.questions) return [];
    const cats = new Set(data.questions.filter(q => q.category !== 'Demo').map(q => q.category));
    return Array.from(cats).sort();
  }, [data?.questions]);

  // 3. Calculate matching questions based on filters
  const matchingQuestions = useMemo(() => {
    if (!data?.questions) return [];
    const lowerKeyword = searchKeyword.toLowerCase().trim();
    return data.questions.filter(q => 
      q.category !== 'Demo' && 
      (selectedCategories.length === 0 || selectedCategories.includes(q.category)) &&
      (!lowerKeyword || (q.question_text || '').toLowerCase().includes(lowerKeyword))
    );
  }, [data?.questions, selectedCategories, searchKeyword]);

  // Bulk actions
  const handleSelectRandom = () => {
    const count = Math.min(bulkCount, matchingQuestions.length);
    const shuffled = [...matchingQuestions].sort(() => Math.random() - 0.5);
    const newIds = shuffled.slice(0, count).map(q => q.id);
    
    // Merge with currently selected ids, avoiding duplicates
    const combined = Array.from(new Set([...selectedQuestionIds, ...newIds]));
    setSelectedQuestionIds(combined);
  };

  const handleSelectAllFiltered = () => {
    const newIds = matchingQuestions.map(q => q.id);
    const combined = Array.from(new Set([...selectedQuestionIds, ...newIds]));
    setSelectedQuestionIds(combined);
  };

  const handleAssign = async () => {
    if (!user) return;
    setFormError('');
    setSuccess(false);

    if (selectedAdvisees.length === 0) {
      setFormError('Please select at least one resident to assign the quiz to.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please provide a title for the assignment.');
      return;
    }
    if (selectedQuestionIds.length === 0) {
      setFormError('Please select at least one question for the quiz.');
      return;
    }

    setAssigning(true);

    try {
      // 1. We only have their name/email in the roster. We need their user IDs from `profiles`.
      const assignedToIds = selectedAdvisees.map(name => {
        const rosterEntry = data?.roster.find(r => (r.name || r.email) === name);
        const p = data?.profiles.find(p => p.email?.toLowerCase() === rosterEntry?.email.toLowerCase());
        return p?.id;
      }).filter(Boolean) as string[];

      if (assignedToIds.length !== selectedAdvisees.length) {
        setFormError("Could not resolve all selected residents to active user accounts. Ensure they have logged in at least once.");
        setAssigning(false);
        return;
      }

      // 2. Insert into assigned_quizzes
      const inserts = assignedToIds.map(targetId => ({
        assigned_by: user.id,
        assigned_to: targetId,
        title: title.trim(),
        question_ids: selectedQuestionIds
      }));

      const { error: insertError } = await supabase.from('assigned_quizzes').insert(inserts);

      if (insertError) throw insertError;

      setSuccess(true);
      setTitle('');
      setSelectedAdvisees([]);
      setSelectedQuestionIds([]);
      setSelectedCategories([]);

    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to assign quiz.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading curriculum data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl m-6">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p className="font-bold">Failed to load data</p>
        <p className="text-sm">{String(error)}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          Assign Targeted Quizzes
        </h1>
        <p className="text-slate-500 text-sm md:text-base max-w-3xl">
          Build custom quizzes focused on specific categories and assign them directly to any resident. Your direct advisees are pinned to the top of the list.
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-3 font-medium">
          <CheckCircle className="w-5 h-5 shrink-0" />
          Quiz assigned successfully! It will appear on their dashboard immediately.
        </div>
      )}

      {formError && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Resident Selection */}
        <div className="space-y-4 md:col-span-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[800px]">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4 shrink-0">
              <Users className="w-5 h-5 text-blue-500" />
              1. Select Residents
            </h2>
            
            {eligibleResidents.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No residents found.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {eligibleResidents.map(r => {
                  const advisee = isAdvisee(r);
                  return (
                    <label key={r.email} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        checked={selectedAdvisees.includes(r.name || r.email)}
                        onChange={(e) => {
                          const val = r.name || r.email;
                          if (e.target.checked) setSelectedAdvisees(prev => [...prev, val]);
                          else setSelectedAdvisees(prev => prev.filter(n => n !== val));
                        }}
                      />
                      <span className="text-sm font-medium text-slate-700 flex flex-col">
                        <span className="flex items-center gap-2">
                          {r.name || r.email}
                          {advisee && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md">Advisee</span>}
                        </span>
                        <span className="text-slate-400 text-xs">PGY: {r.pgy_override || 'Resident'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quiz Config */}
        <div className="space-y-4 md:col-span-8 flex flex-col h-[800px]">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 flex-1 flex flex-col min-h-0">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 shrink-0">
              <BookOpen className="w-5 h-5 text-amber-500" />
              2. Quiz Builder
            </h2>

            <div className="shrink-0">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assignment Title</label>
              <input 
                type="text" 
                placeholder="e.g. Needs Review: Endocrine & GI"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
            </div>

            <div className="shrink-0 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search Questions</label>
                <input 
                  type="text" 
                  placeholder="Search keywords..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter by Category</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      if (selectedCategories.includes(cat)) setSelectedCategories(prev => prev.filter(c => c !== cat));
                      else setSelectedCategories(prev => [...prev, cat]);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat) 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 border' 
                        : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2 shrink-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Questions <span className={selectedQuestionIds.length > 0 ? "text-indigo-600 font-black" : ""}>({selectedQuestionIds.length} chosen)</span>
                </label>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <input 
                    type="number" 
                    min="1" 
                    max={matchingQuestions.length} 
                    value={bulkCount} 
                    onChange={e => setBulkCount(parseInt(e.target.value) || 1)} 
                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50" 
                  />
                  <button onClick={handleSelectRandom} className="text-xs bg-slate-100 px-3 py-1.5 rounded-md font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                    Add Random
                  </button>
                  <button onClick={handleSelectAllFiltered} className="text-xs bg-slate-100 px-3 py-1.5 rounded-md font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                    Add All Filtered
                  </button>
                  {selectedQuestionIds.length > 0 && (
                    <button onClick={() => setSelectedQuestionIds([])} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-medium hover:bg-red-100 transition-colors">
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {matchingQuestions.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    No questions match the selected filters.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {matchingQuestions.map(q => (
                      <label key={q.id} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        selectedQuestionIds.includes(q.id) 
                          ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/10' 
                          : 'bg-white border-transparent hover:border-slate-200'
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={selectedQuestionIds.includes(q.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedQuestionIds(p => [...p, q.id]);
                            else setSelectedQuestionIds(p => p.filter(id => id !== q.id));
                          }} 
                          className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium line-clamp-2 ${selectedQuestionIds.includes(q.id) ? 'text-slate-900' : 'text-slate-600'}`}>
                            {q.question_text}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mt-1 inline-block">
                            {q.category}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          <button
            onClick={handleAssign}
            disabled={assigning || eligibleResidents.length === 0 || selectedQuestionIds.length === 0 || !title.trim()}
            className="w-full shrink-0 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-md"
          >
            {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Assign {selectedQuestionIds.length} {selectedQuestionIds.length === 1 ? 'Question' : 'Questions'} to {selectedAdvisees.length} {selectedAdvisees.length === 1 ? 'Resident' : 'Residents'}
          </button>
        </div>
      </div>
    </div>
  );
}
