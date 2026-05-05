'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionCard from './QuestionCard';
import { ChevronRight, ChevronLeft, Clock, Save, Loader2, Trophy, ArrowUpRight } from './Icons';

interface QuizEngineProps {
  user: any;
  quizId?: string;
  topic?: string;
  onComplete: (results: any) => void;
}

export default function QuizEngine({ user, quizId, topic, onComplete }: QuizEngineProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour default
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 1. Fetch Questions & Restore Session
  useEffect(() => {
    async function initQuiz() {
      setLoading(true);
      
      // Fetch Questions
      let query = supabase.from('questions').select('*');
      if (quizId) {
        // Fetch specific quiz questions (assuming we have a mapping)
        // For now, we'll fetch all or a subset
        query = query.limit(40);
      } else {
        query = query.limit(40);
      }
      
      const { data: qData, error: qError } = await query;
      if (qError) {
        console.error('Error fetching questions:', qError);
        return;
      }
      setQuestions(qData || []);

      // Restore Session
      const { data: sData } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .single();

      if (sData) {
        setSessionId(sData.id);
        setCurrentIndex(sData.current_index);
        setAnswers(sData.answers || {});
        if (sData.time_left) setTimeLeft(sData.time_left);
      } else {
        // Create new session
        const { data: newSession } = await supabase
          .from('quiz_sessions')
          .insert({
            user_id: user.id,
            quiz_id: quizId || null,
            topic: topic || 'Mixed Block',
            current_index: 0,
            answers: {},
            time_left: 3600
          })
          .select()
          .single();
        if (newSession) setSessionId(newSession.id);
      }
      setLoading(false);
    }
    initQuiz();
  }, [user.id, quizId, topic]);

  // 2. Auto-Sync Progress
  const syncProgress = useCallback(async () => {
    if (!sessionId || syncing) return;
    setSyncing(true);
    await supabase
      .from('quiz_sessions')
      .update({
        current_index: currentIndex,
        answers: answers,
        time_left: timeLeft,
        last_updated: new Date().toISOString()
      })
      .eq('id', sessionId);
    setSyncing(false);
  }, [sessionId, currentIndex, answers, timeLeft, syncing]);

  // Sync on index change or answer
  useEffect(() => {
    const timer = setTimeout(() => {
      syncProgress();
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentIndex, answers, syncProgress]);

  // 3. Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (answerIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: answerIndex }));
  };

  const handleFinish = async () => {
    setLoading(true);
    const score = questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.correct_index ? 1 : 0);
    }, 0);

    const resultData = {
      user_id: user.id,
      quiz_id: quizId || null,
      topic: topic || 'Mixed Block',
      score,
      total: questions.length,
      percentage: (score / questions.length) * 100,
      answers: answers,
      academic_points: score >= (questions.length * 0.7) ? 2 : 1 // Placeholder logic
    };

    // Save to Results
    await supabase.from('results').insert(resultData);

    // Close Session
    if (sessionId) {
      await supabase
        .from('quiz_sessions')
        .update({ is_completed: true })
        .eq('id', sessionId);
    }

    onComplete(resultData);
    setLoading(false);
  };

  if (loading && questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Loading Quiz Bank...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 leading-tight">{topic || 'FMC Board Review'}</h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{formatTime(timeLeft)}</span>
                <span className="opacity-30">•</span>
                <span>{answeredCount} of {questions.length} Answered</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncing && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter flex items-center gap-1">
              <Save className="w-3 h-3" />
              Syncing to Cloud
            </span>
            <button 
              onClick={handleFinish}
              className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Finish Block
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-5xl mx-auto mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto pt-12 px-4">
        {currentQuestion && (
          <QuestionCard 
            question={currentQuestion}
            userAnswer={answers[currentIndex]}
            onAnswer={handleAnswer}
            showExplanation={answers[currentIndex] !== undefined}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-8 md:pb-4 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex-1 max-w-[140px] py-4 rounded-2xl font-black text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          
          <div className="hidden md:flex flex-1 items-center justify-center gap-1.5">
            {questions.map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-blue-600 w-6' : answers[idx] !== undefined ? 'bg-emerald-400' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex === questions.length - 1}
            className="flex-1 max-w-[140px] py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
