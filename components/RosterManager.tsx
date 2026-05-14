'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Users, Loader2, Mail, Trash2, Plus, Edit3 } from './AppIcons';
import { withTimeout } from '@/lib/utils';

export default function RosterManager() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: '', email: '', pgy: '', advisor: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState({ name: '', email: '', pgy: '', advisor: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const fetchTask = Promise.all([
        supabase.from('authorized_roster').select('*').order('name'),
        supabase.from('profiles').select('email, id')
      ]);
      const [{ data: authorized, error: authError }, { data: profiles }] = await withTimeout(fetchTask);

      if (authError) throw authError;

      // Merge them
      const merged = authorized?.map(auth => {
        const profile = profiles?.find(p => p.email === auth.email);
        return {
          ...auth,
          full_name: auth.name,
          has_account: !!profile,
          profile_id: profile?.id
        };
      }) || [];

      setRoster(merged);
    } catch (err: any) {
      console.error('Roster fetch error:', err);
      setError(err.message || 'Failed to fetch roster. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('authorized_roster')
        .insert([{
          name: newPerson.name,
          email: newPerson.email.toLowerCase().trim(),
          pgy: newPerson.pgy,
          advisor: newPerson.advisor
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewPerson({ name: '', email: '', pgy: '', advisor: '' });
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
      const { error } = await supabase
        .from('authorized_roster')
        .update({
          name: editingPerson.name,
          pgy: editingPerson.pgy,
          advisor: editingPerson.advisor
        })
        .eq('email', editingPerson.email);

      if (error) throw error;
      
      setShowEditModal(false);
      setEditingPerson({ name: '', email: '', pgy: '', advisor: '' });
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

  const filtered = roster.filter(m => 
    m.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Program Roster...</p>
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
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-5 h-5" />
          Add Authorized Person
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-6">Member</th>
              <th className="px-8 py-6">Class / Role</th>
              <th className="px-8 py-6">Account Status</th>
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
                    <p className="font-medium text-red-500 mb-4 text-xs text-center">{error}</p>
                    <button 
                      onClick={() => fetchRoster()}
                      className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-xs"
                    >
                      Retry Fetch
                    </button>
                  </div>
                </td>
              </tr>
            ) : filtered.length > 0 ? filtered.map((member) => (
              <tr key={member.id} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {member.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{member.full_name || 'Incomplete Profile'}</p>
                      <p className="text-xs font-medium text-slate-400">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-block w-fit ${member.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                      {member.role === 'admin' ? 'Faculty' : member.pgy || 'Resident'}
                    </span>
                    {member.advisor && (
                      <span className="text-[10px] font-bold text-slate-400 pl-1 italic">
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
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => {
                        setEditingPerson({
                          name: member.full_name || '',
                          email: member.email,
                          pgy: member.pgy || '',
                          advisor: member.advisor || ''
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
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({...newPerson, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  placeholder="e.g. Jonathan Carbungco"
                />
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
                    <option value="Class of 2025">Class of 2025 (PGY3)</option>
                    <option value="Class of 2026">Class of 2026 (PGY2)</option>
                    <option value="Class of 2027">Class of 2027 (PGY1)</option>
                    <option value="Class of 2028">Class of 2028</option>
                    <option value="Faculty">Faculty / Admin</option>
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
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editingPerson.name}
                  onChange={(e) => setEditingPerson({...editingPerson, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                />
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
                    <option value="Class of 2025">Class of 2025 (PGY3)</option>
                    <option value="Class of 2026">Class of 2026 (PGY2)</option>
                    <option value="Class of 2027">Class of 2027 (PGY1)</option>
                    <option value="Class of 2028">Class of 2028</option>
                    <option value="Faculty">Faculty / Admin</option>
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
    </div>
  );
}
