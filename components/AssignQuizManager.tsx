'use client';

import React, { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { User, Profile, RosterEntry } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { Loader2, Sparkles, CheckCircle, AlertTriangle, Users, BookOpen } from './AppIcons';
import QuestionPicker from './QuestionPicker';

interface AssignQuizManagerProps {
  user?: User | null;
  profile?: Profile | null;
}

export default function AssignQuizManager({ user, profile }: AssignQuizManagerProps) {
  const { data, loading, error } = useAdminData({ includeQuestions: true });

  const [selectedAdvisees, setSelectedAdvisees] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Determine eligible residents to assign to (ALL residents, advisees sorted to top)
  const eligibleResidents = useMemo(() => {
    if (!data?.roster) return [];

    const isAdmin = profile?.role === 'admin' && profile?.view_as !== 'faculty';
    const facultyName = profile?.full_name || (profile?.first_name + ' ' + profile?.last_name);

    return data.roster
      .filter(r => (r.role === 'resident' || r.role === 'chief') && r.status !== 'graduated')
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
      // 1. Resolve their user IDs from `profiles`
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

    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to assign quiz.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
        <p>Loading curriculum data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl m-6">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p className="font-bold">Failed to load data</p>
        <p className="text-sm">{String(error)}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Assign Targeted Quizzes
          </h1>
          <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-black rounded-full border border-purple-200 dark:border-purple-800/60">
            Practice &amp; Remediation • 0 APs
          </span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-3xl">
          Build targeted question sets for specific categories or topics and assign them directly to any resident. Direct advisees are pinned to the top of your list. Assigned quizzes are for practice and do not award Academic Points.
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-3 font-medium">
          <CheckCircle className="w-5 h-5 shrink-0" />
          Quiz assigned successfully! It will appear on their dashboard immediately.
        </div>
      )}

      {formError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/40 rounded-xl flex items-center gap-3 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Resident Selection */}
        <div className="space-y-4 lg:col-span-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[750px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                1. Select Residents
              </h2>
              {selectedAdvisees.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAdvisees([])}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear ({selectedAdvisees.length})
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2 shrink-0">
              <span>{eligibleResidents.length} Eligible Residents</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedAdvisees.length === eligibleResidents.length) {
                    setSelectedAdvisees([]);
                  } else {
                    setSelectedAdvisees(eligibleResidents.map(r => r.name || r.email));
                  }
                }}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {selectedAdvisees.length === eligibleResidents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            {eligibleResidents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">No residents found.</p>
            ) : (
              <div className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                {eligibleResidents.map(r => {
                  const advisee = isAdvisee(r);
                  const isChecked = selectedAdvisees.includes(r.name || r.email);
                  return (
                    <label
                      key={r.email}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                        checked={isChecked}
                        onChange={(e) => {
                          const val = r.name || r.email;
                          if (e.target.checked) setSelectedAdvisees(prev => [...prev, val]);
                          else setSelectedAdvisees(prev => prev.filter(n => n !== val));
                        }}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex flex-col min-w-0">
                        <span className="flex items-center gap-2 truncate">
                          <span className={`truncate ${isChecked ? 'font-bold text-slate-900 dark:text-white' : ''}`}>
                            {r.name || r.email}
                          </span>
                          {advisee && (
                            <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-md shrink-0">
                              Advisee
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs">{r.pgy_override || 'Resident'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quiz Config with Shared QuestionPicker */}
        <div className="space-y-4 lg:col-span-8 flex flex-col">
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              2. Quiz Builder &amp; Questions
            </h2>

            <div>
              <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Assignment Title
              </label>
              <input 
                type="text" 
                placeholder="e.g. Targeted Review: High Yield Cardiology &amp; Pulmonary"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            {/* Unified Question Picker */}
            <div>
              <QuestionPicker
                allQuestions={data?.questions || []}
                selectedQuestionIds={selectedQuestionIds}
                onChangeSelectedIds={setSelectedQuestionIds}
                maxHeight="max-h-[500px]"
              />
            </div>
          </div>

          <button
            onClick={handleAssign}
            disabled={assigning || eligibleResidents.length === 0 || selectedQuestionIds.length === 0 || !title.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.005] active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-indigo-100 dark:shadow-none cursor-pointer"
          >
            {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Assign {selectedQuestionIds.length} {selectedQuestionIds.length === 1 ? 'Question' : 'Questions'} to {selectedAdvisees.length} {selectedAdvisees.length === 1 ? 'Resident' : 'Residents'}
          </button>
        </div>
      </div>
    </div>
  );
}
