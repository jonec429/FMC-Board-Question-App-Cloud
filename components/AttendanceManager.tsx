'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Clipboard, Check, AlertTriangle, Save, Loader2, Database } from './AppIcons';
import { withTimeout } from '@/lib/utils';
import Papa from 'papaparse';

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

  const processCSVContent = (csvString: string) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        if (data.length === 0) {
            alert("No data found.");
            setLoading(false);
            return;
        }
        
        const firstRow = data[0] as any;
        const newParsedData: any[] = [];
        const today = new Date().toISOString().split('T')[0];

        // Format 1: Granular CSV (Timestamp, Resident, Email, Conference Date, Topic, Status, Academic Points)
        if (firstRow['Timestamp'] !== undefined && firstRow['Resident'] !== undefined) {
           data.forEach((row: any) => {
               const status = row['Status']?.trim();
               const points = parseInt(row['Academic Points']) || 0;
               
               // Only give credit if Attended or Points > 0
               if (status === 'Attended' || points > 0) {
                   const residentName = row['Resident']?.trim();
                   const email = row['Email']?.trim();
                   const rawConfDate = row['Conference Date']?.trim();
                   const topic = row['Topic']?.trim();
                   
                   let confDate = today;
                   if (rawConfDate) {
                       try {
                           // Format usually "YYYY-MM-DD" or similar, just parse it safely
                           const parsedDate = new Date(rawConfDate);
                           if (!isNaN(parsedDate.getTime())) {
                               confDate = parsedDate.toISOString().split('T')[0];
                           }
                       } catch(e) {}
                   }

                   // Match with roster
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
           });
        } 
        // Format 2: Summary CSV (Person, Dept/Div, Status, Category, # Conferences, Present)
        else if (firstRow['Person'] !== undefined && firstRow['Present'] !== undefined) {
           data.forEach((row: any) => {
               const person = row['Person']?.trim(); // e.g. "Abernethy, Emily Catherine"
               const presentCount = parseInt(row['Present']) || 0;
               
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
                   
                   // Push an entry for EACH present count
                   for(let i=0; i < presentCount; i++) {
                       newParsedData.push({
                           raw: `${person} (Credit ${i+1}/${presentCount})`,
                           name: resident?.full_name || person,
                           email: resident?.email || null,
                           session_date: today, // Can't know specific dates from summary
                           matched: !!resident
                       });
                   }
               }
           });
        } 
        // Fallback: Unstructured plain text paste
        else {
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
      },
      error: (error) => {
         console.error('Papaparse error:', error);
         alert("Error parsing CSV");
         setLoading(false);
      }
    });
  };

  const saveAttendance = async () => {
    setSaving(true);
    
    const validEntries = parsedData.filter(p => p.matched).map(p => ({
      email: p.email,
      full_name: p.name,
      session_date: p.session_date,
      method: 'Monthly Bulk Upload'
    }));

    if (validEntries.length === 0) {
        alert("No valid matched entries to save.");
        setSaving(false);
        return;
    }

    const { error } = await supabase.from('attendance').insert(validEntries);
    
    if (error) {
      alert('Error saving attendance: ' + error.message);
    } else {
      alert(`Successfully saved ${validEntries.length} attendance credits!`);
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
          <p className="text-slate-500 font-medium max-w-lg">Upload your New Innovations CSV or paste the raw export text below. The engine supports both granular and summary reports.</p>
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
            
            <div className="mb-6">
              <label className="block w-full p-6 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer group">
                <input 
                  type="file" 
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload} 
                />
                <Database className="w-8 h-8 text-blue-400 group-hover:text-blue-500 mb-2 transition-colors" />
                <span className="font-bold text-blue-700">Select a CSV File</span>
                <span className="text-xs text-blue-500 mt-1 font-medium">Auto-parses summary or granular exports</span>
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
    </div>
  );
}
