'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdminData } from '@/lib/types';
import { isActiveResident } from '@/lib/academicYear';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, AlertCircle, TrendingDown } from './AppIcons';

interface QuestionHeatmapProps {
  adminData: AdminData;
}

export default function QuestionHeatmap({ adminData }: QuestionHeatmapProps) {
  // Fetch all question attempts
  const { data: attempts = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'question_attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_attempts')
        .select('user_id, question_id, is_correct, created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const analytics = useMemo(() => {
    if (!adminData || attempts.length === 0) return null;

    // 1. Build a set of active resident user_ids
    const activeEmails = new Set(
      adminData.roster.filter(isActiveResident).map((r) => r.email?.toLowerCase())
    );
    const activeUserIds = new Set(
      adminData.profiles
        .filter((p) => activeEmails.has((p.email || '')?.toLowerCase()))
        .map((p) => p.id)
    );

    // 2. Filter attempts to active residents only
    const validAttempts = attempts.filter((a) => activeUserIds.has(a.user_id));

    // 3. Aggregate by Question
    const questionStats = new Map<string, { total: number; wrong: number }>();
    validAttempts.forEach((a) => {
      const current = questionStats.get(a.question_id) || { total: 0, wrong: 0 };
      current.total += 1;
      if (!a.is_correct) current.wrong += 1;
      questionStats.set(a.question_id, current);
    });

    // 4. Map back to question text/category
    const questionMap = new Map(adminData.questions.map((q) => [q.id, q]));

    const enrichedQuestions = Array.from(questionStats.entries())
      .map(([id, stats]) => {
        const q = questionMap.get(id);
        const wrongPct = stats.total > 0 ? (stats.wrong / stats.total) * 100 : 0;
        return {
          id,
          text: q?.question_text || 'Unknown Question',
          category: q?.category || 'Unknown Category',
          total: stats.total,
          wrong: stats.wrong,
          wrongPct,
          options: q?.options || [],
          correct_index: q?.correct_index ?? -1,
        };
      })
      .filter((q) => q.total >= 3) // Need at least 3 attempts to be statistically interesting
      .sort((a, b) => b.wrongPct - a.wrongPct);

    // 5. Aggregate by Category
    const categoryStats = new Map<string, { total: number; wrong: number }>();
    enrichedQuestions.forEach((q) => {
      const current = categoryStats.get(q.category) || { total: 0, wrong: 0 };
      current.total += q.total;
      current.wrong += q.wrong;
      categoryStats.set(q.category, current);
    });

    const categoryData = Array.from(categoryStats.entries())
      .map(([name, stats]) => ({
        name,
        wrongPct: stats.total > 0 ? (stats.wrong / stats.total) * 100 : 0,
        total: stats.total,
      }))
      .filter((c) => c.total >= 10) // Filter out noise
      .sort((a, b) => b.wrongPct - a.wrongPct)
      .slice(0, 10); // Top 10 worst categories

    return { questions: enrichedQuestions.slice(0, 20), categories: categoryData };
  }, [adminData, attempts]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="font-bold text-sm">Crunching analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <p className="font-bold text-sm">Failed to load analytics data.</p>
      </div>
    );
  }

  if (!analytics || analytics.questions.length === 0) {
    return (
      <div className="text-center py-20">
        <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="font-bold text-slate-500">Not Enough Data</p>
        <p className="text-sm text-slate-400 mt-2">More resident attempts are needed to generate meaningful trends.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Chart */}
      {analytics.categories.length > 0 && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
          <div className="mb-6">
            <h3 className="font-black text-slate-800 text-lg">Most Missed Categories</h3>
            <p className="text-sm font-bold text-slate-400">Based on failure rate across active residents (min 10 attempts).</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categories} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} stroke="#94a3b8" fontSize={12} fontWeight={700} />
                <YAxis dataKey="name" type="category" width={150} stroke="#64748b" fontSize={12} fontWeight={700} />
                <RechartsTooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Failure Rate']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                />
                <Bar dataKey="wrongPct" radius={[0, 8, 8, 0]}>
                  {analytics.categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
          <h3 className="font-black text-slate-800 text-lg">Highest Failure Rate Questions</h3>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Questions missed by the majority of the cohort (min 3 attempts).</p>
        </div>
        <div className="divide-y divide-slate-50">
          {analytics.questions.map((q, idx) => (
            <div key={q.id} className="p-6 hover:bg-slate-50/50 transition-colors">
              <div className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-red-50 text-red-600">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {q.category}
                    </span>
                    <span className="text-sm font-bold text-red-500">
                      {q.wrongPct.toFixed(1)}% Failed ({q.wrong} / {q.total} attempts)
                    </span>
                  </div>
                  <p className="font-bold text-slate-700 text-sm leading-relaxed mb-4">{q.text}</p>
                  
                  {/* Options display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options as string[]).map((opt: string, i: number) => {
                      const isCorrect = i === q.correct_index;
                      return (
                        <div key={i} className={`p-3 rounded-xl border text-xs font-bold flex gap-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                          <span className="shrink-0">{String.fromCharCode(65 + i)}.</span>
                          <span className="line-clamp-2">{opt}</span>
                          {isCorrect && <span className="ml-auto shrink-0">✅</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
