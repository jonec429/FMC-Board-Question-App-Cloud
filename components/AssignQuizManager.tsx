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
  const [qCount, setQCount] = useState(10);
  
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Determine eligible residents to assign to
  const eligibleResidents = useMemo(() => {
    if (!data?.roster) return [];
    
    // If admin and viewing as admin, they can see everyone
    const isAdmin = profile?.role === 'admin' && profile?.view_as !== 'faculty';
    
    return data.roster
      .filter(r => r.role === 'resident' || r.role === 'chief')
      .filter(r => isAdmin || r.advisor === profile?.full_name || r.advisor === (profile?.first_name + ' ' + profile?.last_name))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [data?.roster, profile]);

  // 2. Extract unique categories from questions
  const availableCategories = useMemo(() => {
    if (!data?.questions) return [];
    const cats = new Set(data.questions.filter(q => q.category !== 'Demo').map(q => q.category));
    return Array.from(cats).sort();
  }, [data?.questions]);

  // 3. Calculate max available questions based on filters
  const matchingQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter(q => 
      q.category !== 'Demo' && 
      (selectedCategories.length === 0 || selectedCategories.includes(q.category))
    );
  }, [data?.questions, selectedCategories]);

  const maxQ = matchingQuestions.length;

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
    if (qCount < 1 || qCount > maxQ) {
      setFormError(`Please select a valid question count (1-${maxQ}).`);
      return;
    }

    setAssigning(true);

    try {
      // 1. Pick random questions
      const shuffled = [...matchingQuestions].sort(() => Math.random() - 0.5);
      const selectedIds = shuffled.slice(0, qCount).map(q => q.id);

      // 2. We only have their name/email in the roster. We need their user IDs from `profiles`.
      // Fortunately `data.profiles` has this.
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

      // 3. Insert into assigned_quizzes
      const inserts = assignedToIds.map(targetId => ({
        assigned_by: user.id,
        assigned_to: targetId,
        title: title.trim(),
        question_ids: selectedIds
      }));

      const { error: insertError } = await supabase.from('assigned_quizzes').insert(inserts);

      if (insertError) throw insertError;

      setSuccess(true);
      setTitle('');
      setSelectedAdvisees([]);
      setQCount(10);
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
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          Assign Targeted Quizzes
        </h1>
        <p className="text-slate-500 text-sm md:text-base max-w-2xl">
          Build custom quizzes focused on specific categories and assign them directly to your advisees for focused remediation or extra practice.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Resident Selection */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              1. Select Residents
            </h2>
            
            {eligibleResidents.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No residents assigned to you.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {eligibleResidents.map(r => (
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
                    <span className="text-sm font-medium text-slate-700">
                      {r.name || r.email} <span className="text-slate-400 text-xs ml-1">({r.pgy_override || 'Resident'})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quiz Config */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              2. Configure Quiz
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assignment Title</label>
              <input 
                type="text" 
                placeholder="e.g. Needs Review: Endocrine & GI"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter by Category (Optional)</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
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
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Number of Questions</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1" 
                  max={Math.min(maxQ, 100)} 
                  value={qCount}
                  onChange={e => setQCount(parseInt(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <input 
                  type="number" 
                  min="1" 
                  max={Math.min(maxQ, 100)} 
                  value={qCount}
                  onChange={e => setQCount(parseInt(e.target.value) || 10)}
                  className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold text-indigo-600"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Available matching pool: {maxQ} questions</p>
            </div>

          </div>

          <button
            onClick={handleAssign}
            disabled={assigning || eligibleResidents.length === 0}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-md"
          >
            {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Assign Quiz to {selectedAdvisees.length} {selectedAdvisees.length === 1 ? 'Resident' : 'Residents'}
          </button>
        </div>
      </div>
    </div>
  );
}
