'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Trash2, Mail, GraduationCap, Search, Loader2 } from './icons';

export default function RosterManager() {
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: '', email: '', pgy: 'Class of 2027', advisor: '' });

  useEffect(() => {
    fetchRoster();
  }, []);

  async function fetchRoster() {
    setLoading(true);
    const { data } = await supabase.from('authorized_roster').select('*').order('name');
    setRoster(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newPerson.name || !newPerson.email) return;
    const { error } = await supabase.from('authorized_roster').insert([newPerson]);
    if (!error) {
      setShowAddForm(false);
      setNewPerson({ name: '', email: '', pgy: 'Class of 2027', advisor: '' });
      fetchRoster();
    }
  }

  async function handleDelete(email: string) {
    if (!confirm('Are you sure you want to remove this person from the authorized roster?')) return;
    const { error } = await supabase.from('authorized_roster').delete().eq('email', email);
    if (!error) fetchRoster();
  }

  const filteredRoster = roster.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search residents or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
          />
        </div>
        
        <button 
          onClick={() => setShowAddForm(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <Plus className="w-5 h-5" />
          Add Authorized Person
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-xl animate-in zoom-in-95 duration-200">
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Add New Program Member
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input 
              placeholder="Full Name"
              value={newPerson.name}
              onChange={e => setNewPerson({...newPerson, name: e.target.value})}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold"
            />
            <input 
              placeholder="Email Address"
              value={newPerson.email}
              onChange={e => setNewPerson({...newPerson, email: e.target.value})}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold"
            />
            <select 
              value={newPerson.pgy}
              onChange={e => setNewPerson({...newPerson, pgy: e.target.value})}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold"
            >
              <option>Class of 2026</option>
              <option>Class of 2027</option>
              <option>Class of 2028</option>
              <option>Faculty</option>
            </select>
            <input 
              placeholder="Advisor"
              value={newPerson.advisor}
              onChange={e => setNewPerson({...newPerson, advisor: e.target.value})}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold"
            />
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button onClick={() => setShowAddForm(false)} className="px-6 py-3 font-black text-slate-400 hover:text-slate-600">Cancel</button>
            <button onClick={handleAdd} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-100">Add to Roster</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class / Role</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredRoster.map(person => (
              <tr key={person.email} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {person.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 leading-none mb-1">{person.name}</span>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {person.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg w-fit">
                    <GraduationCap className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{person.pgy}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <button 
                    onClick={() => handleDelete(person.email)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
