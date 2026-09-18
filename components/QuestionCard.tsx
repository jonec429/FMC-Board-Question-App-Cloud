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
  is_repeat?: boolean | null;
}

// Known repeat questions that appear across multiple ITEs
export const KNOWN_REPEAT_IDS = new Set<string>([
  'b9d5b51f-8c32-472d-8f02-7ac394f086e1', // 2025 Item: Ankle injury / Ottawa ankle rules
  'dda216f2-f1f8-4495-b597-bddab68e6b34', // 2025 Item: Ankle injury / Ottawa ankle rules (Repeat)
  '41a27c0b-06ad-4593-8c67-4a68f24399cf', // 2025 Item: Heart failure / fatigue workup
  'c60df00e-8b1d-4e35-8ed0-29c1b59348ef', // 2025 Item: Heart failure / fatigue workup (Repeat)
]);

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build a regex that matches sequences of words separated by any whitespace (spaces, \n, \r, tabs)
function buildHighlightRegex(text: string): RegExp {
  const tokens = text.trim().split(/\s+/).map(t => escapeRegex(t));
  return new RegExp(tokens.join('\\s+'), 'gi');
}

// Apply highlight markup to question_text by calculating character spans and generating valid HTML
function applyHighlights(rawText: string, highlights: string[]): string {
  if (!rawText) return '';

  const divIndex = rawText.indexOf('<div');
  const textContent = divIndex !== -1 ? rawText.substring(0, divIndex) : rawText;
  const trailingHtml = divIndex !== -1 ? rawText.substring(divIndex) : '';

  if (!highlights || highlights.length === 0) {
    return escapeHtml(textContent) + trailingHtml;
  }

  interface HighlightSpan {
    start: number;
    end: number;
    id: string;
  }

  const spans: HighlightSpan[] = [];

  highlights.forEach(h => {
    let targetIndex = 0;
    let textToHighlight = h;

    // Support index|text format while safely allowing newlines in text
    const match = h.match(/^(\d+)\|([\s\S]+)$/);
    if (match) {
      targetIndex = parseInt(match[1], 10);
      textToHighlight = match[2];
    }

    if (!textToHighlight || textToHighlight.trim().length < 2) return;

    const regex = buildHighlightRegex(textToHighlight);
    let m: RegExpExecArray | null;
    let currentMatch = 0;
    let found = false;

    while ((m = regex.exec(textContent)) !== null) {
      if (currentMatch === targetIndex) {
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          id: h
        });
        found = true;
        break;
      }
      currentMatch++;
    }

    // Fallback if targetIndex wasn't reached (e.g. whitespace count variation)
    if (!found && targetIndex > 0) {
      regex.lastIndex = 0;
      if ((m = regex.exec(textContent)) !== null) {
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          id: h
        });
      }
    }
  });

  if (spans.length === 0) {
    return escapeHtml(textContent) + trailingHtml;
  }

  // Collect boundary points to partition the string into non-overlapping segments
  const points = new Set<number>([0, textContent.length]);
  spans.forEach(s => {
    points.add(s.start);
    points.add(s.end);
  });
  const sortedPoints = Array.from(points).sort((a, b) => a - b);

  interface Segment {
    start: number;
    end: number;
    spanId: string | null;
  }
  const segments: Segment[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const pStart = sortedPoints[i];
    const pEnd = sortedPoints[i + 1];
    // If overlapping, pick the latest highlight span
    const coveringSpan = spans.slice().reverse().find(s => s.start <= pStart && s.end >= pEnd) || null;
    const spanId = coveringSpan ? coveringSpan.id : null;

    const prevSeg = segments[segments.length - 1];
    if (prevSeg && prevSeg.spanId === spanId) {
      prevSeg.end = pEnd;
    } else {
      segments.push({ start: pStart, end: pEnd, spanId });
    }
  }

  let resultHtml = '';
  segments.forEach(seg => {
    const rawSeg = textContent.substring(seg.start, seg.end);
    if (!rawSeg) return;

    if (seg.spanId) {
      resultHtml += `<mark class="highlight-marker cursor-pointer transition-colors" title="Click to remove highlight" data-id="${escapeHtmlAttr(seg.spanId)}">${escapeHtml(rawSeg)}</mark>`;
    } else {
      resultHtml += escapeHtml(rawSeg);
    }
  });

  return resultHtml + trailingHtml;
}

