'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionCard from './QuestionCard';
import { ChevronRight, ChevronLeft, Clock, Save, Loader2, X } from './AppIcons';

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
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(count * 90);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    async function initQuiz() {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from('questions').select('*');

        if (categories && categories.length > 0) query = query.in('category', categories);
        if (years && years.length > 0) query = query.in('year', years);

        const { data: qData, error: qError } = await query.limit(count * 3);
        if (qError) throw qError;
        if (!qData || qData.length === 0) throw new Error('No questions found matching your selection.');

        const shuffled = [...qData].sort(() => Math.random() - 0.5).slice(0, count);
        setQuestions(shuffled);
        setTimeLeft(count * 90);

        const topicLabel = topic || 'Mixed Review Block';

        const { data: sData } = await supabase
          .from('quiz_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .eq('topic', topicLabel)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sData) {
          setSessionId(sData.id);
          setCurrentIndex(sData.current_index || 0);
          setAnswers(sData.answers || {});
          if (sData.time_left) setTimeLeft(sData.time_left);
        } else {
          const { data: newSession } = await supabase
            .from('quiz_sessions')
            .insert({
              user_id: user.id,
              quiz_id: quizId || null,
              topic: topicLabel,
              current_index: 0,
              answers: {},
              time_left: count * 90,
              is_completed: false,
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
      .update({ current_index: currentIndex, answers, time_left: timeLeft, last_updated: new Date().toISOString() })
      .eq('id', sessionId);
    setSyncing(false);
  }, [sessionId, currentIndex, answers, timeLeft, syncing]);

  useEffect(() => {
    const t = setTimeout(() => syncProgress(), 3000);
    return () => clearTimeout(t);
  }, [currentIndex, answers, syncProgress]);

  // Timer countdown — stops at 0, turns red as warning
  useEffect(() => {
    if (showResults) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [showResults]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitQuiz = async (autoSubmit = false) => {
    if (!autoSubmit && !window.confirm('Are you sure you want to finish this block?')) return;

    setSubmitting(true);
    const score = questions.reduce((acc, q, idx) => acc + (answers[idx] === q.correct_index ? 1 : 0), 0);
    const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;
    const topicLabel = topic || 'Mixed Review Block';

    let points = 0;
    let timingStatus = 'On Time';

    if (topicLabel === 'Mixed Review Block' || !topic) {
      points = 0;
    } else if (topicLabel.toLowerCase().includes('bonus')) {
      points = 2;
    } else {
      if (currentBlock) {
        points = 2;
        timingStatus = 'On Time';
      } else {
        points = 1;
        timingStatus = 'Late';
      }
    }

    const missedQuestions = questions
      .map((q, idx) => ({ q, idx, isCorrect: answers[idx] === q.correct_index }))
      .filter(({ isCorrect }) => !isCorrect);

    const result = {
      user_id: user.id,
      legacy_email: user.email,
      topic: topicLabel,
      score,
      total: questions.length,
      percentage: parseFloat(percentage.toFixed(2)),
      academic_points: points,
      timing_status: timingStatus,
    };

    await supabase.from('results').insert(result);

    if (sessionId) {
      await supabase.from('quiz_sessions').update({ is_completed: true }).eq('id', sessionId);
    }

    setResultData({ ...result, missedQuestions, questions });
    setShowResults(true);
    setSubmitting(false);
  };

  const handleFinish = () => submitQuiz(false);

  // RESULTS SCREEN
  if (showResults && resultData) {
    const { score, total, percentage, academic_points, timing_status, missedQuestions } = resultData;
    const passed = percentage >= 70;

    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="max-w-3xl mx-auto pt-12 px-4 space-y-8">
          {/* Score Hero */}
          <div className={`rounded-[40px] p-10 text-center text-white ${passed ? 'bg-emerald-600' : 'bg-slate-700'}`}>
            <div className="text-6xl font-black mb-2">{percentage.toFixed(1)}%</div>
            <div className="text-lg font-bold opacity-80">{score} / {total} correct</div>
            <div className="mt-6 flex justify-center gap-8">
              <div>
                <div className="text-2xl font-black">{academic_points}</div>
                <div className="text-xs font-black uppercase tracking-widest opacity-70">Academic Points</div>
              </div>
              {timing_status && (
                <div>
                  <div className="text-2xl font-black">
                    {timing_status === 'On Time' ? '✅' : timing_status === 'Late' ? '⏰' : '—'}
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest opacity-70">{timing_status}</div>
                </div>
              )}
            </div>
          </div>

          {/* Missed Questions */}
          {missedQuestions.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">
                Missed Questions ({missedQuestions.length})
              </h3>
              <div className="space-y-4">
                {missedQuestions.map(({ q, idx }: any) => (
                  <div key={idx} className="bg-white rounded-2xl border border-red-100 p-6">
                    <p className="font-bold text-slate-800 text-sm mb-3">{q.question_text}</p>
                    <div className="space-y-1.5">
                      {(q.options as string[]).map((opt, oi) => (
                        <div
                          key={oi}
                          className={`px-3 py-2 rounded-xl text-sm font-medium ${oi === q.correct_index ? 'bg-emerald-50 text-emerald-700 font-bold' : oi === answers[idx] ? 'bg-red-50 text-red-600' : 'text-slate-400'}`}
                        >
                          {String.fromCharCode(65 + oi)}. {opt}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="mt-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">{q.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onComplete(resultData)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
                <h3 className="text-xl font-black text-slate-800">Block Error</h3>
                <p className="text-slate-500 text-sm mt-1 font-bold">{error}</p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <div>
                <h3 className="text-xl font-black text-slate-800">Assembling Block</h3>
                <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-black opacity-30">Loading Questions...</p>
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
  const answeredCount = Object.keys(answers).length;
  const isTimeLow = timeLeft > 0 && timeLeft < 300;

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
                <Clock className={`w-3 h-3 ${isTimeLow ? 'text-red-500' : ''}`} />
                <span className={isTimeLow ? 'text-red-500 font-black' : ''}>{formatTime(timeLeft)}</span>
                <span className="opacity-30">·</span>
                <span>Q {currentIndex + 1} / {questions.length}</span>
                <span className="opacity-30">·</span>
                <span>{answeredCount} answered</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncing && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
            {!syncing && (
              <span className="hidden md:flex text-[10px] font-black text-slate-300 uppercase tracking-widest items-center gap-1">
                <Save className="w-3 h-3" />
                Cloud Sync
              </span>
            )}
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finish Block'}
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
