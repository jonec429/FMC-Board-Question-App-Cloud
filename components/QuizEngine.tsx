'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionCard from './QuestionCard';
import QotdHistory from './QotdHistory';
import QuizReview from './QuizReview';
import QuestionNavigator from './QuestionNavigator';
import { ChevronRight, ChevronLeft, Clock, Save, Loader2, X, CheckCircle, Sparkles } from './AppIcons';
import { withTimeout } from '@/lib/utils';
import { getCurrentAcademicYear } from '@/lib/academicYear';
import { getTodayDateString, isPastNoon } from '@/lib/qotd';
import { processGamification } from '@/lib/gamification';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  saveOfflineSession,
  loadOfflineSession,
  clearOfflineSession,
  queuePendingSubmission,
  flushPendingSubmissions,
  PendingSubmission,
} from '@/lib/offlineSync';
import { QotdPeerComparisonResponse } from '@/lib/types';

interface QuizEngineProps {
  user: any;
  isQotd?: boolean;
  qotdQuestion?: any;
  isQotdCompleted?: boolean;
  qotdAttempt?: any;
  quizId?: string;
  topic?: string;
  /** Fixed list of question IDs (set on assigned blocks so every resident sees the same questions). Takes precedence over category/keyword filtering. */
  questionIds?: string[];
  categories?: string[];
  keywords?: string[];
  years?: string[];
  pool?: 'all' | 'unused' | 'incorrect';
  count?: number;
  timerEnabled?: boolean;
  forceNew?: boolean;
  currentBlock?: any;
  onComplete: (results: any) => void;
  onCancel: () => void;
}

// Font-size scale options for the A-/A+ toolbar
const FONT_SIZES = [14, 16, 18, 20, 22, 24];
const DEFAULT_FONT_INDEX = 1; // 16px
const EMPTY_ARRAY: any[] = [];

