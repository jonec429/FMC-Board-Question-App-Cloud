'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Users, Loader2, Mail, Trash2, Plus } from './AppIcons';

export default function RosterManager() {
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchRoster() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name');
        
        if (error) throw error;
        setRoster(data || []);
      } catch (err) {
        console.error('Roster fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoster();
  }, []);

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
        <button className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200">
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
            {filtered.length > 0 ? filtered.map((member) => (
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
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${member.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                    {member.role === 'admin' ? 'Faculty' : `PGY-${member.pgy || '?'}`}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.full_name ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                    <span className={`text-sm font-bold ${member.full_name ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {member.full_name ? 'Active' : 'Pending Invite'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Mail className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No members found matching your search.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
