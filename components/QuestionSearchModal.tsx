import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Question } from '@/lib/types';
import { formatIteId } from '@/lib/iteQuestionMap';
import { KNOWN_REPEAT_IDS } from './QuestionCard';
import { getFlaggedQuestionIds, toggleFlaggedQuestion } from '@/lib/flaggedQuestions';
import { Search, X, Flag, CheckCircle, ExternalLink, Loader2 } from './AppIcons';

interface QuestionSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userEmail?: string;
}

const STOP_WORDS = new Set([
  'the', 'of', 'and', 'a', 'an', 'in', 'to', 'for', 'with', 'on', 'at', 'from',
  'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
  'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
  'their', 'which', 'who', 'whom', 'how', 'what', 'when', 'where', 'why', 'can',
  'could', 'would', 'should', 'will', 'patient', 'presents', 'which', 'following'
]);

export default function QuestionSearchModal({
  isOpen,
  onClose,
  userId,
  userEmail,
}: QuestionSearchModalProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [repeatsOnly, setRepeatsOnly] = useState(false);
  const [mode, setMode] = useState<'study' | 'test'>('study'); // study = expanded; test = collapsed answers
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  // Load questions and user flagged IDs when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (userId) {
      getFlaggedQuestionIds(userId).then(ids => setFlaggedIds(new Set(ids)));
    }

    if (questions.length === 0) {
      setLoading(true);
      supabase
        .from('questions')
        .select('id, year, category, question_text, correct_index, explanation, options, resource_link, is_repeat')
        .order('year', { ascending: false })
        .then(({ data, error }) => {
          setLoading(false);
          if (!error && data) {
            setQuestions(data as unknown as Question[]);
          }
        });
    }
  }, [isOpen, userId, questions.length]);

  // Handle flag toggle
  const handleToggleFlag = async (qId: string) => {
    if (!userId || !qId) return;
    const isNowFlagged = await toggleFlaggedQuestion(userId, qId);
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (isNowFlagged) next.add(qId);
      else next.delete(qId);
      return next;
    });
  };

  // Toggle reveal for self-test mode
  const toggleReveal = (qId: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // Extract unique categories and years for filter dropdowns
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (q.category && q.category !== 'Demo') set.add(q.category);
    });
    return Array.from(set).sort();
  }, [questions]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (q.year && q.year !== 'Demo') set.add(q.year);
    });
    return Array.from(set).sort().reverse();
  }, [questions]);

  // Tokenize query with stop-word filter
  const { filteredTokens, isOnlyStopWords } = useMemo(() => {
    const rawTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const nonStop = rawTokens.filter(t => !STOP_WORDS.has(t) && (t.length >= 3 || t.startsWith('ite')));
    const onlyStop = rawTokens.length > 0 && nonStop.length === 0;
    return { filteredTokens: nonStop, isOnlyStopWords: onlyStop };
  }, [query]);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!query.trim() && selectedCategory === 'all' && selectedYear === 'all' && !repeatsOnly) {
      return [];
    }

    return questions.filter(q => {
      // 1. Exclude demo questions
      if (q.year === 'Demo' || q.category === 'Demo') return false;

      // 2. Category Filter
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;

      // 3. Year Filter
      if (selectedYear !== 'all' && q.year !== selectedYear) return false;

      // 4. Repeat Filter
      if (repeatsOnly && !q.is_repeat && (!q.id || !KNOWN_REPEAT_IDS.has(q.id))) return false;

      // 5. Query Filter
      if (filteredTokens.length === 0) {
        // If no search query typed, allow browsing by category/year/repeats
        return true;
      }

      const canonicalId = (formatIteId(q) || '').toLowerCase();
      const stem = (q.question_text || '').toLowerCase();
      const expl = (q.explanation || '').toLowerCase();
      const category = (q.category || '').toLowerCase();
      const optionsStr = Array.isArray(q.options) ? q.options.join(' ').toLowerCase() : '';

      // All meaningful tokens must match somewhere in the question
      return filteredTokens.every(token =>
        stem.includes(token) ||
        canonicalId.includes(token) ||
        expl.includes(token) ||
        category.includes(token) ||
        optionsStr.includes(token)
      );
    });
  }, [questions, query, filteredTokens, selectedCategory, selectedYear, repeatsOnly]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col transition-colors">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white truncate">
                Question Bank Knowledge Base
              </h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                Search 600+ ABFM ITE clinical vignettes, evidence, and pearls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Controls Toolbar */}
        <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 space-y-3">
          
          {/* Main Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by topic, disease, medication, pearl, or ITE ID (e.g. 'preeclampsia', 'ITE2025Q15')..."
              className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stop word alert */}
          {isOnlyStopWords && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 animate-fade-in">
              💡 Please enter a specific clinical term or drug name (common words like &quot;the&quot;, &quot;of&quot;, &quot;patient&quot; are filtered out).
            </p>
          )}

          {/* Filters & Mode Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 shadow-sm outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Systems Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Year Filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 shadow-sm outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Exam Years</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>ITE {yr}</option>
                ))}
              </select>

              {/* Repeats Only Toggle */}
              <button
                type="button"
                onClick={() => setRepeatsOnly(!repeatsOnly)}
                className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                  repeatsOnly
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <span>🔁 High Yield Repeats</span>
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-xl self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('study')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                  mode === 'study'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Quick Reference
              </button>
              <button
                type="button"
                onClick={() => setMode('test')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                  mode === 'test'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Self-Test Mode
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <p className="font-bold text-sm tracking-wider uppercase">Loading Question Bank...</p>
            </div>
          ) : !query.trim() && selectedCategory === 'all' && selectedYear === 'all' && !repeatsOnly ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-3">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                Search the ABFM Question Bank
              </h3>
              <p className="text-xs max-w-md mx-auto leading-relaxed">
                Type clinical symptoms, disease names, guidelines, or medications above, or select a category to browse questions.
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                No questions found matching your criteria.
              </p>
              <p className="text-xs">
                Try searching with a different term, drug name, or clearing active filters.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold px-1">
                <span>Found {searchResults.length} {searchResults.length === 1 ? 'question' : 'questions'}</span>
                {mode === 'test' && (
                  <span className="text-blue-500">Self-Test: Answers hidden until revealed</span>
                )}
              </div>

              {searchResults.map((q, idx) => {
                const canonicalId = formatIteId(q);
                const isFlagged = Boolean(q.id && flaggedIds.has(q.id));
                const isRevealed = mode === 'study' || (q.id && revealedIds.has(q.id));
                const parsedOptions: string[] = Array.isArray(q.options)
                  ? q.options
                  : typeof q.options === 'string'
                  ? JSON.parse(q.options || '[]')
                  : [];

                return (
                  <div
                    key={q.id || idx}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3.5"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {canonicalId && (
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {canonicalId}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-full uppercase tracking-wider">
                          {q.category || 'General Medicine'}
                        </span>
                        {q.year && (
                          <span className="text-[10px] font-bold text-slate-400">
                            ITE {q.year}
                          </span>
                        )}
                        {(Boolean(q.is_repeat) || (q.id && KNOWN_REPEAT_IDS.has(q.id))) && (
                          <span
                            className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1"
                            title="Appears across multiple ITE cycles"
                          >
                            <span>🔁 Repeat</span>
                          </span>
                        )}
                      </div>

                      {/* Flag Button */}
                      {q.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleFlag(q.id!)}
                          className={`p-1.5 rounded-xl transition-all ${
                            isFlagged
                              ? 'text-red-600 bg-red-100 dark:bg-red-950/70 dark:text-red-400 ring-1 ring-red-400/50'
                              : 'text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800'
                          }`}
                          title={isFlagged ? "Flagged for review (Click to unflag)" : "Flag question for review"}
                        >
                          <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Question Stem */}
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                      {q.question_text}
                    </p>

                    {/* Answer Options */}
                    <div className="space-y-1.5 pt-1">
                      {parsedOptions.map((opt, optIdx) => {
                        const isCorrect = optIdx === q.correct_index;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2.5 transition-colors ${
                              isRevealed && isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-bold shrink-0">{String.fromCharCode(65 + optIdx)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isRevealed && isCorrect && (
                              <span className="shrink-0 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Self Test Reveal Button */}
                    {!isRevealed && q.id && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(q.id!)}
                        className="w-full py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-black transition-all border border-blue-200 dark:border-blue-900/50"
                      >
                        Reveal Answer & Explanation
                      </button>
                    )}

                    {/* Explanation & Rationale */}
                    {isRevealed && q.explanation && (
                      <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 animate-fade-in">
                        <div className="font-black text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Explanation & Evidence
                        </div>
                        <p className="whitespace-pre-wrap">{q.explanation}</p>
                        {q.resource_link && (
                          <div className="pt-2 flex items-center gap-3 text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                            <span className="truncate">Reference: {q.resource_link}</span>
                            <a
                              href={`https://www.aafp.org/search.html#q=${encodeURIComponent(q.category || '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 hover:underline inline-flex items-center gap-1"
                            >
                              Search AAFP <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
