'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { TrendingUp, Users, Target, AlertCircle, Loader2 } from './AppIcons';

export default function AdminPerformance() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      // 1. Fetch all results
      const { data: results, error } = await supabase
        .from('results')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching results:', error);
        return;
      }

      // 2. Process for Trends (by Date)
      const dailyAverages = results.reduce((acc: any, curr) => {
        const date = new Date(curr.created_at).toLocaleDateString();
        if (!acc[date]) acc[date] = { date, total: 0, count: 0 };
        acc[date].total += curr.percentage;
        acc[date].count += 1;
        return acc;
      }, {});

      setData(Object.values(dailyAverages).map((d: any) => ({
        name: d.date,
        avg: Math.round(d.total / d.count)
      })));

      // 3. Process for Categories
      const catStats = results.reduce((acc: any, curr) => {
        const cat = curr.topic || 'General';
        if (!acc[cat]) acc[cat] = { name: cat, total: 0, count: 0 };
        acc[cat].total += curr.percentage;
        acc[cat].count += 1;
        return acc;
      }, {});

      setCategoryData(Object.values(catStats).map((c: any) => ({
        name: c.name,
        avg: Math.round(c.total / c.count)
      })));

      setLoading(false);
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Program Average" 
          value="82.4%" 
          trend="+1.2%" 
          icon={<Target className="w-5 h-5" />} 
          color="blue"
        />
        <StatCard 
          title="Active Residents" 
          value="34" 
          trend="100%" 
          icon={<Users className="w-5 h-5" />} 
          color="emerald"
        />
        <StatCard 
          title="Quizzes Completed" 
          value="156" 
          trend="+24" 
          icon={<TrendingUp className="w-5 h-5" />} 
          color="purple"
        />
        <StatCard 
          title="At Risk" 
          value="3" 
          trend="-1" 
          icon={<AlertCircle className="w-5 h-5" />} 
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Over Time */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Class Progression</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Average Score %</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800}}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg" 
                  stroke="#2563eb" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Knowledge Gaps</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Avg % by Category</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11, fontWeight: 800}}
                  width={120}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800}}
                />
                <Bar dataKey="avg" radius={[0, 8, 8, 0]} barSize={24}>
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.avg > 75 ? '#10b981' : entry.avg > 60 ? '#3b82f6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">{title}</h3>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-black text-slate-800 tracking-tighter">{value}</div>
        <div className={`text-xs font-black px-2 py-1 rounded-lg ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trend}
        </div>
      </div>
    </div>
  );
}
