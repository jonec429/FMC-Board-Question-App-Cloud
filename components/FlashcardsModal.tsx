'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/supabasePagination';
import { Question } from '@/lib/types';
import { formatIteId } from '@/lib/iteQuestionMap';
import { getCareDimensionMeta } from '@/lib/careDimensions';
import { getFlaggedQuestionIds, toggleFlaggedQuestion } from '@/lib/flaggedQuestions';
import {
  getFlashcardProgress,
  setQuestionBox,
  resetAllFlashcardProgress,
  getBoxCounts,
  LeitnerBox,
  FlashcardProgressMap,
} from '@/lib/flashcards';
import QuestionStemDisplay from './QuestionStemDisplay';
import {
  X,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Flag,
  RotateCcw,
  Gem,
  ExternalLink,
  MessageSquare,
  Sliders,
  CheckCircle,
  Copy,
  Loader2,
  Layers,
  Sparkles,
} from './AppIcons';

interface FlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userEmail?: string;
  initialQuestions?: Question[];
  initialCategory?: string;
  initialCareDimension?: string;
}

export default function FlashcardsModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  initialQuestions,
  initialCategory,
  initialCareDimension,
}: FlashcardsModalProps) {
  // Master Question Bank
  const [allQuestions, setAllQuestions] = useState<Question[]>(initialQuestions || []);
  const [loading, setLoading] = useState(false);

  // Deck State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedCareDimension, setSelectedCareDimension] = useState<string>(initialCareDimension || 'all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedBox, setSelectedBox] = useState<'all' | '1' | '2' | '3'>('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // User Progress States
  const [progress, setProgress] = useState<FlashcardProgressMap>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  // Load questions if not provided
  useEffect(() => {
    if (!isOpen) return;

    // Load progress and flags
    const prog = getFlashcardProgress(userId);
    setProgress(prog);

    if (userId) {
      getFlaggedQuestionIds(userId).then(ids => setFlaggedIds(new Set(ids)));
    }

    if (initialQuestions && initialQuestions.length > 0) {
      setAllQuestions(initialQuestions);
      return;
    }

    if (allQuestions.length === 0) {
      setLoading(true);
      fetchAllPages((from, to) =>
        supabase
          .from('questions')
          .select('id, year, category, secondary_system, abfm_category, question_text, correct_index, explanation, options, resource_link, is_repeat')
          .order('year', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      )
        .then((data) => {
          setLoading(false);
          if (data) {
            setAllQuestions(data as unknown as Question[]);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen, userId, initialQuestions, allQuestions.length]);

  // Extract filter options
  const categories = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach(q => {
      if (q.category && q.category !== 'Demo') set.add(q.category);
    });
    return Array.from(set).sort();
  }, [allQuestions]);

  const careDimensions = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach(q => {
      if (q.abfm_category) set.add(q.abfm_category);
    });
    return Array.from(set).sort();
  }, [allQuestions]);

  const years = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach(q => {
      if (q.year) set.add(q.year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allQuestions]);

  // Filter questions into the active study deck
  const activeDeck = useMemo(() => {
    let filtered = allQuestions.filter(q => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory && q.secondary_system !== selectedCategory) return false;
      if (selectedCareDimension !== 'all' && q.abfm_category !== selectedCareDimension) return false;
      if (selectedYear !== 'all' && q.year !== selectedYear) return false;

      const qBox = progress[q.id]?.box || 1;
      if (selectedBox !== 'all' && qBox.toString() !== selectedBox) return false;

      if (flaggedOnly && !flaggedIds.has(q.id)) return false;

      return true;
    });

    if (isShuffled) {
      filtered = [...filtered].sort(() => 0.5 - Math.random());
    }

    return filtered;
  }, [allQuestions, selectedCategory, selectedCareDimension, selectedYear, selectedBox, flaggedOnly, progress, flaggedIds, isShuffled]);

  // Current Card
  const currentQuestion: Question | undefined = activeDeck[currentIndex];

  // Box statistics for the active deck
  const boxCounts = useMemo(() => {
    const ids = activeDeck.map(q => q.id);
    return getBoxCounts(progress, ids);
  }, [progress, activeDeck]);

  // Handle index clamp on deck change
  useEffect(() => {
    if (currentIndex >= activeDeck.length) {
      setCurrentIndex(Math.max(0, activeDeck.length - 1));
    }
    setIsFlipped(false);
  }, [activeDeck.length, currentIndex]);

  // Card navigation
  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : activeDeck.length - 1));
  }, [activeDeck.length]);

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev < activeDeck.length - 1 ? prev + 1 : 0));
  }, [activeDeck.length]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // Leitner Box Assignment
  const handleSetBox = useCallback((box: LeitnerBox) => {
    if (!currentQuestion) return;
    const nextProgress = setQuestionBox(userId, currentQuestion.id, box);
    setProgress(nextProgress);
    handleNext();
  }, [currentQuestion, userId, handleNext]);

  // Flag toggle
  const handleToggleFlag = useCallback(async () => {
    if (!currentQuestion || !userId) return;
    const isNowFlagged = await toggleFlaggedQuestion(userId, currentQuestion.id);
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (isNowFlagged) next.add(currentQuestion.id);
      else next.delete(currentQuestion.id);
      return next;
    });
  }, [currentQuestion, userId]);

  // Copy ITE ID
  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset Progress
  const handleResetProgress = () => {
    if (window.confirm('Reset Leitner progress for all cards? All items will return to Box 1 (Learning).')) {
      resetAllFlashcardProgress(userId);
      setProgress({});
    }
  };

  // Global Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === '1') {
        e.preventDefault();
        handleSetBox(1);
      } else if (e.key === '2') {
        e.preventDefault();
        handleSetBox(2);
      } else if (e.key === '3') {
        e.preventDefault();
        handleSetBox(3);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFlag();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleFlip, handleNext, handlePrev, handleSetBox, handleToggleFlag, onClose]);

  if (!isOpen) return null;

  const currentBox: LeitnerBox = (currentQuestion ? progress[currentQuestion.id]?.box : 1) || 1;
  const isFlagged = currentQuestion ? flaggedIds.has(currentQuestion.id) : false;
  const careMeta = currentQuestion?.abfm_category ? getCareDimensionMeta(currentQuestion.abfm_category) : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[92vh] max-h-[880px] flex flex-col overflow-hidden transition-all text-slate-800 dark:text-slate-100"
      >
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                  Flashcard Micro-Learning
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Leitner System
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Active Deck: <strong className="text-slate-700 dark:text-slate-200">{activeDeck.length}</strong> items · 
                <span className="text-amber-600 dark:text-amber-400 font-bold ml-1">🌱 Box 1: {boxCounts.box1}</span> · 
                <span className="text-sky-600 dark:text-sky-400 font-bold ml-1">🔄 Box 2: {boxCounts.box2}</span> · 
                <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">⭐ Box 3: {boxCounts.box3}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsShuffled(!isShuffled)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isShuffled
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isShuffled ? 'Shuffle: ON (Click to disable)' : 'Shuffle Deck'}
            >
              <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                showFilters || selectedCategory !== 'all' || selectedCareDimension !== 'all' || selectedBox !== 'all' || flaggedOnly
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Filters & Deck Settings"
            >
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Filter Bar */}
        {showFilters && (
          <div className="p-4 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Category */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Organ System
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Systems ({allQuestions.length})</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({allQuestions.filter(q => q.category === cat).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Care Dimension */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  ABFM Care Dimension
                </label>
                <select
                  value={selectedCareDimension}
                  onChange={e => setSelectedCareDimension(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Care Dimensions</option>
                  {careDimensions.map(dim => (
                    <option key={dim} value={dim}>
                      {dim}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Exam Year
                </label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Years</option>
                  {years.map(y => (
                    <option key={y} value={y}>
                      {y} ITE
                    </option>
                  ))}
                </select>
              </div>

              {/* Leitner Box */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Leitner Mastery Box
                </label>
                <select
                  value={selectedBox}
                  onChange={e => setSelectedBox(e.target.value as 'all' | '1' | '2' | '3')}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Boxes</option>
                  <option value="1">🌱 Box 1 (Learning / Need Review)</option>
                  <option value="2">🔄 Box 2 (Review / Familiar)</option>
                  <option value="3">⭐ Box 3 (Mastered)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={flaggedOnly}
                  onChange={e => setFlaggedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5 text-amber-500" />
                  Flagged Questions Only ({flaggedIds.size})
                </span>
              </label>

              <button
                onClick={handleResetProgress}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Leitner Box Progress
              </button>
            </div>
          </div>
        )}

        {/* Deck Progress Bar */}
        {activeDeck.length > 0 && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 shrink-0 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / activeDeck.length) * 100}%` }}
            />
          </div>
        )}

        {/* Card Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-between">
          {loading ? (
            <div className="flex flex-col items-center justify-center my-auto py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="font-bold text-xs uppercase tracking-wider">Loading Question Bank...</p>
            </div>
          ) : activeDeck.length === 0 ? (
            <div className="my-auto text-center py-16 max-w-sm mx-auto space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">No Cards Match Filters</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Adjust your filters or reset to view questions in your deck.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedCareDimension('all');
                  setSelectedYear('all');
                  setSelectedBox('all');
                  setFlaggedOnly(false);
                }}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Reset All Filters
              </button>
            </div>
          ) : currentQuestion ? (
            <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto justify-between space-y-6">
              
              {/* Card Meta Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Leitner Box Status */}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                    currentBox === 3
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : currentBox === 2
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}>
                    {currentBox === 3 ? '⭐ Box 3: Mastered' : currentBox === 2 ? '🔄 Box 2: Review' : '🌱 Box 1: Learning'}
                  </span>

                  {/* Year */}
                  {currentQuestion.year && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {currentQuestion.year} ITE
                    </span>
                  )}

                  {/* Organ System Badges */}
                  {currentQuestion.category && (
                    <span
                      className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      title="Primary Organ System"
                    >
                      {currentQuestion.category}
                    </span>
                  )}
                  {currentQuestion.secondary_system && (
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      title={`Secondary Organ System: ${currentQuestion.secondary_system}`}
                    >
                      + {currentQuestion.secondary_system}
                    </span>
                  )}

                  {/* ABFM Care Dimension Badge */}
                  {careMeta && (
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${careMeta.badgeBg} ${careMeta.badgeText} ${careMeta.badgeBorder}`}
                      title={`ABFM Care Dimension: ${careMeta.label} (${careMeta.blueprintWeight} of Blueprint)`}
                    >
                      {careMeta.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Canonical ITE ID */}
                  <button
                    onClick={() => handleCopyId(formatIteId(currentQuestion))}
                    className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Click to copy ITE ID"
                  >
                    <span>{formatIteId(currentQuestion)}</span>
                    {copiedId === formatIteId(currentQuestion) ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {/* Flag Toggle */}
                  <button
                    onClick={handleToggleFlag}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isFlagged
                        ? 'text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900'
                        : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={isFlagged ? 'Unflag question' : 'Flag question for later review'}
                  >
                    <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Card Face: Front or Back */}
              <div
                onClick={handleFlip}
                className="cursor-pointer group relative bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm transition-all duration-300 flex-1 flex flex-col justify-between select-text"
              >
                {!isFlipped ? (
                  // FRONT OF CARD: Stem & Unrevealed Choices
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">
                        Clinical Vignette &amp; Prompt
                      </span>
                      <QuestionStemDisplay
                        text={currentQuestion.question_text}
                        className="text-base sm:text-lg font-bold leading-relaxed text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                        Options
                      </span>
                      {currentQuestion.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-500 shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span>Click anywhere or press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-xs font-mono text-[10px]">Space</kbd> to flip &amp; reveal rationale</span>
                    </div>
                  </div>
                ) : (
                  // BACK OF CARD: Correct Answer & Rationale
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Correct Answer Highlight */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Correct Answer ({String.fromCharCode(65 + (currentQuestion.correct_index ?? 0))})
                        </span>
                      </div>
                      <p className="text-base sm:text-lg font-black leading-snug">
                        {currentQuestion.options[currentQuestion.correct_index ?? 0]}
                      </p>
                    </div>

                    {/* Full Explanation */}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">
                        Logic &amp; Clinical Evidence
                      </span>
                      <div
                        className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-200 font-medium whitespace-pre-line space-y-2"
                        dangerouslySetInnerHTML={{
                          __html: typeof window !== 'undefined'
                            ? DOMPurify.sanitize(currentQuestion.explanation || 'No rationale available.')
                            : (currentQuestion.explanation || 'No rationale available.')
                        }}
                      />
                    </div>

                    {/* Clinical External Resources */}
                    <div className="pt-2 flex flex-wrap gap-2 text-xs" onClick={e => e.stopPropagation()}>
                      <a
                        href={`https://gemini.google.com/gem/1Ep-wVXG0cSLhxna_SIbpMSANVs5xCm7X${userEmail ? `?authuser=${encodeURIComponent(userEmail)}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 transition-colors"
                      >
                        <Gem className="w-3.5 h-3.5" />
                        Board Prep Gem
                      </a>
                      <a
                        href="https://www.openevidence.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Evidence
                      </a>
                      <a
                        href={`https://drive.google.com/drive/folders/1VSS2ZBtY486BUpZZKxrITrCOimd6b7Dp?usp=drive_link${userEmail ? `&authuser=${encodeURIComponent(userEmail)}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Topic Material
                      </a>
                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=jonathan.carbungco@ascension.org&su=Question%20Feedback:%20FMC%20Flashcard%20-${encodeURIComponent(formatIteId(currentQuestion))}%20(App%20Question%20ID:%20${currentQuestion.id})}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Feedback
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Control & Leitner Action Bar */}
              <div className="space-y-3 pt-2 shrink-0">
                {/* Leitner Action Buttons (when flipped) */}
                {isFlipped ? (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button
                      onClick={() => handleSetBox(1)}
                      className="py-3 px-2 sm:px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-black text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                    >
                      <div className="flex items-center gap-1">
                        <span>🌱 Review Again</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-amber-200/50 dark:bg-amber-900/50 rounded text-[9px] font-mono">1</kbd>
                      </div>
                      <span className="text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80">Box 1</span>
                    </button>

                    <button
                      onClick={() => handleSetBox(2)}
                      className="py-3 px-2 sm:px-4 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-black text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                    >
                      <div className="flex items-center gap-1">
                        <span>🔄 Familiar</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-sky-200/50 dark:bg-sky-900/50 rounded text-[9px] font-mono">2</kbd>
                      </div>
                      <span className="text-[10px] font-medium text-sky-700/80 dark:text-sky-300/80">Box 2</span>
                    </button>

                    <button
                      onClick={() => handleSetBox(3)}
                      className="py-3 px-2 sm:px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-black text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                    >
                      <div className="flex items-center gap-1">
                        <span>⭐ Mastered</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-emerald-200/50 dark:bg-emerald-900/50 rounded text-[9px] font-mono">3</kbd>
                      </div>
                      <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80">Box 3</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleFlip}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                  >
                    <span>Flip Card to Reveal Answer</span>
                    <kbd className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-mono">Space</kbd>
                  </button>
                )}

                {/* Navigation Row */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
                  <button
                    onClick={handlePrev}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <span className="text-slate-400 font-mono text-[11px]">
                    Card {currentIndex + 1} of {activeDeck.length}
                  </span>

                  <button
                    onClick={handleNext}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
