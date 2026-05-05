'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Highlighter, Strikethrough, Gem, ExternalLink, CheckCircle, XCircle } from './Icons';

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
}

export default function QuestionCard({ 
  question, 
  userAnswer, 
  onAnswer, 
  showExplanation = false 
}: QuestionCardProps) {
  const [highlights, setHighlights] = useState<{ start: number, end: number, text: string }[]>([]);
  const [strikethroughs, setStrikethroughs] = useState<Set<number>>(new Set());
  const stemRef = useRef<HTMLDivElement>(null);

  // Reset strikethroughs and highlights when question changes
  useEffect(() => {
    setStrikethroughs(new Set());
    setHighlights([]);
  }, [question.question_text]);

  const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!stemRef.current?.contains(range.commonAncestorContainer)) return;

    // Simplified highlight: we'll just wrap the selection in a marker
    // In a production app, we'd calculate offsets to preserve them across re-renders
    const span = document.createElement('mark');
    span.style.backgroundColor = '#fef08a'; // Tailwind yellow-200
    span.style.color = 'inherit';
    span.className = 'highlight-marker';
    range.surroundContents(span);
    
    selection.removeAllRanges();
  };

  const toggleStrikethrough = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newSet = new Set(strikethroughs);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setStrikethroughs(newSet);
  };

  const isCorrect = userAnswer === question.correct_index;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Question Stem */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 relative group">
        <div className="flex justify-between items-start mb-4">
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-black rounded-full uppercase tracking-widest">
            {question.category || 'General Medicine'}
          </span>
          <button 
            onClick={handleHighlight}
            className="p-2 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-xl transition-all"
            title="Highlight Selection"
          >
            <Highlighter className="w-5 h-5" />
          </button>
        </div>

        <div 
          ref={stemRef}
          className="text-xl font-bold leading-relaxed text-slate-800 select-text"
          dangerouslySetInnerHTML={{ __html: question.question_text }}
        />
      </div>

      {/* Options */}
      <div className="grid gap-3">
        {question.options.map((option, index) => {
          const isSelected = userAnswer === index;
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
                onClick={() => !isStruck && onAnswer(index)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${stateStyles}`}
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

          {question.resource_link && (
            <a 
              href={question.resource_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-blue-400 font-bold transition-all border border-white/10"
            >
              <ExternalLink className="w-4 h-4" />
              Reference Material
            </a>
          )}
        </div>
      )}
    </div>
  );
}
