'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChartIcon, Users, Loader2, TrendingUp, Target, Mail } from './AppIcons';

export default function AdminPerformance() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const { data: results, error } = await supabase
          .from('results')
          .select('*, profiles(full_name, pgy)');
        
        if (error) throw error;

        if (results && results.length > 0) {
          const totalScore = results.reduce((acc, r) => acc + (r.score || 0), 0);
          const avgScore = totalScore / results.length;
          const passing = results.filter(r => (r.score || 0) >= 70).length;
          
          setStats({
            average: Math.round(avgScore),
            totalQuizzes: results.length,
            passingRate: Math.round((passing / results.length) * 100),
            recent: results.slice(0, 5)
          });
        } else {
          setStats({ average: 0, totalQuizzes: 0, passingRate: 0, recent: [] });
        }
      } catch (err) {
        console.error('Stats fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aggregating Resident Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-4xl font-black text-slate-800">{stats?.average}%</span>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Average Program Score</span>
        </div>
        
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <Target className="w-6 h-6" />
          </div>
          <span className="text-4xl font-black text-slate-800">{stats?.passingRate}%</span>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Residents Above 70%</span>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6" />
          </div>
          <span className="text-4xl font-black text-slate-800">{stats?.totalQuizzes}</span>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Total Assessments Done</span>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-black text-slate-800">Recent Performance Activity</h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Sync Active</span>
        </div>
        <div className="p-8">
          <div className="space-y-4">
            {stats?.recent.length > 0 ? stats.recent.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400">
                    {r.profiles?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{r.profiles?.full_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.topic} • PGY-{r.profiles?.pgy}</p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full font-black text-sm ${r.score >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {r.score}%
                </div>
              </div>
            )) : (
              <p className="text-center text-slate-400 py-12">No assessment activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
