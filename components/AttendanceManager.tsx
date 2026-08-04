'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Clipboard, Check, AlertTriangle, Save, Loader2, Database, PlusCircle, Calendar, FileText } from './AppIcons';
import { withTimeout } from '@/lib/utils';
import Papa from 'papaparse';
import { getCurrentAcademicYear, getAvailableAcademicYears, formatAcademicYear } from '@/lib/academicYear';

export default function AttendanceManager() {
  const [activeTab, setActiveTab] = useState<'bulk' | 'manual'>('bulk');
  const [pasteContent, setPasteContent] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentAcademicYear());
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');

  // Manual Award state
  const [manualEmail, setManualEmail] = useState('');
  const [manualPoints, setManualPoints] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [rosterRes, blocksRes] = await Promise.all([
          withTimeout(supabase.from('authorized_roster').select('email, name')),
          withTimeout(supabase.from('blocks').select('*').order('sort_order', { ascending: true }))
        ]);
        if (rosterRes.data) {
          setRoster(rosterRes.data.map((r: any) => ({ email: r.email, full_name: r.name })));
        }
        if (blocksRes.data) {
          setBlocks(blocksRes.data);
        }
      } catch (err) {
        console.error('Attendance fetch error:', err);
      }
    }
    fetchData();
  }, []);

  const sortedRoster = [...roster].sort((a, b) => {
    const nameA = a.full_name || '';
    const nameB = b.full_name || '';
    return nameA.localeCompare(nameB);
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteContent(text); // Also show it in the textarea
        processCSVContent(text);
      } else {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleSmartPaste = () => {
    setLoading(true);
    processCSVContent(pasteContent);
  };

  const processCSVContent = async (csvString: string) => {
    if (!csvString || !csvString.trim()) {
      alert("No data found.");
      setLoading(false);
      return;
    }

    let data: string[][] = [];

    // Check if input contains HTML table elements (e.g. <table, <tr, <td)
    const trimmed = csvString.trim();
    if (/<table|<tr|<td/i.test(trimmed)) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'text/html');
        const rows = Array.from(doc.querySelectorAll('tr'));
        if (rows.length > 0) {
          data = rows.map(tr => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            return cells.map(td => td.textContent?.trim() || '');
          }).filter(row => row.some(cell => cell.length > 0));
        }
      } catch (e) {
        console.warn('DOMParser failed, falling back to PapaParse', e);
      }
    }

    // Fallback to PapaParse if HTML parsing didn't produce data
    if (data.length === 0) {
      data = await new Promise<string[][]>((resolve) => {
        Papa.parse(csvString, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => resolve((results.data as string[][]) || []),
          error: () => resolve([])
        });
      });
    }

    if (data.length === 0) {
      alert("No data found.");
      setLoading(false);
      return;
    }

    const newParsedData: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Find header row by looking for known columns
    let headerRowIndex = -1;
    let format: 'granular' | 'summary' | 'unknown' = 'unknown';

    for (let i = 0; i < Math.min(15, data.length); i++) {
       const row = data[i].map(c => c ? c.trim().toLowerCase() : '');
       if (row.includes('timestamp') && row.includes('resident')) {
           headerRowIndex = i;
           format = 'granular';
           break;
       } else if (row.includes('person') && row.includes('present')) {
           headerRowIndex = i;
           format = 'summary';
           break;
       }
    }

    if (format === 'granular') {
       const headers = data[headerRowIndex].map(h => h ? h.trim() : '');
       const residentIdx = headers.indexOf('Resident');
       const emailIdx = headers.indexOf('Email');
       const dateIdx = headers.indexOf('Conference Date');
       const topicIdx = headers.indexOf('Topic');
       const statusIdx = headers.indexOf('Status');
       const pointsIdx = headers.indexOf('Academic Points');

       for (let i = headerRowIndex + 1; i < data.length; i++) {
           const row = data[i];
           const status = statusIdx >= 0 ? row[statusIdx]?.trim() : '';
           const points = pointsIdx >= 0 ? parseInt(row[pointsIdx]) || 0 : 0;
           
           if (status === 'Attended' || points > 0) {
               const residentName = residentIdx >= 0 ? row[residentIdx]?.trim() : '';
               const email = emailIdx >= 0 ? row[emailIdx]?.trim() : '';
               const rawConfDate = dateIdx >= 0 ? row[dateIdx]?.trim() : '';
               const topic = topicIdx >= 0 ? row[topicIdx]?.trim() : '';
               
               let confDate = today;
               if (rawConfDate) {
                   try {
                       const parsedDate = new Date(rawConfDate);
                       if (!isNaN(parsedDate.getTime())) {
                           confDate = parsedDate.toISOString().split('T')[0];
                       }
                   } catch(e) {}
               }

               const resident = roster.find(r => 
                   (email && r.email && email.toLowerCase() === r.email.toLowerCase()) || 
                   (residentName && r.full_name && r.full_name.toLowerCase() === residentName.toLowerCase()) ||
                   (residentName && r.full_name && r.full_name.toLowerCase().includes(residentName.toLowerCase()))
               );
               
               newParsedData.push({
                   raw: `${residentName} - ${topic || 'Conference'} (${confDate})`,
                   name: resident?.full_name || residentName,
                   email: resident?.email || null,
                   session_date: confDate,
                   matched: !!resident
               });
           }
       }
    } 
    else if (format === 'summary') {
       const headers = data[headerRowIndex].map(h => h ? h.trim() : '');
       const personIdx = headers.indexOf('Person');
       const presentIdx = headers.indexOf('Present');

       for (let i = headerRowIndex + 1; i < data.length; i++) {
           const row = data[i];
           const person = personIdx >= 0 ? row[personIdx]?.trim() : '';
           // Ignore totals rows & header repeats
           if (!person || person.toLowerCase() === 'totals:' || person.toLowerCase() === 'grand totals' || person.toLowerCase() === 'person') continue;

           const presentCount = presentIdx >= 0 ? parseInt(row[presentIdx]) || 0 : 0;
           
           if (presentCount > 0) {
               const resident = roster.find(r => {
                  if (!r.full_name || !person) return false;
                  const parts = person.split(',');
                  if (parts.length >= 2) {
                      const last = parts[0].trim().toLowerCase();
                      const first = parts[1].trim().toLowerCase().split(' ')[0];
                      const rName = r.full_name.toLowerCase();
                      return rName.includes(last) && rName.includes(first);
                  }
                  return r.full_name.toLowerCase().includes(person.toLowerCase());
               });
               
               for(let j=0; j < presentCount; j++) {
                   newParsedData.push({
                       raw: `${person} (Credit ${j+1}/${presentCount})`,
                       name: resident?.full_name || person,
                       email: resident?.email || null,
                       session_date: today,
                       matched: !!resident
                   });
               }
           }
       }
    } 
    else {
       // Fallback unstructured
       const rawItems = csvString.split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
       rawItems.forEach(item => {
          const lowerItem = item.toLowerCase();
          const resident = roster.find(r => 
            (r.email && lowerItem.includes(r.email.toLowerCase())) || 
            (r.full_name && r.full_name.toLowerCase().includes(lowerItem)) ||
            (r.full_name && lowerItem.includes(r.full_name.toLowerCase()))
          );
          newParsedData.push({
            raw: item,
            name: resident?.full_name || item,
            email: resident?.email || null,
            session_date: today,
            matched: !!resident
          });
       });
    }
    
    setParsedData(newParsedData);
    setLoading(false);
  };

  const saveAttendance = async () => {
    if (!selectedBlockId) {
      alert("Please select a target Block to assign this attendance to.");
      return;
    }
    const targetBlock = blocks.find(b => b.id === selectedBlockId);
    if (!targetBlock) return;

    setSaving(true);
    
    const validEntries = parsedData.filter(p => p.matched).map(p => ({
      resident_email: p.email,
      resident_name: p.name,
      date: p.session_date,
      status: 'Attended',
      points: 1,
      topic: `[AY ${selectedYear}] Block: ${targetBlock.title}`
    }));

    if (validEntries.length === 0) {
      alert("No matched residents to save.");
      setSaving(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/admin/bulk-attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ entries: validEntries })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save attendance');
      }

      alert(`Successfully saved ${validEntries.length} attendance credits to ${targetBlock.title}!`);
      setParsedData([]);
      setPasteContent('');
    } catch (e: any) {
      alert('Error saving attendance: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSuccessMsg(null);

    if (!manualEmail) {
      alert("Please select a resident from the roster.");
      return;
    }
    if (!selectedBlockId) {
      alert("Please select a target Block to assign points to.");
      return;
    }

    const targetBlock = blocks.find(b => b.id === selectedBlockId);
    if (!targetBlock) return;

    const resident = roster.find(r => r.email === manualEmail);
    if (!resident) return;

    setManualSaving(true);

    const baseTopic = `[AY ${selectedYear}] Block: ${targetBlock.title}`;
    const fullTopic = manualDescription.trim()
      ? `${baseTopic} - ${manualDescription.trim()}`
      : baseTopic;

    const validEntries = [{
      resident_email: resident.email,
      resident_name: resident.full_name,
      date: manualDate || new Date().toISOString().split('T')[0],
      status: 'Attended',
      points: manualPoints > 0 ? manualPoints : 1,
      topic: fullTopic
    }];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/admin/bulk-attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ entries: validEntries })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to award attendance points');
      }

      setManualSuccessMsg(`Successfully awarded ${manualPoints} attendance point(s) to ${resident.full_name}!`);
      setManualDescription('');
      setManualPoints(1);
    } catch (err: any) {
      alert('Error awarding manual attendance: ' + err.message);
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Center</h2>
            <p className="text-slate-500 font-medium max-w-lg">Bulk import monthly New Innovations reports or manually award attendance points to specific residents.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl shrink-0">
          <button
            onClick={() => { setActiveTab('bulk'); setManualSuccessMsg(null); }}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'bulk'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            Bulk Import (NI Export)
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setManualSuccessMsg(null); }}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'manual'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Manual Point Award
          </button>
        </div>
      </div>

      {activeTab === 'bulk' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-900 rounded-xl text-white">
                  <Clipboard className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-slate-800">NI Data Ingestion</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    {getAvailableAcademicYears().map(year => (
                      <option key={year} value={year}>{formatAcademicYear(year)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Block</label>
                  <select
                    value={selectedBlockId}
                    onChange={(e) => setSelectedBlockId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="" disabled>Select Block...</option>
                    {blocks
                      .filter(b => {
                        const year = b.academic_year ? Number(b.academic_year) : getCurrentAcademicYear();
                        return year === selectedYear;
                      })
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                  </select>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block w-full p-6 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer group">
                  <input 
                    type="file" 
                    accept=".csv,.html,.txt"
                    className="hidden"
                    onChange={handleFileUpload} 
                  />
                  <Database className="w-8 h-8 text-blue-400 group-hover:text-blue-500 mb-2 transition-colors" />
                  <span className="font-bold text-blue-700">Select an Export File</span>
                  <span className="text-xs text-blue-500 mt-1 font-medium">Supports CSV, HTML, or raw text exports</span>
                </label>
              </div>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">or paste text</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste raw New Innovations export text here..."
                className="w-full h-40 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all font-mono text-xs"
              />
              
              <button
                onClick={handleSmartPaste}
                disabled={!pasteContent.trim() || loading}
                className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-xl shadow-blue-100"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Analyze Text Content
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
                    <p className="font-bold text-slate-200">Waiting for data...</p>
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
      ) : (
        /* Manual Point Award Form */
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Manually Award Attendance Points</h3>
              <p className="text-xs text-slate-500 font-medium">Assign customized attendance credits directly to an individual resident.</p>
            </div>
          </div>

          {manualSuccessMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 font-bold text-sm">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{manualSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualSave} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Resident <span className="text-red-500">*</span>
              </label>
              <select
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                <option value="" disabled>Select Resident from Roster...</option>
                {sortedRoster.map(r => (
                  <option key={r.email} value={r.email}>{r.full_name} ({r.email})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                >
                  {getAvailableAcademicYears().map(year => (
                    <option key={year} value={year}>{formatAcademicYear(year)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Target Block <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                >
                  <option value="" disabled>Select Block...</option>
                  {blocks
                    .filter(b => {
                      const year = b.academic_year ? Number(b.academic_year) : getCurrentAcademicYear();
                      return year === selectedYear;
                    })
                    .map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Points / Credits to Award <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={manualPoints}
                  onChange={(e) => setManualPoints(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Award Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Description / Note</span>
                <span className="text-slate-400 font-normal normal-case text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="e.g. Simulation Lab Credit, Noon Conference Makeup, Chief Award..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={manualSaving || !manualEmail || !selectedBlockId}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-xl shadow-blue-100"
            >
              {manualSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Award Attendance Points Now
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

