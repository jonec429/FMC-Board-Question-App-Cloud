'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Loader2, Target } from './AppIcons';

interface ResidentReviewProps {
  user: any;
  onClose: () => void;
}

export default function ResidentReview({ user, onClose }: ResidentReviewProps) {
  const [loading, setLoading] = useState(true);
  const [missedQuestions, setMissedQuestions] = useState<any[]>([]);
  const [latestStatus, setLatestStatus] = useState<Map<string, boolean>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function loadMissedQuestions() {
      setLoading(true);
      try {
        // Fetch all attempts for the user
        const { data: attempts, error: attError } = await supabase
          .from('question_attempts')
          .select('question_id, is_correct, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (attError) throw attError;

        if (!attempts || attempts.length === 0) {
          setMissedQuestions([]);
          return;
        }

        // Dedupe by question_id (keep latest attempt)
        const latestAttempts = new Map<string, boolean>();
        const everMissed = new Set<string>();

        attempts.forEach(a => {
          if (!latestAttempts.has(a.question_id)) {
            latestAttempts.set(a.question_id, a.is_correct);
          }
          if (!a.is_correct) everMissed.add(a.question_id);
        });

        const incorrectIds = Array.from(everMissed);

        if (incorrectIds.length === 0) {
          setMissedQuestions([]);
          return;
        }

        setLatestStatus(latestAttempts);

        // Fetch question details
        // Chunk if needed, but for now just one query
        const { data: qData, error: qError } = await supabase
          .from('questions')
          .select('*')
          .in('id', incorrectIds);

        if (qError) throw qError;
        setMissedQuestions(qData || []);
      } catch (err) {
        console.error('Failed to load missed questions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMissedQuestions();
  }, [user.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  const q = missedQuestions[currentIndex];

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 flex flex-col animate-fade-in">
      <div className="bg-white border-b border-slate-100 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-800">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight">Review Weak Areas</h2>
              <p className="text-xs font-bold text-slate-400">{missedQuestions.length} missed questions pending review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {missedQuestions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 mt-12">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">All Caught Up!</h3>
              <p className="text-slate-500 mt-2 font-medium max-w-sm mx-auto">
                You have no pending missed questions to review. Keep up the great work and take another block to test your knowledge.
              </p>
              <button
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-6 relative overflow-hidden">
              {latestStatus.get(q.id) ? (
                <div className="absolute top-0 right-0 left-0 p-3 bg-emerald-500 text-white font-black text-xs text-center uppercase tracking-widest shadow-md">
                  ✓ Review Completed: You recently answered this correctly!
                </div>
              ) : (
                <div className="absolute top-0 right-0 p-4 bg-rose-50 text-rose-600 font-black text-xs rounded-bl-3xl border-l border-b border-rose-100 uppercase tracking-widest">
                  Review Mode
                </div>
              )}

              <div className={`flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-widest ${latestStatus.get(q.id) ? 'mt-8' : ''}`}>
                <span>Question {currentIndex + 1} of {missedQuestions.length}</span>
                <span className="opacity-30">·</span>
                <span>{q.category}</span>
                {q.year && <span className="text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">ITE {q.year}</span>}
              </div>

              <p className="text-slate-800 font-bold text-lg leading-relaxed">{q.question_text}</p>
              
              <div className="space-y-3 pt-4 border-t border-slate-100">
                {(q.options as string[]).map((opt, idx) => (
                  <div
                    key={idx}
                    className={`px-4 py-3 rounded-2xl text-sm font-medium border-2 flex items-center gap-3 ${idx === q.correct_index ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-100 bg-slate-50 text-slate-400 opacity-50'}`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${idx === q.correct_index ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    {opt}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Explanation</h4>
                  <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {missedQuestions.length > 0 && (
        <div className="bg-white border-t border-slate-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex-1 py-4 rounded-2xl font-black text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" /> Prev
            </button>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(missedQuestions.length - 1, prev + 1))}
              disabled={currentIndex === missedQuestions.length - 1}
              className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