function QuestionCard({
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
    if (!stemRef.current) return;

    const stemNode = stemRef.current;
    const intersects = stemNode.contains(range.startContainer) || 
                       stemNode.contains(range.endContainer) || 
                       (range.commonAncestorContainer && stemNode.contains(range.commonAncestorContainer));
    if (!intersects) return;

    // Constrain selection range strictly within stemNode so dragging outside doesn't capture extra text
    const effectiveRange = range.cloneRange();
    if (!stemNode.contains(effectiveRange.startContainer)) {
      effectiveRange.setStart(stemNode, 0);
    }
    if (!stemNode.contains(effectiveRange.endContainer)) {
      effectiveRange.setEnd(stemNode, stemNode.childNodes.length);
    }
    if (effectiveRange.collapsed) return;

    const text = effectiveRange.toString().trim();
    if (text.length < 2) return;

    // Calculate which occurrence this is in the text
    let highlightId = text;
    try {
      const preSelectionRange = effectiveRange.cloneRange();
      preSelectionRange.selectNodeContents(stemNode);
      preSelectionRange.setEnd(effectiveRange.startContainer, effectiveRange.startOffset);
      const preSelectionText = preSelectionRange.toString();

      const regex = buildHighlightRegex(text);
      const matches = preSelectionText.match(regex);
      const matchIndex = matches ? matches.length : 0;

      highlightId = `${matchIndex}|${text}`;
    } catch (e) {
      highlightId = text;
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
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
      // Auto-unselect if the struck option was selected
      if (selectedOption === index) {
        setSelectedOption(undefined);
        if (onSelectOption) onSelectOption(-1);
      }
    }
    setStrikethroughs(newSet);
  };

  const isCorrect = userAnswer === question.correct_index;
  const renderedStemHtmlRaw = applyHighlights(question.question_text, highlights);
  const renderedStemHtml = typeof window !== 'undefined'
    ? DOMPurify.sanitize(renderedStemHtmlRaw, { ADD_TAGS: ['mark'], ADD_ATTR: ['data-id', 'title'] })
    : renderedStemHtmlRaw;
  const optionFontSize = Math.max(14, fontSize - 2);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-2 md:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stem */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-3 md:p-5 border border-slate-100 dark:border-slate-800 relative group transition-colors">
        <div className="flex flex-wrap justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black rounded-full uppercase tracking-widest shrink-0">
              {question.category || 'General Medicine'}
            </span>
            {(Boolean(question.is_repeat) || (question.id && KNOWN_REPEAT_IDS.has(question.id))) && (
              <span
                className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-help hover:bg-amber-500/20 transition-all select-none"
                title="This question appears in multiple ITEs"
              >
                <span aria-hidden="true">🔁</span>
                <span>High Yield Repeat Question</span>
              </span>
            )}
          </div>
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
              className={`p-2 rounded-xl transition-all ${
                highlightMode
                  ? 'text-yellow-600 bg-yellow-100 dark:text-blue-300 dark:bg-blue-950/70 shadow-inner ring-1 ring-yellow-400/40 dark:ring-blue-500/40'
                  : 'text-slate-400 hover:text-yellow-500 dark:hover:text-blue-400 hover:bg-yellow-50 dark:hover:bg-slate-800'
              }`}
              title="Toggle Highlight Mode"
            >
              <Highlighter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          ref={stemRef}
          onClick={handleStemClick}
          className={`font-bold leading-relaxed text-slate-800 dark:text-slate-100 ${highlightMode ? 'cursor-text selection:bg-yellow-200 dark:selection:bg-blue-600 dark:selection:text-white' : ''}`}
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
          
          let stateStyles = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-slate-800/80 hover:-translate-y-1 hover:shadow-md hover:scale-[1.01]";
          
          if (showExplanation) {
            if (isCorrectOption) stateStyles = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20";
            else if (isSelected && !isCorrectOption) stateStyles = "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200 opacity-80";
            else if (isStruck) stateStyles = "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50";
            else stateStyles = "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60";
          } else if (isSelected) {
            stateStyles = "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30 scale-[1.02] -translate-y-1";
          } else if (isStruck) {
            stateStyles = "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 grayscale";
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
                <div className={`w-7 h-7 text-sm rounded-xl flex items-center justify-center font-black shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700'}`}>
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
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 ${isStruck ? 'text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700' : 'text-slate-300 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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

export default React.memo(QuestionCard);
