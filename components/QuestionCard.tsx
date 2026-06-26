'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Highlighter, Strikethrough, Gem, ExternalLink, CheckCircle, XCircle, MessageSquare } from './AppIcons';

interface Question {
  id?: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  resource_link?: string;
  category?: string;
  year?: string;
}

interface QuestionCardProps {
  question: Question;
  userAnswer?: number;
  showExplanation?: boolean;
  readOnly?: boolean;
  fontSize?: number;
  initialHighlights?: string[];
  initialStrikethroughs?: number[];
  onToolsChange?: (tools: { highlights: string[]; strikethroughs: number[] }) => void;
  userEmail?: string;
  onSelectOption?: (index: number) => void;
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
  const sorted = [...highlights].sort((a, b) => {
    const textA = a.includes('|') ? a.substring(a.indexOf('|') + 1) : a;
    const textB = b.includes('|') ? b.substring(b.indexOf('|') + 1) : b;
    return textB.length - textA.length;
  });

  sorted.forEach(h => {
    let targetIndex = -1;
    let textToHighlight = h;
    
    // Check if it's the new format: `index|text`
    const match = h.match(/^(\d+)\|(.+)$/);
    if (match) {
        targetIndex = parseInt(match[1], 10);
        textToHighlight = match[2];
    }

    if (!textToHighlight || textToHighlight.length < 2) return;
    
    // Check if the highlight string starts or ends with a word character
    const startsWithWordChar = /^\w/.test(textToHighlight);
    const endsWithWordChar = /\w$/.test(textToHighlight);
    
    // Add word boundaries conditionally to avoid substring matches (e.g. 'in' matching inside 'incase')
    const prefix = startsWithWordChar ? '\\b' : '';
    const suffix = endsWithWordChar ? '\\b' : '';
    
    // Only match text outside of HTML tags
    const regex = new RegExp(`${prefix}(${escapeRegex(textToHighlight)})${suffix}(?![^<]*>)`, 'gi');
    
    if (targetIndex === -1) {
        // Legacy: highlight all occurrences
        result = result.replace(regex, `<mark class="highlight-marker cursor-pointer hover:bg-red-200 transition-colors" style="background-color:#fef08a;color:inherit;" title="Click to remove highlight" data-id="${h}">$1</mark>`);
    } else {
        // New: highlight specific occurrence
        let currentMatch = 0;
        result = result.replace(regex, (fullMatch, group1) => {
            if (currentMatch === targetIndex) {
                currentMatch++;
                return `<mark class="highlight-marker cursor-pointer hover:bg-red-200 transition-colors" style="background-color:#fef08a;color:inherit;" title="Click to remove highlight" data-id="${h}">${group1}</mark>`;
            }
            currentMatch++;
            return fullMatch;
        });
    }
  });
  return result;
}

