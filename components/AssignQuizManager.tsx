'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { User, Profile, RosterEntry } from '@/lib/types';
import {
  Loader2, Sparkles, CheckCircle, AlertTriangle, Users, BookOpen,
  Calendar, Clock, Trash2, Search, X
} from './AppIcons';
import { Check, ClipboardList, Send, AlertCircle, ArrowUpRight } from 'lucide-react';
import QuestionPicker from './QuestionPicker';
import {
  createAssignedQuizzes,
  getFacultyAssignedQuizzes,
  deleteAssignedQuiz,
  AssignedQuizRecord
} from '@/lib/assignedQuizzes';

interface AssignQuizManagerProps {
  user?: User | null;
  profile?: Profile | null;
}

export default function AssignQuizManager({ user, profile }: AssignQuizManagerProps) {
  const { data, loading, error } = useAdminData({ includeQuestions: true });

  // Main View Tabs: Create Quiz vs Sent Quizzes Tracking
  const [activeMainTab, setActiveMainTab] = useState<'create' | 'tracking'>('create');

  // Form state
  const [selectedAdvisees, setSelectedAdvisees] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Tracking tab state
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuizRecord[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingFilterStatus, setTrackingFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');

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

  // Fetch tracking list
  const refreshTracking = useCallback(async () => {
    setLoadingTracking(true);
    const records = await getFacultyAssignedQuizzes();

    // Hydrate resident information
    const roster = data?.roster || [];
    const profiles = data?.profiles || [];

    const hydrated = records.map(rec => {
      const p = profiles.find(pr => pr.id === rec.assigned_to);
      const email = p?.email || '';
      const r = roster.find(ro => ro.email.toLowerCase() === email.toLowerCase());

      const byProfile = profiles.find(pr => pr.id === rec.assigned_by);
      const byName = byProfile ? (byProfile.full_name || `${byProfile.first_name || ''} ${byProfile.last_name || ''}`.trim()) : 'Faculty';

      return {
        ...rec,
        resident_name: r?.name || p?.full_name || email || 'Unknown Resident',
        resident_email: email,
        resident_pgy: r?.pgy_override ? `PGY-${r.pgy_override}` : r?.pgy || 'Resident',
        assigned_by_name: byName,
      };
    });

    setAssignedQuizzes(hydrated);
    setLoadingTracking(false);
  }, [data?.roster, data?.profiles]);

  useEffect(() => {
    if (activeMainTab === 'tracking') {
      refreshTracking();
    }
  }, [activeMainTab, refreshTracking]);

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
      // Resolve user IDs from profiles
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

      const res = await createAssignedQuizzes({
        assignedByUserId: user.id,
        assignedToUserIds: assignedToIds,
        title: title.trim(),
        questionIds: selectedQuestionIds,
        dueDate: dueDate || null,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create assignments.');
      }

      setSuccess(true);
      setTitle('');
      setDueDate('');
      setSelectedAdvisees([]);
      setSelectedQuestionIds([]);
      refreshTracking();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to assign quiz.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteAssignment = async (id: string, quizTitle: string, residentName: string) => {
    if (!window.confirm(`Cancel assignment "${quizTitle}" for ${residentName}?`)) return;
    const ok = await deleteAssignedQuiz(id);
    if (ok) {
      setAssignedQuizzes(prev => prev.filter(q => q.id !== id));
    } else {
      alert('Failed to delete assignment. Please try again.');
    }
  };

  // Filtered Tracking List
  const filteredTracking = useMemo(() => {
    const term = trackingSearch.trim().toLowerCase();
    return assignedQuizzes.filter(q => {
      if (trackingFilterStatus === 'pending' && q.is_completed) return false;
      if (trackingFilterStatus === 'completed' && !q.is_completed) return false;
      if (term) {
        const matchTitle = (q.title || '').toLowerCase().includes(term);
        const matchName = (q.resident_name || '').toLowerCase().includes(term);
        const matchEmail = (q.resident_email || '').toLowerCase().includes(term);
        if (!matchTitle && !matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [assignedQuizzes, trackingSearch, trackingFilterStatus]);

  // Tracking Stats
  const trackingStats = useMemo(() => {
    const total = assignedQuizzes.length;
    const completed = assignedQuizzes.filter(q => q.is_completed).length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, rate };
  }, [assignedQuizzes]);

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
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              Targeted Quizzes &amp; Remediation
            </h1>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-black rounded-full border border-purple-200 dark:border-purple-800/60">
              Practice &amp; Remediation • 0 APs
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-3xl">
            Build custom question sets and assign them directly to any resident, set optional due dates, and track their completion status.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl shrink-0 self-start sm:self-auto border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setActiveMainTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeMainTab === 'create'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Create Assignment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('tracking')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeMainTab === 'tracking'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Sent Quizzes &amp; Tracking</span>
            {assignedQuizzes.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-black">
                {assignedQuizzes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-center gap-3 font-medium animate-in fade-in">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>Quiz assigned successfully! It will appear on their dashboard immediately.</span>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center gap-3 font-medium animate-in fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* VIEW 1: CREATE NEW ASSIGNMENT */}
      {activeMainTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-300">
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
                          <span className="text-slate-400 dark:text-slate-500 text-xs">{r.pgy_override ? `PGY-${r.pgy_override}` : r.pgy || 'Resident'}</span>
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
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                2. Quiz Details &amp; Questions
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Targeted Review: High Yield Cardiology & Pulmonary"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
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
      )}

      {/* VIEW 2: SENT QUIZZES & TRACKING */}
      {activeMainTab === 'tracking' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Assigned</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{trackingStats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pending</span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{trackingStats.pending}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Completed</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{trackingStats.completed}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Completion Rate</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{trackingStats.rate}%</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={trackingSearch}
                onChange={e => setTrackingSearch(e.target.value)}
                placeholder="Search by quiz title, resident name, or email..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {trackingSearch && (
                <button
                  onClick={() => setTrackingSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
              {(['all', 'pending', 'completed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setTrackingFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black capitalize transition-all ${
                    trackingFilterStatus === status
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Table / List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {loadingTracking ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
                <p className="text-xs font-bold">Loading assignment tracking...</p>
              </div>
            ) : filteredTracking.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30 text-indigo-500" />
                <p className="font-bold text-sm">No quiz assignments found.</p>
                <p className="text-xs mt-1">Quizzes assigned to residents will appear here for progress tracking.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTracking.map(rec => {
                  const isOverdue = !rec.is_completed && rec.due_date && new Date(rec.due_date + 'T23:59:59') < new Date();
                  const dueLabel = rec.due_date ? new Date(rec.due_date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                  const assignedDate = new Date(rec.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                  return (
                    <div key={rec.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {rec.title}
                          </h3>
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">
                            {rec.question_ids?.length || 0} Questions
                          </span>
                          {rec.is_completed ? (
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-black flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                              <CheckCircle className="w-3 h-3" />
                              Completed {rec.score !== undefined && rec.score !== null ? `(${rec.score}%)` : ''}
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded text-[10px] font-black flex items-center gap-1 border border-red-200 dark:border-red-800/60">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded text-[10px] font-black flex items-center gap-1 border border-amber-200 dark:border-amber-800/60">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Assigned to: <strong className="text-indigo-600 dark:text-indigo-400">{rec.resident_name}</strong> ({rec.resident_pgy})
                          </span>
                          <span>•</span>
                          <span>Assigned on {assignedDate}</span>
                          {dueLabel && (
                            <>
                              <span>•</span>
                              <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                                Due: {dueLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(rec.id, rec.title, rec.resident_name || 'Resident')}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                          title="Cancel/Delete Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
