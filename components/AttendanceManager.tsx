'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Clipboard, Check, AlertTriangle, Save, Loader2, Database } from './AppIcons';
import { withTimeout } from '@/lib/utils';

export default function AttendanceManager() {
  const [pasteContent, setPasteContent] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRoster() {
      try {
        const { data } = await withTimeout(supabase.from('authorized_roster').select('email, name'));
        if (data) {
          setRoster(data.map((r: any) => ({ email: r.email, full_name: r.name })));
        }
      } catch (err) {
        console.error('Attendance fetch error:', err);
      }
    }
    fetchRoster();
  }, []);

  const handleSmartPaste = async () => {
    setLoading(true);
    // Logic: Split lines/commas, find emails/names, match with roster
    const rawItems = pasteContent.split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
    
    const matched = rawItems.map(item => {
      const lowerItem = item.toLowerCase();
      // Try to find by email or full name (fuzzy)
      const resident = roster.find(r => 
        lowerItem.includes(r.email?.toLowerCase()) || 
        r.full_name?.toLowerCase().includes(lowerItem) ||
        lowerItem.includes(r.full_name?.toLowerCase())
      );
      
      return {
        raw: item,
        name: resident?.full_name || item,
        email: resident?.email || null,
        matched: !!resident
      };
    });

    // For Monthly Bulk: We KEEP all matches (if a name appears 4 times, they get 4 credits)
    setParsedData(matched);
    setLoading(false);
  };

  const saveAttendance = async () => {
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    
    const validEntries = parsedData.filter(p => p.matched).map(p => ({
      email: p.email,
      full_name: p.name,
      session_date: today, // Record the bulk upload date
      method: 'Monthly Bulk Upload'
    }));

    const { error } = await supabase.from('attendance').insert(validEntries);
    
    if (error) {
      alert('Error saving attendance: ' + error.message);
    } else {
      alert(`Successfully saved ${validEntries.length} attendance credits for the month!`);
      setPasteContent('');
      setParsedData([]);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Monthly Bulk Attendance</h2>
          <p className="text-slate-500 font-medium max-w-lg">Paste your New Innovations export below. The engine will automatically match residents and assign multiple credits based on the list.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-900 rounded-xl text-white">
                <Clipboard className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-800">NI Data Ingestion</h3>
            </div>
            
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste raw New Innovations export text here..."
              className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all font-mono text-sm"
            />
            
            <button
              onClick={handleSmartPaste}
              disabled={!pasteContent.trim() || loading}
              className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-xl shadow-blue-100"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Analyze Monthly Bulk
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Matched Credits ({parsedData.filter(p=>p.matched).length})</h3>
              </div>
              
              {parsedData.some(p => p.matched) && (
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Confirm Bulk Save
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {parsedData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <Clipboard className="w-12 h-12 mb-2 opacity-10" />
                  <p className="font-bold text-slate-200">Waiting for NI export...</p>
                </div>
              ) : (
                parsedData.map((person, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-2xl border flex items-center justify-between ${person.matched ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold ${person.matched ? 'text-emerald-900' : 'text-red-900'}`}>{person.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{person.raw}</span>
                    </div>
                    {person.matched ? (
                      <Check className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