export default function QuestionCard({
  question,
  userAnswer,
  onSelectOption,
  showExplanation = false,
  readOnly = false,
  fontSize = 18,
  initialHighlights = [],
  initialStrikethroughs = [],
  onToolsChange,
  userEmail,
}: QuestionCardProps) {
  const [highlights, setHighlights] = useState<string[]>(initialHighlights);
  const [strikethroughs, setStrikethroughs] = useState<Set<number>>(new Set(initialStrikethroughs));
  const [selectedOption, setSelectedOption] = useState<number | undefined>(userAnswer);
  const [highlightMode, setHighlightMode] = useState(false);
  const stemRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);

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

  // Scroll to explanation when it appears
  useEffect(() => {
    if (showExplanation && explanationRef.current) {
      // Small delay to ensure the DOM is fully rendered and layout is calculated
      setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showExplanation]);

  const handleSelection = useCallback(() => {
    if (!highlightMode) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!stemRef.current?.contains(range.startContainer) && !stemRef.current?.contains(range.endContainer)) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) return;

    // Calculate which occurrence this is in the text
    let highlightId = text;
    if (stemRef.current) {
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(stemRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const preSelectionText = preSelectionRange.toString();
      
      const startsWithWordChar = /^\w/.test(text);
      const endsWithWordChar = /\w$/.test(text);
      const prefix = startsWithWordChar ? '\\b' : '';
      const suffix = endsWithWordChar ? '\\b' : '';
      
      const regex = new RegExp(`${prefix}(${escapeRegex(text)})${suffix}`, 'gi');
      const matches = preSelectionText.match(regex);
      const matchIndex = matches ? matches.length : 0;
      
      highlightId = `${matchIndex}|${text}`;
    }

    // Save the highlighted text string so it survives re-renders
    setHighlights(prev => prev.includes(highlightId) ? prev : [...prev, highlightId]);
    selection.removeAllRanges();
  }, [highlightMode]);

  // Global mouseup/touchend to catch selections that end outside the stemRef bounds
  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [handleSelection]);

  const handleStemClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'mark' && target.classList.contains('highlight-marker')) {
      const highlightId = target.getAttribute('data-id');
      if (highlightId) {
        setHighlights(prev => prev.filter(h => h !== highlightId));
      } else {
        // Fallback for legacy highlights
        const textToRemove = target.textContent;
        if (textToRemove) {
          setHighlights(prev => prev.filter(h => h !== textToRemove));
        }
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

  const isCorrect = userAnswer === question.correct_index;
  const renderedStemHtmlRaw = applyHighlights(question.question_text, highlights);
  const renderedStemHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(renderedStemHtmlRaw) : renderedStemHtmlRaw;
  const optionFontSize = Math.max(14, fontSize - 2);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-2 md:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stem */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-3 md:p-5 border border-slate-100 relative group">
        <div className="flex flex-wrap justify-between items-start mb-3 gap-2">
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-black rounded-full uppercase tracking-widest shrink-0">
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
          onClick={handleStemClick}
          className={`font-bold leading-relaxed text-slate-800 ${highlightMode ? 'cursor-text selection:bg-yellow-200' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: renderedStemHtml }}
        />
      </div>

      {/* Options */}
      <div className="grid gap-2 md:gap-2.5">
        {question.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectOption = index === question.correct_index;
          const isStruck = strikethroughs.has(index);
          
          let stateStyles = "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/30 hover:-translate-y-1 hover:shadow-md hover:scale-[1.01]";
          
          if (showExplanation) {
            if (isCorrectOption) stateStyles = "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20";
            else if (isSelected && !isCorrectOption) stateStyles = "bg-red-50 border-red-500 text-red-900 opacity-80";
            else if (isStruck) stateStyles = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
            else stateStyles = "bg-white border-slate-100 text-slate-400 opacity-60";
          } else if (isSelected) {
            stateStyles = "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02] -translate-y-1";
          } else if (isStruck) {
            stateStyles = "bg-slate-50 border-slate-200 text-slate-400 opacity-50 grayscale";
          }

          return (
            <div key={index} className="relative group">
              <button
                disabled={showExplanation || readOnly}
                onClick={() => {
                  if (!isStruck && !showExplanation && !readOnly) {
                    setSelectedOption(index);
                    if (onSelectOption) onSelectOption(index);
                  }
                }}
                className={`w-full text-left py-2.5 md:py-3 pl-3 pr-10 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3 ${stateStyles}`}
                style={{ fontSize: `${optionFontSize}px` }}
              >
                <div className={`w-7 h-7 text-sm rounded-xl flex items-center justify-center font-black shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className={`font-bold leading-snug flex-1 min-w-0 break-words ${isStruck ? 'line-through decoration-2' : ''}`}>
                  {option}
                </span>
                
                {showExplanation && isCorrectOption && (
                  <CheckCircle className="ml-auto w-6 h-6 text-emerald-500 animate-in zoom-in" />
                )}
                {showExplanation && isSelected && !isCorrectOption && (
                  <XCircle className="ml-auto w-6 h-6 text-red-500 animate-in zoom-in" />
                )}
              </button>

              {!showExplanation && !readOnly && (
                <button
                  onClick={(e) => toggleStrikethrough(e, index)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 ${isStruck ? 'text-slate-800 bg-slate-200' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'}`}
                  title="Strike-through"
                >
                  <Strikethrough className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>



      {/* Explanation Area */}
      {showExplanation && (
        <div ref={explanationRef} className="bg-slate-900 text-slate-100 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <Gem className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg">Explanation</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Logic & Evidence</p>
              </div>
            </div>
            
            {(question.id || question.year) && (
              <div className="text-right flex flex-col justify-center">
                {question.id && (
                  <p className="text-slate-400 text-xs font-medium">ITE ID: <span className="text-slate-300 font-bold">{question.id}</span></p>
                )}
                {question.year && (
                  <p className="text-slate-400 text-xs font-medium">Year: <span className="text-slate-300 font-bold">{question.year}</span></p>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-4 text-slate-300 leading-relaxed font-medium">
            <div className={`inline-block px-4 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest mb-4 ${isCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </div>
            <div dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(question.explanation || 'No explanation provided.') : (question.explanation || 'No explanation provided.') }} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3 animate-fade-in">
            <a
              href="https://www.openevidence.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-blue-400 text-sm font-bold transition-all border border-blue-500/20"
            >
              <ExternalLink className="w-4 h-4" />
              Open Evidence
            </a>
            <a
              href={`https://gemini.google.com/gem/1Ep-wVXG0cSLhxna_SIbpMSANVs5xCm7X${userEmail ? `?authuser=${encodeURIComponent(userEmail)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-purple-300 text-sm font-bold transition-all border border-purple-500/20 group relative"
              title="Ensure you are logged into your Ascension SSO / work Google account"
            >
              <Gem className="w-4 h-4" />
              Board Prep Gem
            </a>
            <a
              href={`https://drive.google.com/drive/folders/1VSS2ZBtY486BUpZZKxrITrCOimd6b7Dp?usp=drive_link${userEmail ? `&authuser=${encodeURIComponent(userEmail)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-sm font-bold transition-all border border-white/10 group relative"
              title="Ensure you are logged into your Ascension SSO / work Google account"
            >
              <ExternalLink className="w-4 h-4" />
              Review Topic Material
            </a>
            <a
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=jonathan.carbungco@ascension.org&su=Question%20Feedback:%20FMC%20Board%20Review%20App%20-%20ID:%20${question.id || 'Unknown'}${userEmail ? `&authuser=${encodeURIComponent(userEmail)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-500/10 hover:bg-slate-500/20 rounded-xl text-slate-300 text-sm font-bold transition-all border border-slate-500/20"
              title="Report an issue or ask a question about this item"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback / Questions?
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