export default function QuizEngine({ user, isQotd, qotdQuestion, isQotdCompleted, qotdAttempt, quizId, topic, questionIds, categories, keywords, years, pool = 'all', count = 40, timerEnabled = false, forceNew = false, currentBlock, onComplete, onCancel }: QuizEngineProps) {
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [stagedAnswers, setStagedAnswers] = useState<Record<number, number>>({});
  const [viewedQuestions, setViewedQuestions] = useState<Set<number>>(new Set([0]));
  const [showNavigator, setShowNavigator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resumingLater, setResumingLater] = useState(false);
  const [timeLeft, setTimeLeft] = useState(count * 90);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [isSubmittedOffline, setIsSubmittedOffline] = useState(false);
  const [showAllReview, setShowAllReview] = useState(false);
  // Practice (reveal after each Q) vs Quiz (answers hidden until the end), chosen
  // on the pre-start screen for non-QOTD quizzes. `started` gates that screen; a
  // resumed session (existing progress) skips it.
  const [mode, setMode] = useState<'practice' | 'quiz'>('practice');
  const [started, setStarted] = useState(false);
  const [isTimed, setIsTimed] = useState(timerEnabled);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [newBadgesEarned, setNewBadgesEarned] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (showResults && resultData && !confettiFiredRef.current) {
      const passed = resultData.percentage > 60;
      // Fire confetti if they scored > 60% OR if they earned a new badge
      if (passed || newBadgesEarned) {
        confettiFiredRef.current = true;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          zIndex: 9999,
          colors: ['#4f46e5', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b']
        });
      }
    }
  }, [showResults, resultData, newBadgesEarned]);

  // Idempotency guards for submit. submittingRef blocks re-entrant calls
  // (double-tap, timer auto-submit racing a manual Finish) synchronously, since
  // the `submitting` state updates too late to stop a second invocation. The
  // *SavedRef flags persist across retries so a click-Finish-again after a
  // partial failure never re-inserts rows that already landed.
  const submittingRef = useRef(false);
  const resultSavedRef = useRef(false);
  const attemptsSavedRef = useRef(false);

  // QOTD States
  const [qotdReaction, setQotdReaction] = useState<string | null>(null);
  const [qotdAggregates, setQotdAggregates] = useState<Record<string, number> | null>(null);
  const [qotdStats, setQotdStats] = useState<{correct: number, incorrect: number, total: number} | null>(null);
  const [qotdTab, setQotdTab] = useState<'today' | 'history'>('today');
  const [qotdComparison, setQotdComparison] = useState<QotdPeerComparisonResponse | null>(null);
  const [loadingQotdComparison, setLoadingQotdComparison] = useState(false);

  const fetchPeerComparison = useCallback(async (questionId: string) => {
    try {
      setLoadingQotdComparison(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/resident/qotd-comparison?questionId=${encodeURIComponent(questionId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: QotdPeerComparisonResponse = await res.json();
        setQotdComparison(data);
        if (data.questionStats) {
          setQotdStats({
            correct: data.questionStats.correctCount,
            incorrect: data.questionStats.incorrectCount,
            total: data.questionStats.totalResponders
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load QOTD peer comparison:', e);
    } finally {
      setLoadingQotdComparison(false);
    }
  }, []);

  useEffect(() => {
    setViewedQuestions(prev => {
      if (prev.has(currentIndex)) return prev;
      const newSet = new Set(prev);
      newSet.add(currentIndex);
      return newSet;
    });
  }, [currentIndex]);

  // === Quiz Tools (Text Resize + Highlight/Strikethrough Persistence) ===
  // Font size loads from localStorage so the user's preference persists across all quizzes
  const [fontIndex, setFontIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_FONT_INDEX;
    const stored = parseInt(window.localStorage.getItem('fmc-fontIndex') || '');
    return isNaN(stored) ? DEFAULT_FONT_INDEX : Math.min(FONT_SIZES.length - 1, Math.max(0, stored));
  });
  const fontSize = FONT_SIZES[fontIndex];

  // Per-question highlights and strikethroughs, keyed by question.id — session-only
  const [questionTools, setQuestionTools] = useState<Record<string, { highlights: string[]; strikethroughs: number[] }>>({});

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = useCallback((idx: number) => {
    if (idx === -1) {
      setStagedAnswers(prev => {
        const next = { ...prev };
        delete next[currentIndex];
        return next;
      });
      if (mode === 'quiz') {
        setAnswers(prev => {
          const next = { ...prev };
          delete next[currentIndex];
          return next;
        });
      }
    } else {
      setStagedAnswers(prev => ({ ...prev, [currentIndex]: idx }));
      if (mode === 'quiz') {
        setAnswers(prev => ({ ...prev, [currentIndex]: idx }));
      }
    }
  }, [currentIndex, mode]);

  const handleToolsChange = useCallback((tools: { highlights: string[]; strikethroughs: number[] }) => {
    if (!currentQuestion?.id) return;
    setQuestionTools(prev => ({
      ...prev,
      [currentQuestion.id]: tools,
    }));
  }, [currentQuestion?.id]);

  const handleRetakeMissed = useCallback(() => {
    if (!resultData?.missedQuestions) return;
    const missedList = resultData.missedQuestions.map((mq: any) => mq.q).filter(Boolean);
    if (missedList.length === 0) return;
    setQuestions(missedList);
    setAnswers({});
    setStagedAnswers({});
    setViewedQuestions(new Set([0]));
    setCurrentIndex(0);
    setMode('practice');
    setStarted(true);
    setShowResults(false);
    setResultData(null);
    setSessionId(null);
    setTimeLeft(missedList.length * 90);
  }, [resultData?.missedQuestions]);

  const persistFontIndex = (idx: number) => {
    setFontIndex(idx);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fmc-fontIndex', String(idx));
    }
  };
  const increaseFont = () => persistFontIndex(Math.min(FONT_SIZES.length - 1, fontIndex + 1));
  const decreaseFont = () => persistFontIndex(Math.max(0, fontIndex - 1));

  useEffect(() => {
    async function initQuiz() {
      try {
        setLoading(true);
        setError(null);

        if (isQotd && qotdQuestion) {
          setQuestions([qotdQuestion]);
          setTimeLeft(90);
          
          if (isQotdCompleted) {
             const isCorrect = qotdAttempt?.is_correct || false;
             setResultData({
                topic: 'Question of the Day',
                score: isCorrect ? 1 : 0,
                total: 1,
                percentage: isCorrect ? 100 : 0,
                academic_points: 0,
                timing_status: 'On Time',
                questions: [qotdQuestion],
                missedQuestions: isCorrect ? [] : [{ q: qotdQuestion, idx: 0, isCorrect: false }],
             });
             if (qotdAttempt?.selected_index !== undefined && qotdAttempt?.selected_index !== null) {
               setAnswers({ 0: qotdAttempt.selected_index });
             }
             attemptsSavedRef.current = true;
             if (isPastNoon()) {
               setShowResults(true);
             } else {
               setShowResults(false);
             }
             
             // Fetch existing reactions silently
             supabase.from('qotd_reactions')
              .select('reaction, user_id')
              .eq('question_id', qotdQuestion.id)
              .eq('date', getTodayDateString())
              .then(({ data }) => {
                if (data) {
                  const fetchedAggs: Record<string, number> = { '🤯': 0, '🤨': 0, '👍': 0, '🥱': 0, '😴': 0 };
                  data.forEach((r: any) => { 
                    if (fetchedAggs[r.reaction] !== undefined) fetchedAggs[r.reaction]++; 
                    if (r.user_id === user.id) setQotdReaction(r.reaction);
                  });
                  setQotdAggregates(fetchedAggs);
                }
              });

             // Fetch cohort stats silently via RPC and API
             supabase.rpc('get_qotd_cohort_stats', { p_question_ids: [qotdQuestion.id] })
              .then(({ data }) => {
                if (data && data.length > 0) {
                  const correct = Number(data[0].correct) || 0;
                  const incorrect = Number(data[0].incorrect) || 0;
                  setQotdStats({ correct, incorrect, total: correct + incorrect });
                }
              });
             fetchPeerComparison(qotdQuestion.id);
          }
          
          setLoading(false);
          return; // Skip session logic for QOTD
        }

        const topicLabel = topic || 'Mixed Review Block';

        // 1. Fetch active session first
        // If forceNew is true, we skip checking for an existing session and start fresh.
        let sData: any = null;
        if (!forceNew) {
          const { data } = (await withTimeout(
            supabase
              .from('quiz_sessions')
              .select('*')
              .eq('user_id', user.id)
              .eq('is_completed', false)
              .eq('topic', topicLabel)
              .order('last_updated', { ascending: false })
              .limit(1)
              .maybeSingle()
          )) as any;
          sData = data;

          if (sData) {
            setSessionId(sData.id);
            setCurrentIndex(sData.current_index || 0);
            setAnswers(sData.answers || {});
            if (sData.time_left) setTimeLeft(sData.time_left);
            
            // Reconcile with local offline backup if it contains newer or more answers
            const offlineBackup = loadOfflineSession(sData.id || topicLabel);
            if (offlineBackup) {
              const cloudAnswerCount = Object.keys(sData.answers || {}).length;
              const localAnswerCount = Object.keys(offlineBackup.answers || {}).length;
              if (localAnswerCount >= cloudAnswerCount) {
                setAnswers(offlineBackup.answers);
                if (offlineBackup.currentIndex !== undefined) {
                  setCurrentIndex(offlineBackup.currentIndex);
                }
                if (offlineBackup.timeLeft) {
                  setTimeLeft(offlineBackup.timeLeft);
                }
              }
            }
            
            if (sData.questions && Array.isArray(sData.questions) && sData.questions.length > 0) {
              setQuestions(sData.questions);
              setLoading(false);
              return; // Skip new fetch if we already have questions
            }
          }
        }

        // --- FETCH NEW QUESTIONS ONLY IF NO EXISTING SESSION WITH QUESTIONS ---

        const isDemo = currentBlock?.block_type === 'demo' || topic?.toLowerCase() === 'demo quiz';
        // NEW (Sprint 5): When the block has a fixed assigned question list, every resident sees
        // the same questions. The order is still shuffled per resident below for delivery.
        const isFixedBlock = !isDemo && Array.isArray(questionIds) && questionIds.length > 0;

        let query = supabase.from('questions').select('*');

        if (isDemo) {
          query = query.in('id', [
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000003'
          ]);
        } else if (isFixedBlock) {
          // Fixed assigned set — ignore category/year/pool filters by design
          query = query.in('id', questionIds!);
        } else {
          // Legacy / Mixed Review path — sample from a category pool
          if (categories && categories.length > 0) {
            query = query.in('category', categories);
          }

          if (keywords && keywords.length > 0) {
            const orFilter = keywords.map(kw => `question_text.ilike.%${kw}%`).join(',');
            query = query.or(orFilter);
          }

          if (years && years.length > 0) {
            query = query.in('year', years);
          }
        }

        // Filter by Pool if necessary
        let excludeIds: string[] = [];
        let includeIds: string[] = [];
        let requireInclude = false;

        // Pool filtering (unused/incorrect) only applies to category-based custom quizzes, not fixed blocks
        if (!isDemo && !isFixedBlock && pool !== 'all') {
          const { data: attemptData } = (await withTimeout(
            supabase.from('question_attempts').select('question_id, is_correct, created_at').eq('user_id', user.id).order('created_at', { ascending: true })
          )) as any;
          
          if (attemptData) {
            if (pool === 'unused') {
              // Now handled completely by the server-side RPC `get_unused_questions`.
              // We do not need to fetch local excludeIds.
            } else if (pool === 'incorrect') {
              // Only include questions where the most recent attempt was incorrect
              const latestAttempts = new Map<string, boolean>();
              for (const attempt of attemptData) {
                 latestAttempts.set(attempt.question_id, attempt.is_correct);
              }
              
              const incorrectIds = new Set<string>();
              latestAttempts.forEach((isCorrect, qId) => {
                 if (!isCorrect) incorrectIds.add(qId);
              });

              includeIds = Array.from(incorrectIds);
              requireInclude = true;
            }
          }
        }

        // Apply pool filters
        if (requireInclude) {
           if (includeIds.length === 0) throw new Error('No incorrect questions found to review.');
           // chunking might be needed if >1000, but for now this is fine
           query = query.in('id', includeIds);
        } else if (excludeIds.length > 0) {
           // PostgREST doesn't support 'not.in' easily via JS client in older versions, 
           // but Supabase JS client supports `.not('id', 'in', `(${excludeIds.join(',')})`)` or just filtering after fetch.
           // Since we limit, filtering after fetch might miss questions. Let's try native:
           // Since excludeIds can be large, we'll fetch a larger pool and filter locally if needed, or use .filter
        }

        // Fetch a pool, sorted by year DESC (ITE Priority).
        // Fixed blocks: fetch all assigned IDs (no extra buffer needed).
        const fetchLimit = isDemo
          ? 3
          : isFixedBlock
            ? questionIds!.length
            : (pool === 'unused' ? count : count * 3); // Unused pool now gets exact count from RPC

        let finalPool: any[] = [];

        if (!isDemo && !isFixedBlock && pool === 'unused') {
          // Use the robust RPC to fetch unused questions (fixes the under-fill issue)
          const { data: qData, error: qError } = (await withTimeout(
            supabase.rpc('get_unused_questions', {
              p_user_id: user.id,
              p_categories: categories && categories.length > 0 ? categories : null,
              p_keywords: keywords && keywords.length > 0 ? keywords : null,
              p_years: years && years.length > 0 ? years : null,
              p_limit: fetchLimit
            })
          )) as any;
          if (qError) throw qError;
          finalPool = qData || [];
        } else {
          // Legacy pathway for incorrect, all, demo, fixed blocks
          let dbQuery = query.order('year', { ascending: false }).limit(fetchLimit);
          
          if (!isDemo && !isFixedBlock) {
             // Exclude demo questions from regular quizzes
             dbQuery = dbQuery.neq('year', 'Demo')
                .neq('category', 'Demo')
                .not('id', 'in', '("00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003")');
          }

          const { data: qData, error: qError } = (await withTimeout(dbQuery)) as any;
          if (qError) throw qError;
          finalPool = qData || [];
          
          // Local exclusion filter (only for older methods, if excludeIds were populated)
          if (excludeIds.length > 0) {
            const exSet = new Set(excludeIds);
            finalPool = finalPool.filter((q: any) => !exSet.has(q.id));
          }
        }

        if (!finalPool || finalPool.length === 0) throw new Error('No questions found matching your selection.');

        // For fixed blocks every resident takes the full assigned set; the only randomness
        // is the order of delivery. For other quiz types we still take the top N newest, then shuffle.
        const selected = isFixedBlock ? finalPool : finalPool.slice(0, count);
        
        // Fisher-Yates shuffle (uniform shuffle)
        const shuffled = [...selected];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        setQuestions(shuffled);
        setTimeLeft(selected.length * 90);

        if (!sData) {
          const { data: newSession, error: insertError } = (await withTimeout(
            supabase
              .from('quiz_sessions')
              .insert({
                user_id: user.id,
                quiz_id: null,
                topic: topicLabel,
                current_index: 0,
                questions: shuffled,
                answers: {},
                time_left: selected.length * 90,
                is_completed: false,
                last_updated: new Date().toISOString()
              })
              .select('id')
              .single()
          )) as any;

          if (insertError) throw insertError;

          if (newSession) setSessionId(newSession.id);
        } else if (!sData.questions) {
          // Backward compatibility: If resuming a session that lacked questions snapshot, 
          // patch it with the newly generated questions.
          await supabase.from('quiz_sessions').update({ questions: shuffled }).eq('id', sData.id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    initQuiz();
  }, [
    user.id,
    quizId,
    topic,
    categories,
    keywords,
    years,
    pool,
    count,
    currentBlock?.block_type,
    forceNew,
    isQotd,
    isQotdCompleted,
    qotdAttempt?.is_correct,
    qotdAttempt?.selected_index,
    qotdQuestion,
    questionIds,
    fetchPeerComparison,
  ]);

  const syncProgress = useCallback(async () => {
    // Always mirror to offline backup immediately
    saveOfflineSession(sessionId || topic || 'active_quiz', {
      sessionId: sessionId || undefined,
      topic,
      currentIndex,
      answers,
      timeLeft,
      lastUpdated: new Date().toISOString(),
    });

    if (!sessionId || syncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    setSyncing(true);
    try {
      await withTimeout(
        supabase
          .from('quiz_sessions')
          .update({ current_index: currentIndex, answers, time_left: timeLeft, last_updated: new Date().toISOString() })
          .eq('id', sessionId),
        6000
      );
    } catch (err) {
      console.warn('[QuizEngine] Background cloud sync warning (progress preserved locally):', err);
    } finally {
      setSyncing(false);
    }
  }, [sessionId, topic, currentIndex, answers, timeLeft, syncing]);

  useEffect(() => {
    const t = setTimeout(() => syncProgress(), 3000);
    return () => clearTimeout(t);
  }, [currentIndex, answers, syncProgress]);

  // True while the current question's explanation is showing — i.e. the resident
  // already answered it and is reviewing. (No explanation shows for QOTD, or in
  // Quiz mode where answers are hidden until the end, so the timer runs normally.)
  const reviewingExplanation = !isQotd && mode === 'practice' && answers[currentIndex] !== undefined;

  // Timer countdown — stops at 0, turns red as warning. Pauses while reviewing an
  // explanation so reading it never counts against the resident's time.
  useEffect(() => {
    if (showResults || !isTimed || reviewingExplanation) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [showResults, isTimed, reviewingExplanation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitQuiz = async (autoSubmit = false, overrideAnswers?: Record<number, number>) => {
    // Re-entrancy guard: claim synchronously so a second trigger (double-tap, or
    // the timer auto-submit racing a manual Finish) can't slip through before the
    // `submitting` state updates. Release the claim if the user cancels the confirm.
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (!autoSubmit) {
      const unansweredIndices = questions
        .map((q, idx) => answers[idx] === undefined ? idx + 1 : -1)
        .filter(idx => idx !== -1);
      
      if (unansweredIndices.length > 0) {
        submittingRef.current = false;
        alert(`Please complete the following questions before finishing the block:\nQuestion(s): ${unansweredIndices.join(', ')}`);
        return;
      }

      if (!window.confirm('Are you sure you want to finish this block?')) {
        submittingRef.current = false;
        return;
      }
    }

    setSubmitting(true);
    const finalAnswers = overrideAnswers || answers;
    
    const score = questions.reduce((acc, q, idx) => acc + (finalAnswers[idx] === q.correct_index ? 1 : 0), 0);
    const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;
    const topicLabel = topic || 'Mixed Review Block';

    let points = 0;
    let timingStatus: string | null = null;

    const isDemo = currentBlock?.block_type === 'demo' || topicLabel.toLowerCase() === 'demo quiz';
    const isCustomOrMixed = topicLabel === 'Mixed Review Block' || !topic || topicLabel.toLowerCase().includes('weakest topics');

    if (isCustomOrMixed || isQotd || isDemo) {
      points = 0;
      timingStatus = null;
    } else if (topicLabel.toLowerCase().includes('bonus')) {
      points = 0;
      timingStatus = null;
    } else {
      if (currentBlock && currentBlock.topic === topicLabel) {
        points = 2;
        timingStatus = 'On Time';
      } else {
        points = 0;
        timingStatus = 'Late';
      }
    }

    const missedQuestions = questions
      .map((q, idx) => ({ q, idx, isCorrect: finalAnswers[idx] === q.correct_index }))
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
      academic_year: getCurrentAcademicYear(),
      // Snapshot for reviewing this quiz later (My Performance): the questions in
      // the order taken + the resident's answer. Correct answer + explanation are
      // read live from the questions table at review time.
      review_data: questions.map((q, idx) => ({ q: q.id, a: finalAnswers[idx] ?? null })),
    };

    const attempts = !isDemo
      ? questions.map((q, idx) => ({
          user_id: user.id,
          question_id: q.id,
          is_correct: finalAnswers[idx] === q.correct_index,
          selected_index: finalAnswers[idx] ?? null,
        }))
      : [];

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      queuePendingSubmission({
        id: `${user.id}_${Date.now()}`,
        userId: user.id,
        sessionId: sessionId || undefined,
        isQotd: !!isQotd,
        topic: topicLabel,
        result: !isQotd ? result : undefined,
        attempts: !isQotd && !isDemo ? attempts : undefined,
        qotdAttempt: isQotd ? {
          user_id: user.id,
          question_id: questions[0].id,
          is_correct: finalAnswers[0] === questions[0].correct_index,
          selected_index: finalAnswers[0] ?? null,
          is_qotd: true
        } : undefined,
        submittedAt: new Date().toISOString(),
      });

      clearOfflineSession(sessionId || topicLabel);
      setResultData({ ...result, missedQuestions, questions });
      setIsSubmittedOffline(true);
      setShowResults(true);
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    try {
      // Check if this is an early completion (the block's deadline hasn't passed yet)
      if (timingStatus === 'Late' && quizId) {
        const { data: bSched } = await supabase
          .from('block_schedule')
          .select('start_date, end_date')
          .eq('block_id', quizId)
          .maybeSingle();
        
        if (bSched) {
          const now = new Date();
          // Format current time in Eastern Time as YYYY-MM-DD
          const estFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const todayEstStr = estFormatter.format(now);
          
          if (todayEstStr < bSched.start_date) {
            points = 2;
            result.academic_points = 2;
            result.timing_status = 'Early';
          } else if (todayEstStr <= bSched.end_date) {
            points = 2;
            result.academic_points = 2;
            result.timing_status = 'On Time';
          }
        }
      }

      if (!isQotd) {
        if (!resultSavedRef.current) {
          await withTimeout(supabase.from('results').insert(result), 10000);
          resultSavedRef.current = true;
          if (isDemo) {
            try {
              localStorage.setItem(`fmc_demo_completed_${user.id}`, 'true');
            } catch {}
          }
        }

        if (!isDemo && !attemptsSavedRef.current) {
          await withTimeout(supabase.from('question_attempts').insert(attempts), 10000);
          attemptsSavedRef.current = true;
        }
      } else if (isQotd) {
        // For QOTD, only save the attempt, not a full block result
        if (!attemptsSavedRef.current) {
          await withTimeout(supabase.from('question_attempts').insert({
            user_id: user.id,
            question_id: questions[0].id,
            is_correct: finalAnswers[0] === questions[0].correct_index,
            selected_index: finalAnswers[0] ?? null,
            is_qotd: true
          }), 30000);
          attemptsSavedRef.current = true;
        }
      }

      // Process Gamification (Streaks & Badges) — best-effort and detached so it
      // never blocks the results screen. Bounded by withTimeout so a hung query
      // can't leave a dangling promise, and .catch swallows any failure.
      withTimeout(
        processGamification(
          user.id,
          !!isQotd,
          finalAnswers[0] === questions[0].correct_index,
          questions[0].id,
          questions.length,
          result.percentage,
          timingStatus ?? undefined,
          topicLabel,
          currentBlock?.end_date ?? undefined
        ),
        30000
      )
      .then((res: any) => {
         if (res && res.newlyEarnedBadges && res.newlyEarnedBadges.length > 0) {
           setNewBadgesEarned(true);
           try {
             // Store in localStorage for Dashboard to pick up and display modal
             localStorage.setItem('recent_badges', JSON.stringify(res.newlyEarnedBadges));
           } catch (e) {
             console.warn('Failed to save recent badges to local storage:', e);
           }
         }
      })
      .catch((e) => console.warn('Gamification processing skipped:', e));

      if (sessionId) {
        await withTimeout(supabase.from('quiz_sessions').update({ is_completed: true }).eq('id', sessionId), 30000);
      }

      if (isQotd) {
        // For QOTD, fetch existing reactions to show aggregates
        const { data } = await withTimeout(supabase.from('qotd_reactions')
          .select('reaction, user_id')
          .eq('question_id', questions[0].id)
          .eq('date', getTodayDateString()), 30000);
        
        if (data) {
          const aggs: Record<string, number> = { '🤯': 0, '🤨': 0, '👍': 0, '🥱': 0, '😴': 0 };
          data.forEach((r: any) => { 
            if (aggs[r.reaction] !== undefined) aggs[r.reaction]++; 
            if (r.user_id === user.id) setQotdReaction(r.reaction);
          });
          setQotdAggregates(aggs);
        }

        const { data: attemptsData } = await withTimeout(
          supabase.rpc('get_qotd_cohort_stats', { p_question_ids: [questions[0].id] }), 
          30000
        ).catch(() => ({ data: null })) as any;
          
        if (attemptsData && attemptsData.length > 0) {
          const correct = Number(attemptsData[0].correct) || 0;
          const incorrect = Number(attemptsData[0].incorrect) || 0;
          setQotdStats({ correct, incorrect, total: correct + incorrect });
        }

        fetchPeerComparison(questions[0].id);
      }

      clearOfflineSession(sessionId || topicLabel);
      setResultData({ ...result, missedQuestions, questions });
      setShowResults(true);
    } catch (err: any) {
      console.warn('Submit Quiz cloud write failed; falling back to offline queue:', err);
      try {
        queuePendingSubmission({
          id: `${user.id}_${Date.now()}`,
          userId: user.id,
          sessionId: sessionId || undefined,
          isQotd: !!isQotd,
          topic: topicLabel,
          result: !isQotd ? result : undefined,
          attempts: !isQotd && !isDemo ? attempts : undefined,
          qotdAttempt: isQotd ? {
            user_id: user.id,
            question_id: questions[0].id,
            is_correct: finalAnswers[0] === questions[0].correct_index,
            selected_index: finalAnswers[0] ?? null,
            is_qotd: true
          } : undefined,
          submittedAt: new Date().toISOString(),
        });
        clearOfflineSession(sessionId || topicLabel);
        setResultData({ ...result, missedQuestions, questions });
        setIsSubmittedOffline(true);
        setShowResults(true);
      } catch (fallbackErr) {
        console.error('Offline queue fallback failed:', fallbackErr);
        alert('Network error saving your block. Please try clicking Finish again. Error: ' + (err?.message || err?.toString() || 'Unknown Error'));
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleFinish = () => submitQuiz(false);

  const submitQuizRef = useRef(submitQuiz);
  submitQuizRef.current = submitQuiz;
  const handleFinishRef = useRef(handleFinish);
  handleFinishRef.current = handleFinish;

  // Flush latest state to quiz_sessions BEFORE leaving — the 3s debounce sync
  // gets cancelled on unmount, so without this the user's last few actions
  // (answer changes, navigation) silently disappear if they exit quickly.
  const handleResumeLater = async () => {
    if (resumingLater) return;
    setResumingLater(true);

    // Always mirror to offline backup first
    saveOfflineSession(sessionId || topic || 'active_quiz', {
      sessionId: sessionId || undefined,
      topic,
      currentIndex,
      answers,
      timeLeft,
      lastUpdated: new Date().toISOString(),
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      onCancel();
      return;
    }

    try {
      if (sessionId) {
        await withTimeout(
          supabase
            .from('quiz_sessions')
            .update({
              current_index: currentIndex,
              answers,
              time_left: timeLeft,
              last_updated: new Date().toISOString(),
            })
            .eq('id', sessionId),
          4000
        );
      }
    } catch (err) {
      console.warn('Resume Later cloud save warning (answers preserved locally):', err);
    }
    onCancel();
  };

  // Reconnection listener: automatically sync pending submissions when back online
  useEffect(() => {
    const handleOnline = () => {
      flushPendingSubmissions(supabase).then(({ synced }) => {
        if (synced > 0) {
          console.log(`[QuizEngine] Synced ${synced} pending submission(s) on reconnection.`);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  // Global Desktop Keyboard Navigation
  useEffect(() => {
    // Only listen when actively in a quiz (not loading, not results screen, not pre-start)
    if (loading || error || showResults || (!started && !isQotd && !((topic || '').toLowerCase().includes('demo')))) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Modifier keys (Ctrl, Alt, Meta) - don't intercept browser shortcuts like Ctrl+R
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toUpperCase();

      // Navigation: Left / P
      if (e.key === 'ArrowLeft' || key === 'P') {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(0, prev - 1));
        return;
      }

      // Navigation: Right / N
      if (e.key === 'ArrowRight' || key === 'N') {
        e.preventDefault();
        const isLast = currentIndex === questions.length - 1;
        if (!isLast) {
          setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
        }
        return;
      }

      // Options: A / 1 -> 0, B / 2 -> 1, C / 3 -> 2, D / 4 -> 3, E / 5 -> 4
      const keyToOptionMap: Record<string, number> = {
        'A': 0, '1': 0,
        'B': 1, '2': 1,
        'C': 2, '3': 2,
        'D': 3, '4': 3,
        'E': 4, '5': 4,
      };

      if (key in keyToOptionMap) {
        const optionIdx = keyToOptionMap[key];
        const numOptions = currentQuestion?.options?.length || 0;
        if (optionIdx < numOptions) {
          e.preventDefault();
          // Check if struck out
          const struckSet = new Set(questionTools[currentQuestion?.id]?.strikethroughs || EMPTY_ARRAY);
          if (!struckSet.has(optionIdx)) {
            handleSelectOption(optionIdx);
          }
        }
        return;
      }

      // Enter key: Submit in practice mode if staged, or next question if answered
      if (e.key === 'Enter') {
        const hasAnswered = answers[currentIndex] !== undefined;
        const hasStaged = stagedAnswers[currentIndex] !== undefined;
        const needsSubmit = (mode === 'practice' || isQotd) && !hasAnswered;

        if (needsSubmit && hasStaged && !submitting) {
          e.preventDefault();
          const newAnswers = { ...answers, [currentIndex]: stagedAnswers[currentIndex] };
          setAnswers(newAnswers);
          if (isQotd) {
            submitQuizRef.current(true, newAnswers);
          }
        } else if (!needsSubmit) {
          e.preventDefault();
          const isLast = currentIndex === questions.length - 1;
          if (isLast && !submitting) {
            handleFinishRef.current();
          } else if (!isLast) {
            setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
          }
        }
        return;
      }

      // Shortcuts Modal Toggle: '?'
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    loading,
    error,
    showResults,
    started,
    isQotd,
    topic,
    currentIndex,
    questions.length,
    currentQuestion,
    questionTools,
    handleSelectOption,
    answers,
    stagedAnswers,
    mode,
    submitting,
  ]);

  // RESULTS SCREEN
  if (showResults && resultData) {
    const { score, total, percentage, academic_points, timing_status, missedQuestions } = resultData;
    const passed = percentage >= 70;

    const handleReaction = async (emoji: string) => {
      const previousReaction = qotdReaction;
      if (previousReaction === emoji) return; // Already reacted with this emoji

      // Optimistic UI update
      setQotdReaction(emoji);
      if (qotdAggregates) {
        setQotdAggregates(prev => {
          if (!prev) return null;
          const next = { ...prev };
          if (previousReaction && next[previousReaction] > 0) {
            next[previousReaction]--;
          }
          next[emoji] = (next[emoji] || 0) + 1;
          return next;
        });
      }
      
      try {
        // Save reaction (upsert to prevent duplicates and allow vote changes)
        const { error } = await supabase.from('qotd_reactions').upsert({
          user_id: user.id,
          question_id: questions[0].id,
          date: getTodayDateString(),
          reaction: emoji
        }, { onConflict: 'user_id, question_id, date' });

        if (error) throw error;
      } catch (err) {
        console.error('Error saving reaction:', err);
        // Revert optimistic update
        setQotdReaction(previousReaction);
        if (qotdAggregates) {
          setQotdAggregates(prev => {
            if (!prev) return null;
            const reverted = { ...prev };
            reverted[emoji] = Math.max(0, (reverted[emoji] || 0) - 1);
            if (previousReaction) {
              reverted[previousReaction] = (reverted[previousReaction] || 0) + 1;
            }
            return reverted;
          });
        }
      }
    };

    if (isQotd && !isPastNoon()) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center space-y-8 animate-in fade-in zoom-in duration-300 transition-colors">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Save className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Answer Recorded!</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg leading-relaxed">
                The correct answer, explanation, and cohort statistics will be revealed at <strong>12:30 PM EST</strong>.
              </p>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-4 md:p-6 border border-slate-100 dark:border-slate-700/60">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">How did you feel about this question?</h3>
              <div className="flex justify-center gap-2 sm:gap-4">
                {[
                  { e: '🤯', l: 'Hard' },
                  { e: '🤨', l: 'Tricky' },
                  { e: '👍', l: 'Fair' },
                  { e: '🥱', l: 'Easy' },
                  { e: '😴', l: 'Too Easy' }
                ].map(({ e, l }) => (
                  <button
                    key={e}
                    onClick={() => handleReaction(e)}
                    disabled={!!qotdReaction}
                    className={`flex flex-col items-center gap-2 p-2 sm:p-3 rounded-2xl transition-all ${qotdReaction === e ? 'bg-indigo-100 dark:bg-indigo-900/60 scale-110 shadow-lg' : qotdReaction ? 'opacity-30 grayscale' : 'hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105 active:scale-95'}`}
                  >
                    <span className="text-3xl">{e}</span>
                    <span className={`text-xs font-bold ${qotdReaction === e ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>{l}</span>
                  </button>
                ))}
              </div>
              {qotdReaction && (
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-6 animate-fade-in">
                  Thanks for voting! Check back at 12:30 PM to see how everyone else did.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowResults(false)}
              className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 rounded-2xl font-black text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm mb-3"
            >
              Review Question
            </button>
            <button
              onClick={() => onComplete(resultData)}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 dark:shadow-none"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-800 dark:text-slate-100 transition-colors">
        <div className="max-w-3xl mx-auto pt-12 px-4 space-y-8 relative">
          {/* Navigator Sidebar */}
          {!isQotd && questions.length > 1 && (
            <div className="hidden xl:block absolute top-12 right-[100%] mr-8 w-[280px]">
              <div className="sticky top-32">
                <QuestionNavigator
                  totalQuestions={questions.length}
                  currentIndex={-1}
                  answers={answers}
                  stagedAnswers={{}}
                  viewedQuestions={new Set()}
                  reviewMode={true}
                  questions={questions}
                  onSelect={(idx) => {
                    const isCorrect = answers[idx] === questions[idx].correct_index;
                    if (isCorrect && !showAllReview) {
                      setShowAllReview(true);
                    }
                    setTimeout(() => {
                      const el = document.getElementById(`review-question-${idx}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                />
              </div>
            </div>
          )}

          {/* QOTD Tab Bar */}
          {isQotd && (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-1 shadow-sm">
                <button
                  onClick={() => setQotdTab('today')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                    qotdTab === 'today'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  QOTD
                </button>
                <button
                  onClick={() => setQotdTab('history')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                    qotdTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Past QOTDs
                </button>
              </div>
              <button
                onClick={() => onComplete(resultData)}
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-all shadow-sm"
                title="Return to Dashboard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Past QOTDs Tab */}
          {isQotd && qotdTab === 'history' ? (
            <>
              <QotdHistory onBack={() => setQotdTab('today')} />
              <button
                onClick={() => onComplete(resultData)}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 dark:shadow-none"
              >
                Back to Dashboard
              </button>
            </>
          ) : (
          <>
          {/* Offline Saved Banner */}
          {isSubmittedOffline && (
            <div className="rounded-3xl p-5 bg-amber-500/15 dark:bg-amber-500/25 border border-amber-400/40 text-amber-900 dark:text-amber-100 flex items-center gap-4 shadow-sm">
              <span className="text-3xl shrink-0">⚡</span>
              <div>
                <div className="font-bold text-base">Completed in Offline Mode</div>
                <div className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                  Your quiz results and answers have been safely saved to your device. They will automatically sync to your program record as soon as your connection is restored.
                </div>
              </div>
            </div>
          )}

          {/* Score Hero */}
          {isQotd ? (
            <div className={`rounded-[32px] p-6 md:p-8 text-center text-white ${qotdAttempt?.is_skipped ? 'bg-slate-400' : score === 1 ? 'bg-emerald-600' : 'bg-red-500'}`}>
              <div className="text-4xl md:text-5xl font-black mb-2">
                {qotdAttempt?.is_skipped ? 'Skipped' : score === 1 ? 'Correct' : 'Incorrect'}
              </div>
              {qotdStats && qotdStats.total > 0 && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="text-xs font-bold opacity-80 uppercase tracking-widest">Cohort Performance</div>
                  <div className="flex items-center justify-center gap-3 w-full max-w-sm">
                    <div className="text-lg font-black w-10 text-right">{Math.round((qotdStats.correct / qotdStats.total) * 100)}%</div>
                    <div className="flex-1 h-2.5 bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all" style={{ width: `${Math.round((qotdStats.correct / qotdStats.total) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold opacity-90">
                    Cohort Accuracy: {Math.round((qotdStats.correct / qotdStats.total) * 100)}% ({qotdStats.correct} of {qotdStats.total} correct · n = {qotdStats.total} responders)
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-[40px] p-10 text-center text-white ${passed ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              <div className="text-6xl font-black mb-2">{percentage.toFixed(1)}%</div>
              <div className="text-lg font-bold opacity-80">{score} / {total} correct</div>
              {(academic_points > 0 || timing_status) && (
                <div className="mt-6 flex justify-center gap-8">
                  {academic_points > 0 && (
                    <div>
                      <div className="text-2xl font-black">{academic_points}</div>
                      <div className="text-xs font-black uppercase tracking-widest opacity-70">Academic Points</div>
                    </div>
                  )}
                  {timing_status && (
                    <div className="flex flex-col items-center">
                      <div className="text-3xl mb-1">
                        {timing_status === 'Early' ? '🚀' : timing_status === 'On Time' ? '✅' : timing_status === 'Late' ? '⏰' : '—'}
                      </div>
                      <div className="text-xs font-black uppercase tracking-widest opacity-70">{timing_status}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Anonymous Peer Distractor Breakdown & Benchmark for QOTD */}
          {isQotd && qotdComparison && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              {/* Question Distractor Distribution */}
              {qotdComparison.questionStats && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <span>📊</span> Anonymous Peer Answer Distribution
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        How your co-residents voted on this question (n = {qotdComparison.questionStats.totalResponders} responders)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {questions[0]?.options?.map((opt: string, optIdx: number) => {
                      const dist = qotdComparison.questionStats?.optionCounts[optIdx] || { count: 0, pct: 0 };
                      const isSelected = answers[0] === optIdx;
                      const isCorrectOpt = optIdx === questions[0].correct_index;

                      return (
                        <div
                          key={optIdx}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCorrectOpt
                              ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                              : isSelected
                              ? 'border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
                              : 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                  isCorrectOpt
                                    ? 'bg-emerald-600 text-white'
                                    : isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                {opt}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isCorrectOpt && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                  ✓ Correct
                                </span>
                              )}
                              {isSelected && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                  Your Choice
                                </span>
                              )}
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                {dist.pct}% <span className="text-[10px] text-slate-400 font-bold">(n = {dist.count})</span>
                              </span>
                            </div>
                          </div>

                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isCorrectOpt
                                  ? 'bg-emerald-500'
                                  : isSelected
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400 dark:bg-slate-500'
                              }`}
                              style={{ width: `${dist.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cumulative Standing vs Anonymous Peers */}
              {qotdComparison.programStats && qotdComparison.personalStats && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                    Your Cumulative Standing vs. Anonymous Peers
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Accuracy Benchmark */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Accuracy Benchmark
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {qotdComparison.personalStats.accuracyPct}%
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                        Program Avg: {qotdComparison.programStats.programAccuracyPct}%
                        <span className="block text-[10px] text-slate-400">
                          (n = {qotdComparison.programStats.totalProgramParticipants} residents)
                        </span>
                      </p>
                    </div>

                    {/* Active Streak */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Active Streak
                      </div>
                      <div className="text-2xl font-black text-amber-500">
                        🔥 {qotdComparison.personalStats.currentStreak}d
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                        Median: {qotdComparison.programStats.medianStreak}d
                        <span className="block text-[10px] text-slate-400">
                          Best: {qotdComparison.personalStats.maxStreak}d
                        </span>
                      </p>
                    </div>

                    {/* Total Questions */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Total Answered
                      </div>
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {qotdComparison.personalStats.totalAttempts}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                        {qotdComparison.personalStats.correctCount} correct
                        <span className="block text-[10px] text-slate-400">Lifetime QOTDs</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QOTD: the correct answer + explanation, revealed after the deadline.
              Shown whether they got it right or wrong (the old "Missed Questions"
              card only appeared on a wrong answer, so a correct QOTD showed nothing). */}
          {/* QOTD: the correct answer + explanation, revealed after the deadline. */}
          {isQotd && questions[0] && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">
                Correct Answer &amp; Explanation
              </h3>
              <QuizReview items={[{ question: questions[0], selected: answers[0] }]} />
            </div>
          )}

          {/* Review Section */}
          {!isQotd && (
            <div>
              <div className="mb-4 ml-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Review Questions &amp; Explanations
                </h3>
              </div>
              <QuizReview items={
                questions.map((q: any, idx: number) => ({
                  question: q,
                  selected: answers[idx]
                }))
              } />
            </div>
          )}

          {/* QOTD Noon Conference & Social Stats */}
          {isQotd && (
            <div className="space-y-6">
              {/* Noon Conference Box */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-1 rounded-3xl shadow-lg">
                <div className="bg-white dark:bg-slate-900 rounded-[20px] p-6 text-center transition-colors">
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Noon Conference Reminder</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                    We will discuss this question and its learning points at today's Noon Conference! Be ready to share your thoughts.
                  </p>
                </div>
              </div>

              {/* Social Aggregates */}
              {qotdAggregates && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Co-Residents' Reactions</h3>
                  <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-8">
                    {[
                      { e: '🤯', l: 'Hard' },
                      { e: '🤨', l: 'Tricky' },
                      { e: '👍', l: 'Fair' },
                      { e: '🥱', l: 'Easy' },
                      { e: '😴', l: 'Too Easy' }
                    ].map(({ e, l }) => (
                      <button 
                        key={e} 
                        onClick={() => handleReaction(e)}
                        className={`flex flex-col items-center gap-2 transition-all p-2 rounded-xl ${qotdReaction === e ? 'bg-indigo-50 dark:bg-indigo-950/60 scale-110' : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 active:scale-95'}`}
                      >
                        <span className="text-3xl md:text-4xl">{e}</span>
                        <span className={`text-xl font-black ${qotdReaction === e ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>{qotdAggregates[e] || 0}</span>
                        <span className={`text-xs font-bold uppercase tracking-widest ${qotdReaction === e ? 'text-indigo-400 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2">
            {!isQotd && missedQuestions && missedQuestions.length > 0 && (
              <button
                onClick={handleRetakeMissed}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Practice {missedQuestions.length} Missed Question{missedQuestions.length !== 1 ? 's' : ''}
              </button>
            )}

            <button
              onClick={() => onComplete(resultData)}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 dark:shadow-none"
            >
              Back to Dashboard
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  if (loading || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-sm w-full text-center space-y-6 transition-colors">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 text-red-500 dark:text-red-400 rounded-[24px] flex items-center justify-center mx-auto">
                <X className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Block Error</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-bold">{error}</p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Assembling Block</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 uppercase tracking-widest font-black opacity-60">Loading Questions...</p>
              </div>
            </>
          )}
          <button onClick={onCancel} className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-slate-200 dark:shadow-none">
            Exit to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const isTimeLow = timeLeft > 0 && timeLeft < 300;

  // Pre-start screen: choose Practice vs Quiz before a non-QOTD, non-demo quiz begins.
  if (!isQotd && !((topic || '').toLowerCase().includes('demo')) && !started && currentQuestion) {
    const hasProgress = sessionId !== null && answeredCount > 0;

    if (showAbandonConfirm) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-md w-full space-y-6 animate-fade-in text-center transition-colors">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Abandon Quiz?</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              By abandoning this quiz you will lose progress and it will not count towards streaks or achievements.
            </p>
            <div className="space-y-3 pt-4">
              <button
                onClick={async () => {
                  if (sessionId) {
                    const { error } = await supabase.from('quiz_sessions').delete().eq('id', sessionId);
                    if (error) {
                      console.error("Failed to delete session:", error);
                      alert("Failed to abandon quiz: " + error.message);
                    } else {
                      queryClient.setQueriesData({ queryKey: ['dashboard'] }, (old: any) => {
                        if (!old) return old;
                        return {
                          ...old,
                          activeSessions: old.activeSessions?.filter((s: any) => s.id !== sessionId)
                        };
                      });
                      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                    }
                  }
                  onCancel();
                }}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-lg hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
              >
                Yes, Abandon Quiz
              </button>
              <button
                onClick={() => setShowAbandonConfirm(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-md w-full space-y-6 animate-fade-in transition-colors">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">{topic || 'Quiz'}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{questions.length} question{questions.length === 1 ? '' : 's'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Choose mode</p>
            <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
              <button
                onClick={() => setMode('practice')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'practice' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Practice
              </button>
              <button
                onClick={() => setMode('quiz')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'quiz' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Quiz
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center leading-relaxed">
              {mode === 'practice'
                ? 'The correct answer and explanation appear right after each question.'
                : 'Answers stay hidden until you finish — then you get a full review.'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Exam Timer
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enable 90-second countdown per question</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isTimed} onChange={() => setIsTimed(!isTimed)} />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl dark:shadow-none"
          >
            {hasProgress ? 'Resume' : 'Start'}
          </button>
          <div className="space-y-2 pt-2">
            <button
              onClick={onCancel}
              className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
            {hasProgress && (
              <button
                onClick={() => setShowAbandonConfirm(true)}
                className="w-full py-2 text-red-400 font-bold text-sm hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all"
              >
                Abandon Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-4 transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleResumeLater}
              disabled={resumingLater}
              className="p-2 text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg disabled:opacity-50"
              title="Save progress and return to dashboard"
            >
              {resumingLater ? <Loader2 className="w-6 h-6 animate-spin pointer-events-none" /> : <ChevronLeft className="w-6 h-6 pointer-events-none" />}
            </button>
            <div>
              <h2 className="font-black text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[200px] md:max-w-none">{topic || 'FMC Board Review'}</h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                {isTimed && (
                  <>
                    <Clock className={`w-3 h-3 ${reviewingExplanation ? 'text-amber-500' : isTimeLow ? 'text-red-500' : ''}`} />
                    <span
                      className={reviewingExplanation ? 'text-amber-600 dark:text-amber-400 font-black' : isTimeLow ? 'text-red-500 font-black' : ''}
                      role="timer"
                      aria-live="polite"
                      aria-label={reviewingExplanation ? `Timer paused while reviewing — ${formatTime(timeLeft)} remaining` : `${formatTime(timeLeft)} remaining`}
                    >
                      {formatTime(timeLeft)}{reviewingExplanation ? ' (paused)' : ''}
                    </span>
                    <span className="opacity-30">·</span>
                  </>
                )}
                {isQotd || questions.length <= 1 ? (
                  <span>Q {currentIndex + 1} / {questions.length}</span>
                ) : (
                  <button 
                    onClick={() => setShowNavigator(prev => !prev)}
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 font-bold xl:pointer-events-none"
                    title="Show question navigator"
                  >
                    <span>Q {currentIndex + 1} / {questions.length}</span>
                    <svg className={`w-3 h-3 xl:hidden transition-transform ${showNavigator ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                )}
                <span className="opacity-30">·</span>
                <span>{answeredCount} answered</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Text-resize toolbar (A- / A+) */}
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mr-1" title="Adjust text size">
              <button
                onClick={decreaseFont}
                disabled={fontIndex === 0}
                className="px-2 py-1 text-xs font-black text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease text size"
                title="Smaller text"
              >
                A-
              </button>
              <span className="px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{fontSize}</span>
              <button
                onClick={increaseFont}
                disabled={fontIndex === FONT_SIZES.length - 1}
                className="px-2 py-1 text-base font-black text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase text size"
                title="Larger text"
              >
                A+
              </button>
            </div>

            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              title="Keyboard Shortcuts (?)"
            >
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-mono shadow-2xs text-slate-700 dark:text-slate-300">⌨️ Shortcuts</kbd>
            </button>


            <button
              onClick={handleResumeLater}
              disabled={resumingLater}
              className="ml-4 px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-60 flex items-center gap-2"
              title="Save progress and return to dashboard"
            >
              {resumingLater ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Resume Later'}
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        
        {showNavigator && !isQotd && questions.length > 1 && (
          <div className="xl:hidden max-w-5xl mx-auto mt-4 relative animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 left-0 w-full z-50 md:w-[600px]">
              <QuestionNavigator
                totalQuestions={questions.length}
                currentIndex={currentIndex}
                answers={answers}
                stagedAnswers={stagedAnswers}
                viewedQuestions={viewedQuestions}
                onSelect={(idx) => {
                  setCurrentIndex(idx);
                }}
                onClose={() => setShowNavigator(false)}
              />
            </div>
          </div>
        )}
      </div>

      {showNavigator && !isQotd && questions.length > 1 && (
        <div 
          className="xl:hidden fixed inset-0 z-0 bg-slate-900/10 backdrop-blur-sm" 
          onClick={() => setShowNavigator(false)} 
        />
      )}

      <main className="max-w-3xl mx-auto pt-4 md:pt-6 px-4 relative">
        {!isQotd && questions.length > 1 && (
          <div className="hidden xl:block absolute top-4 md:top-6 right-[100%] mr-8 w-[280px]">
            <div className="sticky top-32">
              <QuestionNavigator
                totalQuestions={questions.length}
                currentIndex={currentIndex}
                answers={answers}
                stagedAnswers={stagedAnswers}
                viewedQuestions={viewedQuestions}
                onSelect={(idx) => setCurrentIndex(idx)}
              />
            </div>
          </div>
        )}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            userAnswer={answers[currentIndex] ?? stagedAnswers[currentIndex]}
            onSelectOption={handleSelectOption}
            showExplanation={!isQotd && mode === 'practice' && answers[currentIndex] !== undefined}
            fontSize={fontSize}
            initialHighlights={questionTools[currentQuestion.id]?.highlights || EMPTY_ARRAY}
            initialStrikethroughs={questionTools[currentQuestion.id]?.strikethroughs || EMPTY_ARRAY}
            onToolsChange={handleToolsChange}
            userEmail={user?.email}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 p-4 pb-8 md:pb-4 shadow-2xl z-20 transition-colors">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex-1 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 pointer-events-none" />
            Prev
          </button>

          {/* Next Unanswered Jump Button */}
          {(() => {
            if (isQotd || questions.length <= 1) return null;
            const unanswered = questions.filter((_, idx) => answers[idx] === undefined && stagedAnswers[idx] === undefined).length;
            if (unanswered === 0) return null;

            let nextUnansweredIndex = -1;
            for (let i = 1; i < questions.length; i++) {
              const candidate = (currentIndex + i) % questions.length;
              if (answers[candidate] === undefined && stagedAnswers[candidate] === undefined) {
                nextUnansweredIndex = candidate;
                break;
              }
            }

            if (nextUnansweredIndex === -1) return null;

            return (
              <button
                type="button"
                onClick={() => setCurrentIndex(nextUnansweredIndex)}
                className="px-3.5 py-4 bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-slate-700 font-black rounded-2xl text-xs sm:text-sm transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                title={`Jump to next unanswered question (${unanswered} remaining)`}
              >
                <span>Unanswered</span>
                <span className="bg-blue-200/80 dark:bg-slate-700 text-blue-800 dark:text-blue-200 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                  {unanswered}
                </span>
              </button>
            );
          })()}
          {(() => {
            const isLast = currentIndex === questions.length - 1;
            const hasAnswered = answers[currentIndex] !== undefined;
            const hasStaged = stagedAnswers[currentIndex] !== undefined;
            const needsSubmit = (mode === 'practice' || isQotd) && !hasAnswered;

            if (needsSubmit) {
              return (
                <button
                  onClick={() => {
                    const newAnswers = { ...answers, [currentIndex]: stagedAnswers[currentIndex] };
                    setAnswers(newAnswers);
                    if (isQotd) {
                      submitQuiz(true, newAnswers);
                    }
                  }}
                  disabled={!hasStaged || submitting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-blue-200 cursor-pointer animate-in fade-in active:scale-95"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin pointer-events-none" /> : (
                    <>Submit Answer <CheckCircle className="w-5 h-5 pointer-events-none" /></>
                  )}
                </button>
              );
            }

            return (
              <button
                onClick={isLast ? handleFinish : () => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={isLast && submitting}
                className={`flex-1 py-4 text-white rounded-2xl font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl cursor-pointer animate-in fade-in active:scale-95 ${isLast ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'}`}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin pointer-events-none" /> : (
                  <>{isLast ? (isQotd ? 'Close' : 'Finish Block') : 'Next Question'} <ChevronRight className="w-5 h-5 pointer-events-none" /></>
                )}
              </button>
            );
          })()}
        </div>
      </nav>
      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⌨️</span>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Select Options A – E</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">A – E</kbd>
                  <span className="text-slate-300 dark:text-slate-500 text-xs font-bold">or</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">1 – 5</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Previous / Next Question</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">← / P</kbd>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">→ / N</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Submit / Next Question</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Toggle Shortcuts Help</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300">?</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-all shadow-md dark:shadow-none"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



