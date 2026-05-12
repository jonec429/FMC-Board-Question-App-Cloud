'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Sliders, Shuffle, XCircle, CheckCircle, Database, Loader2 } from './AppIcons';

interface CustomBuilderScreenProps {
  onStart: (config: { years: string[]; categories: string[]; count: number }) => void;
  onCancel: () => void;
}

export default function CustomBuilderScreen({ onStart, onCancel }: CustomBuilderScreenProps) {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [mode, setMode] = useState<'random' | 'custom'>('custom');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [qCount, setQCount] = useState(40);
  const [qCountInput, setQCountInput] = useState('40');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    async function fetchFilters() {
      setLoading(true);
      try {
        const { data: qData } = await supabase.from('questions').select('category, year');
        if (qData) {
          const yearSet = Array.from(new Set(qData.map((q: any) => q.year))).filter(Boolean).sort().reverse() as string[];
          const catSet = Array.from(new Set(qData.map((q: any) => q.category))).filter(Boolean).sort() as string[];
          setYears(yearSet);
          setCategories(catSet);
          setTotalQuestions(qData.length);
        }
      } catch (err) {
        console.error('Filter fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFilters();
  }, []);

  const toggleYear = (y: string) => setSelectedYears(p => p.includes(y) ? p.filter(i => i !== y) : [...p, y]);
  const toggleCategory = (c: string) => setSelectedCategories(p => p.includes(c) ? p.filter(i => i !== c) : [...p, c]);

  const handleSelectAllYears = () => {
    if (selectedYears.length === years.length) setSelectedYears([]);
    else setSelectedYears([...years]);
  };

  const handleSelectAllCats = () => {
    if (selectedCategories.length === categories.length) setSelectedCategories([]);
    else setSelectedCategories([...categories]);
  };

  const handleQCountChange = (val: string) => {
    setQCountInput(val);
    const n = parseInt(val);
    if (!isNaN(n)) setQCount(Math.min(100, Math.max(5, n)));
  };

  const handleQCountBlur = () => {
    const n = parseInt(qCountInput);
    const clamped = isNaN(n) ? 40 : Math.min(100, Math.max(5, n));
    setQCount(clamped);
    setQCountInput(String(clamped));
  };

  const handleGenerate = () => {
    if (mode === 'custom') {
      if (selectedYears.length === 0 || selectedCategories.length === 0) {
        setShowErrors(true);
        return;
      }
    }
    setShowErrors(false);
    onStart({
      years: mode === 'random' ? [] : selectedYears,
      categories: mode === 'random' ? [] : selectedCategories,
      count: qCount,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-stretch sm:items-center justify-center sm:p-6 font-sans text-slate-800">
      <div className="bg-white w-full max-h-[100dvh] shadow-2xl border border-slate-200 flex flex-col rounded-none sm:rounded-3xl sm:max-w-3xl min-h-[600px]">
        <div className="p-6 sm:p-8 flex flex-col flex-1 min-h-0 animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-600" /> Create Custom Block
            </h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600" title="Close">
              <XCircle className="w-8 h-8" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
          ) : totalQuestions === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p>Master Question Bank is empty.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-4">
              {/* Mode Toggle */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">1. Quiz Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('random')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-2 ${mode === 'random' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
                  >
                    <Shuffle className="w-6 h-6" />
                    Quick Mixed Review
                    <span className={`text-[10px] font-normal ${mode === 'random' ? 'text-blue-100' : 'text-slate-400'}`}>Pull from all topics &amp; years</span>
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 font-bold text-sm transition-all gap-2 ${mode === 'custom' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                  >
                    <Sliders className="w-6 h-6" />
                    Custom Filters
                    <span className={`text-[10px] font-normal ${mode === 'custom' ? 'text-indigo-100' : 'text-slate-400'}`}>Pick specific topics &amp; years</span>
                  </button>
                </div>
              </div>

              {/* Year Selection */}
              {mode === 'custom' && (
                <div className={`bg-white p-5 rounded-2xl shadow-sm border ${showErrors && selectedYears.length === 0 ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      2. Select ITE Year(s) <span className="text-red-500">*</span>
                    </label>
                    <button onClick={handleSelectAllYears} className="text-xs font-bold text-indigo-600 hover:underline">
                      {selectedYears.length === years.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {years.map(y => (
                      <label key={y} className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedYears.includes(y)}
                          onChange={() => toggleYear(y)}
                        />
                        <div className={`px-4 py-2 border-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${selectedYears.includes(y) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 group-hover:border-indigo-300'}`}>
                          {selectedYears.includes(y) && <CheckCircle className="w-4 h-4 text-white" />}
                          <span>{y}</span>
                        </div>
                      </label>
                    ))}
                    {years.length === 0 && <span className="text-sm text-slate-400 italic">No years found.</span>}
                  </div>
                  {showErrors && selectedYears.length === 0 && (
                    <p className="text-xs text-red-500 font-bold mt-2">Please select at least one ITE year.</p>
                  )}
                </div>
              )}

              {/* Category Selection */}
              {mode === 'custom' && (
                <div className={`bg-white p-5 rounded-2xl shadow-sm border ${showErrors && selectedCategories.length === 0 ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      3. Select Topics <span className="text-red-500">*</span>
                    </label>
                    <button onClick={handleSelectAllCats} className="text-xs font-bold text-indigo-600 hover:underline">
                      {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {categories.map(c => (
                      <label key={c} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(c)}
                          onChange={() => toggleCategory(c)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700 truncate">{c}</span>
                      </label>
                    ))}
                    {categories.length === 0 && <span className="text-sm text-slate-400 italic">No categories found.</span>}
                  </div>
                  {showErrors && selectedCategories.length === 0 && (
                    <p className="text-xs text-red-500 font-bold mt-2">Please select at least one topic.</p>
                  )}
                </div>
              )}

              {/* Count */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  {mode === 'custom' ? '4' : '2'}. Number of Questions{' '}
                  <span className="text-slate-400 font-normal normal-case">(5-100)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={qCountInput}
                    onChange={e => handleQCountChange(e.target.value)}
                    onBlur={handleQCountBlur}
                    className="w-28 p-3 text-2xl font-black text-indigo-600 text-center border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-sm text-slate-500">
                    questions will be selected randomly from your chosen filters.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleGenerate}
              disabled={loading || totalQuestions === 0}
              className={`w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all text-lg disabled:opacity-50 flex items-center justify-center gap-2 ${mode === 'random' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {mode === 'random' ? (
                <>
                  <Shuffle className="w-5 h-5" />
                  Generate Mixed Review
                </>
              ) : (
                <>
                  <Sliders className="w-5 h-5" />
                  Generate Custom Block
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
