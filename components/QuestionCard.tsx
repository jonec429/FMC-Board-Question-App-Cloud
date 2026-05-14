'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Highlighter, Strikethrough, Gem, ExternalLink, CheckCircle, XCircle } from './AppIcons';

interface Question {
  id?: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  resource_link?: string;
  category?: string;
}

interface QuestionCardProps {
  question: Question;
  userAnswer?: number;
  onAnswer: (index: number) => void;
  showExplanation?: boolean;
  fontSize?: number;
  initialHighlights?: string[];
  initialStrikethroughs?: number[];
  onToolsChange?: (tools: { highlights: string[]; strikethroughs: number[] }) => void;
}

// Escape special regex characters in user-selected text so we can safely build a RegExp
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Apply highlight markup to question_text by wrapping matching strings in <mark>
function applyHighlights(html: string, highlights: string[]): string {
  if (!highlights || highlights.length === 0) return html;
  let result = html;
  // Sort longest-first so longer phrases match before substrings of them
  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  sorted.forEach(h => {
    if (!h || h.length < 2) return;
    const regex = new RegExp(`(${escapeRegex(h)})(?![^<]*>)`, 'g');
    result = result.replace(regex, '<mark class="highlight-marker cursor-pointer hover:bg-red-200 transition-colors" style="background-color:#fef08a;color:inherit;" title="Click to remove highlight">$1</mark>');
  });
  return result;
}

