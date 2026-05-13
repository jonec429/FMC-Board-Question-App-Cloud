'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Loader2, Plus, Trash2, Save, X, CheckCircle, ChevronRight } from './AppIcons';

interface Block {
  id: string;
  title: string;
  block_type?: string;
  question_count?: number;
}

interface ScheduleRow {
  id: string;
  block_id: string;
  start_date: string;
  end_date: string;
  block?: Block;
}

interface EditDraft {
  id?: string;            // present when editing existing row
  block_id: string;
  start_date: string;
  end_date: string;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
}

function isActive(row: ScheduleRow): boolean {
  const today = todayISO();
  return row.start_date <= today && today <= row.end_date;
}

function isUpcoming(row: ScheduleRow): boolean {
  return row.start_date > todayISO();
}

export default function BlockScheduleManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // === Load both blocks and schedule ===
  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: blockData }, { data: scheduleData }] = await Promise.all([
        supabase.from('blocks').select('id, title, block_type, question_count').order('title'),
        supabase
          .from('block_schedule')
          .select('id, block_id, start_date, end_date, blocks(id, title, block_type, question_count)')
          .order('start_date', { ascending: true }),
      ]);

      setBlocks(blockData || []);

      const normalized: ScheduleRow[] = (scheduleData || []).map((s: any) => ({
        id: s.id,
        block_id: s.block_id,
        start_date: s.start_date,
        end_date: s.end_date,
        block: Array.isArray(s.blocks) ? s.blocks[0] : s.blocks,
      }));
      setRows(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Lookup helper so we can show block title for a row even if join didn't populate
  const blocksById = useMemo(() => {
    const m = new Map<string, Block>();
    blocks.forEach(b => m.set(b.id, b));
    return m;
  }, [blocks]);

  // === Drafts ===
  const openNewDraft = () => {
    setDraft({
      block_id: '',
      start_date: todayISO(),
      end_date: todayISO(),
    });
  };

  const openEditDraft = (row: ScheduleRow) => {
    setDraft({
      id: row.id,
      block_id: row.block_id,
      start_date: row.start_date,
      end_date: row.end_date,
    });
  };

  const cancelDraft = () => setDraft(null);

  const saveDraft = async () => {
    if (!draft) return;
    setError(null);
    if (!draft.block_id) {
      setError('Please select a block.');
      return;
    }
    if (!draft.start_date || !draft.end_date) {
      setError('Both start and end dates are required.');
      return;
    }
    if (draft.start_date > draft.end_date) {
      setError('Start date must be on or before end date.');
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        const { error: updateErr } = await supabase
          .from('block_schedule')
          .update({
            block_id: draft.block_id,
            start_date: draft.start_date,
            end_date: draft.end_date,
          })
          .eq('id', draft.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('block_schedule')
          .insert({
            block_id: draft.block_id,
            start_date: draft.start_date,
            end_date: draft.end_date,
          });
        if (insertErr) throw insertErr;
      }
      setDraft(null);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm('Remove this scheduled block? Residents will no longer see it as the active block.')) return;
    setError(null);
    const { error: delErr } = await supabase.from('block_schedule').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    await fetchAll();
  };

  // === Derived groupings for display ===
  const activeRow = rows.find(isActive);
  const upcomingRows = rows.filter(isUpcoming);
  const pastRows = rows.filter(r => !isActive(r) && !isUpcoming(r));

  // === Renderers ===
  const renderRow = (row: ScheduleRow) => {
    const block = row.block || blocksById.get(row.block_id);
    const len = daysBetween(row.start_date, row.end_date);
    const active = isActive(row);
    return (
      <tr
        key={row.id}
        className={`border-b border-slate-50 transition-all ${active ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {active && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
            <div>
              <p className="font-bold text-slate-800 text-sm">{block?.title || '— deleted block —'}</p>
              {block?.block_type && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {block.block_type}{block.question_count ? ` · ${block.question_count} Qs` : ''}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-4 text-center text-sm font-bold text-slate-600 tabular-nums">{row.start_date}</td>
        <td className="px-4 py-4 text-center text-sm font-bold text-slate-600 tabular-nums">{row.end_date}</td>
        <td className="px-4 py-4 text-center text-xs font-black text-slate-500">{len} day{len !== 1 ? 's' : ''}</td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => openEditDraft(row)}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              Edit
            </button>
            <button
              onClick={() => deleteRow(row.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Remove from schedule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // === Loading state ===
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Block Schedule</h2>
            <p className="text-slate-500 font-medium max-w-xl">
              Set the date range for each Board Review block. Residents see only the active block as "on time" — completion outside the window awards reduced points.
            </p>
          </div>
        </div>
        <button
          onClick={openNewDraft}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Schedule a Block
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 font-bold flex items-center gap-3">
          <X className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Block Hero */}
      {activeRow ? (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[32px] p-8 text-white shadow-xl shadow-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Active Block</p>
            <h3 className="text-3xl font-black mb-1">
              {(activeRow.block || blocksById.get(activeRow.block_id))?.title || '— Unknown Block —'}
            </h3>
            <p className="text-emerald-100 font-bold text-sm">
              {activeRow.start_date} → {activeRow.end_date} ({daysBetween(activeRow.start_date, activeRow.end_date)} days)
            </p>
          </div>
          <button
            onClick={() => openEditDraft(activeRow)}
            className="px-5 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-black text-sm backdrop-blur-sm transition-all"
          >
            Edit Window
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-[32px] p-8 text-amber-800 flex items-center gap-4">
          <Calendar className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <p className="font-black">No block is currently active</p>
            <p className="text-sm font-bold text-amber-700/70">Residents who take blocks today will earn reduced ("Late") points until you schedule a block covering today's date.</p>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingRows.length > 0 && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-blue-500" />
              Upcoming ({upcomingRows.length})
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="text-left px-6 py-3">Block</th>
                <th className="text-center px-4 py-3">Start</th>
                <th className="text-center px-4 py-3">End</th>
                <th className="text-center px-4 py-3">Length</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>{upcomingRows.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      {/* Past */}
      {pastRows.length > 0 && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden opacity-90">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h3 className="font-black text-slate-500">Past ({pastRows.length})</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="text-left px-6 py-3">Block</th>
                <th className="text-center px-4 py-3">Start</th>
                <th className="text-center px-4 py-3">End</th>
                <th className="text-center px-4 py-3">Length</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>{pastRows.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-black text-slate-700">No blocks scheduled yet</p>
          <p className="text-sm font-bold text-slate-400 mt-2 max-w-md mx-auto">
            Click "Schedule a Block" to add a date range for each Board Review block. Residents see only the currently-scheduled block in their dashboard.
          </p>
        </div>
      )}

      {/* Draft Modal */}
      {draft && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">
                {draft.id ? 'Edit Scheduled Block' : 'Schedule a Block'}
              </h3>
              <button onClick={cancelDraft} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Block</label>
                <select
                  value={draft.block_id}
                  onChange={(e) => setDraft({ ...draft, block_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                >
                  <option value="">Select a block…</option>
                  {blocks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title}{b.block_type ? ` (${b.block_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={draft.end_date}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                  />
                </div>
              </div>
              {draft.block_id && draft.start_date && draft.end_date && (
                <p className="text-xs font-bold text-slate-500 bg-slate-50 rounded-xl p-3">
                  Length: <span className="text-slate-800">{daysBetween(draft.start_date, draft.end_date)} day(s)</span>
                </p>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={cancelDraft}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {draft.id ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
