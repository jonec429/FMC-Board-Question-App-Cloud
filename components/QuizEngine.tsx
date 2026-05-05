'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionCard from './QuestionCard';
import { ChevronRight, ChevronLeft, Clock, Save, Loader2, Trophy, X } from './AppIcons';

interface QuizEngineProps {
  user: any;
  quizId?: string;
  topic?: string;
  categories?: string[];
  years?: string[];
  count?: number;
  currentBlock?: any;
  onComplete: (results: any) => void;
  onCancel: () => void;
}

export default function QuizEngine({ user, quizId, topic, categories, years, count = 40, currentBlock, onComplete, onCancel }: QuizEngineProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(count * 90);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initQuiz() {
      try {
        setLoading(true);
        setError(null);
        
        let query = supabase.from('questions').select('*');
        
        if (categories && categories.length > 0) {
          query = query.in('category', categories);
        }
        
        if (years && years.length > 0) {
          query = query.in('year', years);
        }

        query = query.limit(count);
        
        const { data: qData, error: qError } = await query;
        if (qError) throw qError;
        if (!qData || qData.length === 0) throw new Error('No questions found matching your selection.');
        
        const shuffled = qData.sort(() => Math.random() - 0.5);
        setQuestions(shuffled);

        const { data: sData } = await supabase
          .from('quiz_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .eq('topic', topic || 'Mixed Review Block')
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sData) {
          setSessionId(sData.id);
          setCurrentIndex(sData.current_index);
          setAnswers(sData.answers || {});
          if (sData.time_left) setTimeLeft(sData.time_left);
        } else {
          const { data: newSession } = await supabase
            .from('quiz_sessions')
            .insert({
              user_id: user.id,
              quiz_id: quizId || null,
              topic: topic || 'Mixed Review Block',
              current_index: 0,
              answers: {},
              time_left: count * 90,
              is_completed: false
            })
            .select()
            .single();
          
          if (newSession) setSessionId(newSession.id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    initQuiz();
  }, [user.id, quizId, topic, categories, years, count]);

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

  useEffect(() => {
    const timer = setTimeout(() => syncProgress(), 3000);
    return () => clearTimeout(timer);
  }, [currentIndex, answers, syncProgress]);

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

  const handleFinish = async () => {
    if (!window.confirm('Are you sure you want to finish this block?')) return;
    
    setLoading(true);
    const score = questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.correct_index ? 1 : 0);
    }, 0);

    const percentage = (score / questions.length) * 100;

    // --- POINTS LOGIC (Updated for 1:1 Parity) ---
    let points = 0;
    let timingStatus = 'On Time';

    if (topic === 'Mixed Review Block' || topic === 'Custom Mixed Block' || !topic) {
      points = 0; // No points for custom blocks
    } else if (topic.toLowerCase().includes('bonus')) {
      points = 2; // 2 points for bonus blocks
    } else {
      // Assigned Block Logic: Check if it's the current block
      if (currentBlock) {
        points = 2; // On Time
      } else {
        points = 1; // Late
        timingStatus = 'Late';
      }
    }

    const resultData = {
      user_id: user.id,
      topic: topic || 'Mixed Review Block',
      score,
      total: questions.length,
      percentage,
      answers: answers,
      academic_points: points,
      timing_status: timingStatus
    };

    await supabase.from('results').insert(resultData);

    if (sessionId) {
      await supabase
        .from('quiz_sessions')
        .update({ is_completed: true })
        .eq('id', sessionId);
    }

    onComplete(resultData);
    setLoading(false);
  };

  if (loading || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 max-w-sm w-full text-center space-y-6">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[24px] flex items-center justify-center mx-auto">
                <X className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Block Error</h3>
                <p className="text-slate-500 text-sm mt-1 font-bold leading-relaxed">{error}</p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Assembling Block</h3>
                <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-black opacity-30">FMC Parity Engine</p>
              </div>
            </>
          )}
          <button onClick={onCancel} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
            Exit to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-800 rounded-lg">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-black text-slate-800 leading-tight truncate max-w-[200px] md:max-w-none">{topic || 'FMC Board Review'}</h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{formatTime(timeLeft)}</span>
                <span className="opacity-30">•</span>
                <span>Question {currentIndex + 1} of {questions.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncing && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
            <span className="hidden md:flex text-[10px] font-black text-slate-300 uppercase tracking-widest items-center gap-1">
              <Save className="w-3 h-3" />
              Cloud Sync Active
            </span>
            <button onClick={handleFinish} className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              Finish Block
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <main className="max-w-3xl mx-auto pt-12 px-4">
        {currentQuestion && (
          <QuestionCard 
            question={currentQuestion}
            userAnswer={answers[currentIndex]}
            onAnswer={(idx) => setAnswers(prev => ({ ...prev, [currentIndex]: idx }))}
            showExplanation={answers[currentIndex] !== undefined}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-8 md:pb-4 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex-1 py-4 rounded-2xl font-black text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Prev
          </button>
          
          <button
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex === questions.length - 1}
            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