export default function QuestionCard({
  question,
  userAnswer,
  onAnswer,
  showExplanation = false,
  fontSize = 18,
  initialHighlights = [],
  initialStrikethroughs = [],
  onToolsChange,
}: QuestionCardProps) {
  const [highlights, setHighlights] = useState<string[]>(initialHighlights);
  const [strikethroughs, setStrikethroughs] = useState<Set<number>>(new Set(initialStrikethroughs));
  const [selectedOption, setSelectedOption] = useState<number | undefined>(userAnswer);
  const [highlightMode, setHighlightMode] = useState(false);
  const stemRef = useRef<HTMLDivElement>(null);

  // Sync local state with parent-provided tools when navigating between questions
  useEffect(() => {
    setHighlights(initialHighlights || []);
    setStrikethroughs(new Set(initialStrikethroughs || []));
    setSelectedOption(userAnswer);
  }, [question.id, question.question_text, userAnswer]);

  // Notify parent whenever tools change so state can persist across navigation
  useEffect(() => {
    if (onToolsChange) {
      onToolsChange({
        highlights,
        strikethroughs: Array.from(strikethroughs),
      });
    }
  }, [highlights, strikethroughs]);

  const handleMouseUp = () => {
    if (!highlightMode) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!stemRef.current?.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (text.length < 2) return;

    // Save the highlighted text string so it survives re-renders
    setHighlights(prev => prev.includes(text) ? prev : [...prev, text]);
    selection.removeAllRanges();
  };

  const handleStemClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'mark' && target.classList.contains('highlight-marker')) {
      const textToRemove = target.textContent;
      if (textToRemove) {
        setHighlights(prev => prev.filter(h => h !== textToRemove));
      }
    }
  };

  const clearHighlights = () => setHighlights([]);

  const toggleStrikethrough = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newSet = new Set(strikethroughs);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setStrikethroughs(newSet);
  };

  const handleSubmit = () => {
    if (selectedOption !== undefined) {
      onAnswer(selectedOption);
    }
  };

  const isCorrect = userAnswer === question.correct_index;
  const renderedStemHtml = applyHighlights(question.question_text, highlights);
  const optionFontSize = Math.max(14, fontSize - 2);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Question Stem */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 relative group">
        <div className="flex justify-between items-start mb-4">
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-black rounded-full uppercase tracking-widest">
            {question.category || 'General Medicine'}
          </span>
          <div className="flex items-center gap-1">
            {highlights.length > 0 && !showExplanation && (
              <button
                onClick={clearHighlights}
                className="px-2 py-1 text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider rounded transition-all"
                title="Clear all highlights"
              >
                Clear ({highlights.length})
              </button>
            )}
            <button
              onClick={() => setHighlightMode(!highlightMode)}
              className={`p-2 rounded-xl transition-all ${highlightMode ? 'text-yellow-600 bg-yellow-100 shadow-inner' : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
              title="Toggle Highlight Mode"
            >
              <Highlighter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          ref={stemRef}
          onMouseUp={handleMouseUp}
          onClick={handleStemClick}
          className={`font-bold leading-relaxed text-slate-800 ${highlightMode ? 'cursor-text selection:bg-yellow-200' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: renderedStemHtml }}
        />
      </div>

      {/* Options */}
      <div className="grid gap-3">
        {question.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectOption = index === question.correct_index;
          const isStruck = strikethroughs.has(index);
          
          let stateStyles = "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/30";
          
          if (showExplanation) {
            if (isCorrectOption) stateStyles = "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20";
            else if (isSelected && !isCorrectOption) stateStyles = "bg-red-50 border-red-500 text-red-900 opacity-80";
            else if (isStruck) stateStyles = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
            else stateStyles = "bg-white border-slate-100 text-slate-400 opacity-60";
          } else if (isSelected) {
            stateStyles = "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02]";
          } else if (isStruck) {
            stateStyles = "bg-slate-50 border-slate-200 text-slate-400 opacity-50 grayscale";
          }

          return (
            <div key={index} className="relative group">
              <button
                disabled={showExplanation}
                onClick={() => !isStruck && !showExplanation && setSelectedOption(index)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${stateStyles}`}
                style={{ fontSize: `${optionFontSize}px` }}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className={`font-bold leading-snug ${isStruck ? 'line-through decoration-2' : ''}`}>
                  {option}
                </span>
                
                {showExplanation && isCorrectOption && (
                  <CheckCircle className="ml-auto w-6 h-6 text-emerald-500 animate-in zoom-in" />
                )}
                {showExplanation && isSelected && !isCorrectOption && (
                  <XCircle className="ml-auto w-6 h-6 text-red-500 animate-in zoom-in" />
                )}
              </button>

              {!showExplanation && (
                <button
                  onClick={(e) => toggleStrikethrough(e, index)}
                  className={`absolute -right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${isStruck ? 'text-slate-800 bg-slate-200' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'}`}
                  title="Strike-through"
                >
                  <Strikethrough className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!showExplanation && (
        <div className="pt-2 animate-fade-in">
          <button
            onClick={handleSubmit}
            disabled={selectedOption === undefined}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-200"
          >
            Submit Answer
          </button>
        </div>
      )}

      {/* Explanation Area */}
      {showExplanation && (
        <div className="bg-slate-900 text-slate-100 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Gem className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg">Board Prep Gem</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Logic & Evidence</p>
            </div>
          </div>
          
          <div className="space-y-4 text-slate-300 leading-relaxed font-medium">
            <p className="text-lg text-white">
              {isCorrect ? 'Correct!' : 'Actually...'}
            </p>
            <div dangerouslySetInnerHTML={{ __html: question.explanation || 'No explanation provided.' }} />
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="https://www.openevidence.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 rounded-2xl text-blue-400 font-bold transition-all border border-blue-500/20"
            >
              <ExternalLink className="w-4 h-4" />
              Open Evidence
            </a>
            <a
              href="https://gemini.google.com/gem/1Ep-wVXG0cSLhxna_SIbpMSANVs5xCm7X?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/10 hover:bg-purple-500/20 rounded-2xl text-purple-300 font-bold transition-all border border-purple-500/20"
            >
              <Gem className="w-4 h-4" />
              Board Prep Gem
            </a>
            <a
              href={question.resource_link || `https://drive.google.com/drive/folders/1VSS2ZBtY486BUpZZKxrITrCOimd6b7Dp?q=${encodeURIComponent(question.category || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 font-bold transition-all border border-white/10"
            >
              <ExternalLink className="w-4 h-4" />
              Review Topic Material
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
