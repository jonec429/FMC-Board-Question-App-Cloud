'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Database, Loader2, CheckCircle, XCircle, AlertTriangle, Save, Clipboard, Sparkles,
} from './AppIcons';
import { parseAndValidate, ParseSummary, RowResult, CANONICAL_CATEGORIES } from '@/lib/csvImport';

type Phase = 'input' | 'preview' | 'importing' | 'done';

const SAMPLE_CSV = `year,category,question_text,option_a,option_b,option_c,option_d,option_e,correct,explanation,resource_link
2025,Cardiovascular,"A 55-year-old male with hypertension presents with new-onset chest pain. ECG shows ST elevation. What is the next best step?","Aspirin 325mg","Heparin drip","Reperfusion therapy","CT angiogram","Stress test",C,"For STEMI, time to reperfusion is critical. Aspirin alone is insufficient.","Smith J. STEMI management. JAMA 2024."`;

export default function QuestionImporter() {
  const [phase, setPhase] = useState<Phase>('input');
  const [csvText, setCsvText] = useState('');
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [existingTexts, setExistingTexts] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [insertedCount, setInsertedCount] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // === File upload handler ===
  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  // === Parse & Preview ===
  const handleParse = async () => {
    setServerError(null);
    const result = parseAndValidate(csvText);
    setSummary(result);

    // Pre-fetch existing question_texts for duplicate detection
    if (result.validCount > 0 && !result.headerError) {
      const { data } = await supabase.from('questions').select('question_text');
      setExistingTexts(new Set((data || []).map((d: any) => d.question_text)));
    } else {
      setExistingTexts(new Set());
    }
    setPhase('preview');
  };

  // Rows split into buckets for the preview UI
  const buckets = useMemo(() => {
    if (!summary) return { valid: [], dupes: [], errors: [] };
    const valid: RowResult[] = [];
    const dupes: RowResult[] = [];
    const errors: RowResult[] = [];
    summary.results.forEach(r => {
      if (r.errors.length > 0) {
        errors.push(r);
      } else if (r.question && existingTexts.has(r.question.question_text)) {
        dupes.push(r);
      } else {
        valid.push(r);
      }
    });
    return { valid, dupes, errors };
  }, [summary, existingTexts]);

  // === Confirm Import → push to Supabase ===
  const handleImport = async () => {
    if (!summary) return;
    setImporting(true);
    setServerError(null);
    setPhase('importing');

    // Build the insert payload
    const toInsert: any[] = [];
    summary.results.forEach(r => {
      if (r.errors.length > 0 || !r.question) return;
      const isDupe = existingTexts.has(r.question.question_text);
      if (isDupe && !allowDuplicates) return;
      toInsert.push({
        year: r.question.year,
        category: r.question.category,
        system: r.question.system,
        abfm_category: '', // legacy column, kept empty
        question_text: r.question.question_text,
        options: r.question.options, // Supabase JSONB column
        correct_index: r.question.correct_index,
        explanation: r.question.explanation,
        resource_link: r.question.resource_link,
      });
    });

    if (toInsert.length === 0) {
      setServerError('Nothing to import — all rows had errors or were duplicates.');
      setImporting(false);
      setPhase('preview');
      return;
    }

    const { error } = await supabase.from('questions').insert(toInsert);
    if (error) {
      setServerError(error.message);
      setImporting(false);
      setPhase('preview');
      return;
    }

    setInsertedCount(toInsert.length);
    setImporting(false);
    setPhase('done');
  };

  const handleReset = () => {
    setPhase('input');
    setCsvText('');
    setSummary(null);
    setExistingTexts(new Set());
    setInsertedCount(0);
    setServerError(null);
  };

  // === Render: Input Phase ===
  if (phase === 'input') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        {/* Hero */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Database className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bulk Import Questions</h2>
            <p className="text-slate-500 font-medium max-w-2xl mt-1">
              Paste or upload a CSV of questions. The parser validates each row before anything is written —
              you'll see a preview with errors, warnings, and duplicate detection before confirming.
            </p>
          </div>
        </div>

        {/* Format Hint */}
        <details className="bg-white rounded-3xl border border-slate-100 shadow-sm group">
          <summary className="cursor-pointer p-6 font-black text-slate-800 flex items-center gap-3 list-none">
            <Sparkles className="w-5 h-5 text-blue-500" />
            CSV Format Reference
            <span className="text-xs font-bold text-slate-400 ml-auto group-open:hidden">click to expand</span>
          </summary>
          <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Required columns</p>
              <div className="flex flex-wrap gap-2">
                {['category', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct'].map(c => (
                  <span key={c} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Optional columns</p>
              <div className="flex flex-wrap gap-2">
                {['year', 'option_e', 'explanation', 'resource_link'].map(c => (
                  <span key={c} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</p>
              <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
                <li><b>correct</b>: letter (A, B, C, D, E) or 0-indexed number — letter is recommended</li>
                <li><b>option_e</b>: leave blank if the question has only 4 options</li>
                <li><b>category</b>: must match one of the {CANONICAL_CATEGORIES.length} canonical categories (case-insensitive, common aliases auto-corrected)</li>
                <li><b>Duplicates</b>: rows with identical <code>question_text</code> to existing DB rows will be flagged before import</li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sample row</p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre">{SAMPLE_CSV}</pre>
              <button
                onClick={() => setCsvText(SAMPLE_CSV)}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline"
              >
                Load sample into editor →
              </button>
            </div>
          </div>
        </details>

        {/* Input */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center gap-3 justify-between flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-xl text-white">
                <Clipboard className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Paste CSV or Upload File</h3>
            </div>
            <label className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-2">
              Upload .csv
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV here…"
            className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all font-mono text-sm leading-relaxed"
          />

          <button
            onClick={handleParse}
            disabled={!csvText.trim()}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-100"
          >
            <CheckCircle className="w-5 h-5" />
            Parse &amp; Validate
          </button>
        </div>
      </div>
    );
  }

  // === Render: Preview Phase ===
  if (phase === 'preview' && summary) {
    if (summary.headerError) {
      return (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex items-start gap-4">
            <XCircle className="w-8 h-8 text-red-500 shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-black text-red-700 mb-2">CSV Format Error</h3>
              <p className="text-sm font-bold text-red-600 mb-4">{summary.headerError}</p>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all"
              >
                Back to Input
              </button>
            </div>
          </div>
        </div>
      );
    }

    const willImport = buckets.valid.length + (allowDuplicates ? buckets.dupes.length : 0);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="To Import" value={willImport} tint="emerald" />
          <StatCard label="Duplicates" value={buckets.dupes.length} tint="amber" />
          <StatCard label="Errors" value={buckets.errors.length} tint="red" />
          <StatCard label="Warnings" value={summary.warningCount} tint="slate" />
        </div>

        {/* Duplicate toggle */}
        {buckets.dupes.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-black text-amber-800">
                  {buckets.dupes.length} row{buckets.dupes.length !== 1 ? 's' : ''} match{buckets.dupes.length === 1 ? 'es' : ''} an existing question by exact text
                </p>
                <p className="text-xs font-bold text-amber-700/80 mt-0.5">
                  By default these are skipped. Toggle below to include them anyway (e.g. you're intentionally re-importing).
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={allowDuplicates}
                onChange={(e) => setAllowDuplicates(e.target.checked)}
                className="w-4 h-4 accent-amber-600"
              />
              <span className="text-sm font-black text-amber-800">Import duplicates anyway</span>
            </label>
          </div>
        )}

        {/* Errors table */}
        {buckets.errors.length > 0 && (
          <Section title={`Rows with Errors (${buckets.errors.length})`} tint="red">
            <ResultTable rows={buckets.errors} kind="error" />
          </Section>
        )}

        {/* Duplicates table */}
        {buckets.dupes.length > 0 && (
          <Section title={`Duplicates (${buckets.dupes.length})`} tint="amber">
            <ResultTable rows={buckets.dupes} kind="dupe" />
          </Section>
        )}

        {/* Valid preview (collapsed by default) */}
        {buckets.valid.length > 0 && (
          <details className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden group">
            <summary className="cursor-pointer p-6 font-black text-emerald-700 flex items-center gap-3 list-none border-b border-emerald-50 bg-emerald-50/40">
              <CheckCircle className="w-5 h-5" />
              Valid Rows ({buckets.valid.length})
              <span className="text-xs font-bold text-emerald-600/70 ml-auto group-open:hidden">click to expand</span>
            </summary>
            <ResultTable rows={buckets.valid} kind="valid" />
          </details>
        )}

        {/* Actions */}
        {serverError && (
          <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 font-bold flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-xl">
          <button
            onClick={handleReset}
            className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={willImport === 0 || importing}
            className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Confirm Import — {willImport} question{willImport !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  }

  // === Render: Importing Phase ===
  if (phase === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Writing to Question Bank…</p>
      </div>
    );
  }

  // === Render: Done Phase ===
  if (phase === 'done') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[40px] p-10 text-white shadow-xl shadow-emerald-200 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-4xl font-black mb-2">Import Complete</h2>
          <p className="text-emerald-100 font-bold">
            {insertedCount} question{insertedCount !== 1 ? 's' : ''} added to the question bank.
          </p>
          <p className="text-emerald-100/80 text-sm mt-2">
            They're now available for blocks that match their category and year.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Import Another Batch
        </button>
      </div>
    );
  }

  return null;
}

// =====================================================================
// Subcomponents
// =====================================================================

function StatCard({ label, value, tint }: { label: string; value: number; tint: 'emerald' | 'amber' | 'red' | 'slate' }) {
  const tintMap = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'text-emerald-600/80' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'text-amber-600/80' },
    red: { bg: 'bg-red-50', text: 'text-red-700', label: 'text-red-600/80' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'text-slate-500' },
  };
  const t = tintMap[tint];
  return (
    <div className={`${t.bg} p-6 rounded-3xl text-center`}>
      <div className={`text-4xl font-black ${t.text}`}>{value}</div>
      <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${t.label}`}>{label}</div>
    </div>
  );
}

function Section({ title, tint, children }: { title: string; tint: 'red' | 'amber' | 'emerald'; children: React.ReactNode }) {
  const tintMap = {
    red: { border: 'border-red-100', text: 'text-red-700', bg: 'bg-red-50/40' },
    amber: { border: 'border-amber-100', text: 'text-amber-700', bg: 'bg-amber-50/40' },
    emerald: { border: 'border-emerald-100', text: 'text-emerald-700', bg: 'bg-emerald-50/40' },
  };
  const t = tintMap[tint];
  return (
    <div className={`bg-white rounded-3xl border ${t.border} shadow-sm overflow-hidden`}>
      <div className={`p-6 border-b ${t.border} ${t.bg}`}>
        <h3 className={`font-black ${t.text}`}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ResultTable({ rows, kind }: { rows: RowResult[]; kind: 'valid' | 'dupe' | 'error' }) {
  return (
    <div className="overflow-x-auto max-h-96">
      <table className="w-full text-left">
        <thead className="bg-slate-50 sticky top-0">
          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <th className="px-4 py-3">Line</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Question (preview)</th>
            {kind === 'error' && <th className="px-4 py-3">Errors</th>}
            {kind !== 'error' && <th className="px-4 py-3">Warnings</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.line} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-3 text-xs font-bold text-slate-500 tabular-nums">{r.line}</td>
              <td className="px-4 py-3 text-xs font-bold text-slate-700">{r.raw.category || '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-600 max-w-md truncate">
                {(r.raw.question_text || '').slice(0, 120)}{(r.raw.question_text || '').length > 120 ? '…' : ''}
              </td>
              {kind === 'error' ? (
                <td className="px-4 py-3 text-xs text-red-600">
                  {r.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </td>
              ) : (
                <td className="px-4 py-3 text-xs text-amber-600">
                  {r.warnings.length === 0 ? <span className="text-slate-300">—</span> : r.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
