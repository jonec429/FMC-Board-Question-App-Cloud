'use client';

import React, { useMemo } from 'react';
import { X, Trophy } from './AppIcons';
import { LeaderboardEntry } from '@/lib/types';
import { formatAcademicYear, getAvailableAcademicYears } from '@/lib/academicYear';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClassYoyModalProps {
  onClose: () => void;
  selectedClass: string;
  leaderboardData: LeaderboardEntry[];
}

export default function ClassYoyModal({ onClose, selectedClass, leaderboardData }: ClassYoyModalProps) {
  const chartData = useMemo(() => {
    const classMembers = leaderboardData.filter(r => r.pgy === selectedClass);
    const yearlyTotals: Record<number, number> = {};
    
    // Initialize available years to 0
    const availableYears = getAvailableAcademicYears().sort((a, b) => a - b);
    availableYears.forEach(year => {
      yearlyTotals[year] = 0;
    });

    classMembers.forEach(m => {
      if (m.yoyStats) {
        Object.entries(m.yoyStats).forEach(([yearStr, points]) => {
          const year = parseInt(yearStr, 10);
          if (availableYears.includes(year)) {
            yearlyTotals[year] = (yearlyTotals[year] || 0) + points;
          }
        });
      }
    });

    return availableYears.map(year => ({
      name: formatAcademicYear(year).replace('AY ', ''), // e.g. "25-26"
      year,
      Points: yearlyTotals[year]
    }));
  }, [selectedClass, leaderboardData]);

  // Aggregate current year's stats to highlight
  const currentTotal = chartData.reduce((sum, d) => sum + d.Points, 0);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-800 truncate">
                {selectedClass.replace('Class of ', 'Class ')}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                Year-Over-Year Points
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl shrink-0 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-3xl font-black text-slate-800">{currentTotal}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Cumulative Points</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 'bold' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 'bold' }}
                />
                <Tooltip 
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#1E293B' }}
                  formatter={(value: number) => [`${value} pts`, 'Points']}
                />
                <Bar 
                  dataKey="Points" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={50}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
