'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Clipboard, Check, AlertTriangle, Save, Loader2 } from './icons';

export default function AttendanceManager() {
  const [pasteContent, setPasteContent] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSmartPaste = async () => {
    setLoading(true);
    // Logic: Split lines, find emails/names, match with roster
    const lines = pasteContent.split('\n').filter(l => l.trim());
    
    // Fetch roster for matching
    const { data: roster } = await supabase.from('authorized_roster').select('*');
    
    const matched = lines.map(line => {
      const lowerLine = line.toLowerCase();
      const resident = roster?.find(r => 
        lowerLine.includes(r.email.toLowerCase()) || 
        lowerLine.includes(r.name.toLowerCase())
      );
      
      return {
        raw: line,
        name: resident?.name || 'Unknown',
        email: resident?.email || null,
        matched: !!resident
      };
    });

    setParsedData(matched);
    setLoading(false);
  };

  const saveAttendance = async () => {
    setSaving(true);
    const validEntries = parsedData.filter(p => p.matched).map(p => ({
      email: p.email,
      full_name: p.name,
      session_date: new Date().toISOString().split('T')[0],
      method: 'Smart Paste'
    }));

    const { error } = await supabase.from('attendance').insert(validEntries);
    
    if (error) {
      alert('Error saving attendance: ' + error.message);
    } else {
      alert(`Successfully saved attendance for ${validEntries.length} residents!`);
      setPasteContent('');
      setParsedData([]);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Paste Area */}
        <div className="space-y-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-900 rounded-xl text-white">
                <Clipboard className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Smart Paste Ingestion</h3>
            </div>
            
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste raw attendance list here (emails, names, or CSV text)..."
              className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all font-mono text-sm"
            />
            
            <button
              onClick={handleSmartPaste}
              disabled={!pasteContent.trim() || loading}
              className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Analyze Attendance
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="space-y-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Review Match ({parsedData.length})</h3>
              </div>
              
              {parsedData.some(p => p.matched) && (
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save to Cloud
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {parsedData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <Clipboard className="w-12 h-12 mb-2 opacity-20" />
                  <p className="font-bold">Waiting for input...</p>
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
