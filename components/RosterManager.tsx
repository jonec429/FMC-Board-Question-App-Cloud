'use client';

import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Users, Loader2, Mail, Trash2, Plus, Edit3 } from './AppIcons';
import { AdminData } from '@/lib/types';
import { deriveLabel, isGraduated, mapSelectionToFields, getRoleOptions } from '@/lib/academicYear';
import { useSortState, sortItems, SortHeader, lastName } from '@/lib/sorting';
import { formatLastNameFirst } from '@/lib/utils';
import TransitionWizard from './TransitionWizard';

import { useAdminData } from '@/hooks/useAdminData';

export default function RosterManager() {
  const { data: adminData, loading, error, refetch } = useAdminData();

  const [search, setSearch] = useState('');
  const [showGraduates, setShowGraduates] = useState(false);
  const { sortKey, sortDir, toggle } = useSortState({ key: 'member', dir: 'asc' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [newPerson, setNewPerson] = useState({ first_name: '', last_name: '', email: '', pgy: '', advisor: '', role: 'resident' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState({ first_name: '', last_name: '', email: '', pgy: '', advisor: '', role: 'resident', has_account: false });
  const [submitting, setSubmitting] = useState(false);

  // useAdminData filters out Faculty for the global roster slice. RosterManager
  // needs the full list (including Faculty) so we re-fetch the unfiltered roster
  // only when needed for mutations (refetch via onRefresh). For display we use
  // whatever the parent already loaded.
  const roster = useMemo(() => {
    const authorized = adminData?.roster || [];
    const profiles = adminData?.profiles || [];
    return authorized.map((auth: any) => {
      const profile = profiles.find((p: any) => p.email === auth.email);
      return {
        ...auth,
        full_name: auth.name,
        has_account: !!profile,
        profile_id: profile?.id,
      };
    });
  }, [adminData]);

  const fetchRoster = async () => {
    await refetch();
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fields = mapSelectionToFields(newPerson.pgy);
      const { error } = await supabase
        .from('authorized_roster')
        .insert([{
          name: `${newPerson.first_name} ${newPerson.last_name}`.trim(),
          first_name: newPerson.first_name,
          last_name: newPerson.last_name,
          email: newPerson.email.toLowerCase().trim(),
          pgy: fields.pgy,
          cohort_year: fields.cohort_year,
          track: fields.track,
          status: 'active',
          advisor: newPerson.advisor,
          role: newPerson.role
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewPerson({ first_name: '', last_name: '', email: '', pgy: '', advisor: '', role: 'resident' });
      await fetchRoster();
    } catch (err: any) {
      alert(err.message || 'Error adding person');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fields = mapSelectionToFields(editingPerson.pgy);
      const { error } = await supabase
        .from('authorized_roster')
        .update({
          name: `${editingPerson.first_name} ${editingPerson.last_name}`.trim(),
          first_name: editingPerson.first_name,
          last_name: editingPerson.last_name,
          pgy: fields.pgy,
          cohort_year: fields.cohort_year,
          track: fields.track,
          advisor: editingPerson.advisor,
          role: editingPerson.role
        })
        .eq('email', editingPerson.email);

      if (error) throw error;

      if (editingPerson.has_account) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: editingPerson.role })
          .eq('email', editingPerson.email);
        
        if (profileError) throw profileError;
      }
      
      setShowEditModal(false);
      setEditingPerson({ first_name: '', last_name: '', email: '', pgy: '', advisor: '', role: 'resident', has_account: false });
      await fetchRoster();
    } catch (err: any) {
      alert(err.message || 'Error updating person');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePerson = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from the authorized roster?`)) return;
    try {
      const { error } = await supabase
        .from('authorized_roster')
        .delete()
        .eq('email', email);
      
      if (error) throw error;
      await fetchRoster();
    } catch (err: any) {
      alert(err.message || 'Error removing person');
    }
  };

  const filtered = roster.filter(m => {
    const matchesSearch =
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase());
    const graduateOk = showGraduates || !isGraduated(m);
    return matchesSearch && graduateOk;
  });

  const rosterAccessor = (m: any, key: string): string | number => {
    switch (key) {
      case 'member': return m.last_name || lastName(m.full_name);
      case 'class': return deriveLabel(m);
      case 'status': return m.has_account ? 0 : 1;
      default: return 0;
    }
  };
  const sortedRoster = sortItems(filtered, rosterAccessor, sortKey, sortDir);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Roster Data...</p>
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search residents or faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-blue-600 outline-none transition-all font-medium text-slate-800"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={showGraduates}
            onChange={(e) => setShowGraduates(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Show graduates
        </label>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              const pendingEmails = sortedRoster.filter(m => !m.has_account && m.track === 'family_medicine').map(m => m.email);
              if (pendingEmails.length === 0) return alert("All residents have active accounts!");
              const subject = encodeURIComponent("Invitation to the FMC Board Question App");
              const body = encodeURIComponent(
                "Welcome to the FMC Board Question App!\n\nThis app is designed to help you prepare for the ABFM boards by providing daily practice questions, automatically tracking your weak areas over time, and gamifying your studying with badges and leaderboards.\n\nTo get started and set up your profile, please visit the link below and click 'Continue with Google' using your Ascension email address:\nhttps://stvfamilymed.org/brq"
              );
              const bcc = pendingEmails.join(',');
              window.open(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subject}&body=${body}`, '_blank');
            }}
            className="w-full md:w-auto px-4 py-4 bg-white text-blue-600 border border-blue-100 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-95 transition-all shadow-sm"
          >
            <Mail className="w-5 h-5" />
            Email Residents
          </button>
          <button
            onClick={() => {
              const pendingEmails = sortedRoster.filter(m => !m.has_account && m.track !== 'family_medicine').map(m => m.email);
              if (pendingEmails.length === 0) return alert("All faculty/staff have active accounts!");
              const subject = encodeURIComponent("Invitation to the FMC Board Question App (Faculty Access)");
              const body = encodeURIComponent(
                "Welcome to the FMC Board Question App!\n\nThis app is designed to help our residents prepare for the ABFM boards. As a faculty member, your account will grant you access to the Faculty Dashboard where you can monitor resident performance, review their weak areas, and check the leaderboard. (You can also take the daily quizzes yourself if you'd like!)\n\nTo access the app, please visit the link below and click 'Continue with Google' using your Ascension email address:\nhttps://stvfamilymed.org/brq"
              );
              const bcc = pendingEmails.join(',');
              window.open(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subject}&body=${body}`, '_blank');
            }}
            className="w-full md:w-auto px-4 py-4 bg-white text-purple-600 border border-purple-100 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-purple-50 active:scale-95 transition-all shadow-sm"
          >
            <Mail className="w-5 h-5" />
            Email Faculty
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="w-full md:w-auto px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-200"
          >
            Year Transition Wizard
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full md:w-auto px-6 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            Add Person
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <SortHeader label="Member" sortKey="member" activeKey={sortKey} dir={sortDir} onSort={toggle} className="px-8 py-6 text-left" />
              <SortHeader label="Class / Role" sortKey="class" activeKey={sortKey} dir={sortDir} onSort={toggle} className="px-8 py-6 text-left" />
              <SortHeader label="Account Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle} className="px-8 py-6 text-left" />
              <th className="px-8 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Fetching Program Roster...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center">
                  <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100 max-w-sm mx-auto shadow-sm text-center">
                    <h3 className="text-sm font-black mb-1 text-center">Connection Error</h3>
                    <p className="font-medium text-red-500 mb-4 text-xs text-center">{error instanceof Error ? error.message : String(error)}</p>
                    <button 
                      onClick={() => fetchRoster()}
                      className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-xs"
                    >
                      Retry Fetch
                    </button>
                  </div>
                </td>
              </tr>
            ) : sortedRoster.length > 0 ? sortedRoster.map((member) => (
              <tr key={member.id} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {member.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{member.full_name ? formatLastNameFirst(member.full_name, member.last_name) : 'Incomplete Profile'}</p>
                      <p className="text-xs font-medium text-slate-400">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const label = deriveLabel(member);
                      const isStaff = member.track === 'faculty' || member.track === 'ob_fellow' || member.track === 'academic_fellow';
                      const grad = isGraduated(member);
                      return (
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-block w-fit ${
                        grad ? 'bg-slate-100 text-slate-400' : isStaff ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {label}
                      </span>
                    );
                  })()}
                  {member.role === 'admin' && (
                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-block w-fit mt-1">
                      Admin
                    </span>
                  )}
                  {member.advisor && (
                    <span className="text-[10px] font-bold text-slate-400 pl-1 italic mt-1">
                      Advisor: {member.advisor}
                    </span>
                  )}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.has_account ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                    <span className={`text-sm font-bold ${member.has_account ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {member.has_account ? 'Active Account' : 'Invite Sent (Pending)'}
                    </span>
                    {!member.has_account && (
                      <button
                        onClick={() => {
                          const isFaculty = member.track !== 'family_medicine';
                          const subject = encodeURIComponent(isFaculty ? "Invitation to the FMC Board Question App (Faculty Access)" : "Invitation to the FMC Board Question App");
                          const body = encodeURIComponent(
                            isFaculty 
                              ? "Welcome to the FMC Board Question App!\n\nThis app is designed to help our residents prepare for the ABFM boards. As a faculty member, your account will grant you access to the Faculty Dashboard where you can monitor resident performance, review their weak areas, and check the leaderboard. (You can also take the daily quizzes yourself if you'd like!)\n\nTo access the app, please visit the link below and click 'Continue with Google' using your Ascension email address:\nhttps://stvfamilymed.org/brq"
                              : "Welcome to the FMC Board Question App!\n\nThis app is designed to help you prepare for the ABFM boards by providing daily practice questions, automatically tracking your weak areas over time, and gamifying your studying with badges and leaderboards.\n\nTo get started and set up your profile, please visit the link below and click 'Continue with Google' using your Ascension email address:\nhttps://stvfamilymed.org/brq"
                          );
                          window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${member.email}&su=${subject}&body=${body}`, '_blank');
                        }}
                        className="ml-2 p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Resend Invitation Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => {
                        setEditingPerson({
                          first_name: member.first_name || (member.full_name ? member.full_name.split(' ')[0] : ''),
                          last_name: member.last_name || (member.full_name && member.full_name.includes(' ') ? member.full_name.substring(member.full_name.indexOf(' ') + 1) : ''),
                          email: member.email,
                          pgy: member.pgy || '',
                          advisor: member.advisor || '',
                          role: member.role || 'resident',
                          has_account: member.has_account
                        });
                        setShowEditModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Person"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeletePerson(member.email)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Remove Person"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20 text-center" />
                  <p className="font-bold text-center">No members found matching your search.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800">Add Authorized Person</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
            </div>
            <form onSubmit={handleAddPerson} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">First Name</label>
                  <input 
                    type="text" 
                    required
                    value={newPerson.first_name}
                    onChange={(e) => setNewPerson({...newPerson, first_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                    placeholder="e.g. Jonathan"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Last Name</label>
                  <input 
                    type="text" 
                    required
                    value={newPerson.last_name}
                    onChange={(e) => setNewPerson({...newPerson, last_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                    placeholder="e.g. Carbungco"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Institutional Email</label>
                <input 
                  type="email" 
                  required
                  value={newPerson.email}
                  onChange={(e) => setNewPerson({...newPerson, email: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  placeholder="name@ascension.org"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">PGY Class / Role</label>
                  <select 
                    required
                    value={newPerson.pgy}
                    onChange={(e) => setNewPerson({...newPerson, pgy: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  >
                    <option value="">Select...</option>
                    {getRoleOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Faculty Advisor</label>
                  <input 
                    type="text"
                    value={newPerson.advisor}
                    onChange={(e) => setNewPerson({...newPerson, advisor: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">App Role</label>
                <select 
                  required
                  value={newPerson.role}
                  onChange={(e) => setNewPerson({...newPerson, role: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                >
                  <option value="resident">Resident</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Person'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800">Edit Authorized Person</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
            </div>
            <form onSubmit={handleEditPerson} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">First Name</label>
                  <input 
                    type="text" 
                    required
                    value={editingPerson.first_name}
                    onChange={(e) => setEditingPerson({...editingPerson, first_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Last Name</label>
                  <input 
                    type="text" 
                    required
                    value={editingPerson.last_name}
                    onChange={(e) => setEditingPerson({...editingPerson, last_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Institutional Email</label>
                <input 
                  type="email" 
                  disabled
                  value={editingPerson.email}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl border border-slate-200 outline-none text-slate-500 font-bold cursor-not-allowed"
                  title="Email cannot be changed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">PGY Class / Role</label>
                  <select 
                    required
                    value={editingPerson.pgy}
                    onChange={(e) => setEditingPerson({...editingPerson, pgy: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  >
                    <option value="">Select...</option>
                    {getRoleOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Faculty Advisor</label>
                  <input 
                    type="text"
                    value={editingPerson.advisor}
                    onChange={(e) => setEditingPerson({...editingPerson, advisor: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">App Role</label>
                <select 
                  required
                  value={editingPerson.role}
                  onChange={(e) => setEditingPerson({...editingPerson, role: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                >
                  <option value="resident">Resident</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showWizard && (
        <TransitionWizard
          roster={roster}
          onClose={() => setShowWizard(false)}
          onRefresh={fetchRoster}
        />
      )}
    </div>
  );
}
