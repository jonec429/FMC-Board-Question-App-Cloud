import React from 'react';

export default function RiskLegend() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm mb-6">
      <h3 className="font-black text-slate-800 text-lg mb-4">Risk Definitions & Criteria</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Academic Risk */}
        <div>
          <h4 className="font-black tracking-widest uppercase text-xs text-slate-500 mb-3">Academic Risk</h4>
          <p className="text-xs text-slate-400 mb-3 italic">Requires at least 3 completed blocks.</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-red-100 text-red-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">At Risk</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">Average is ≤ 50%</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">Attention</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">Average is ≤ 65%</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">On Track</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">Average is &gt; 65%</p>
            </div>
          </div>
        </div>

        {/* Participation Risk */}
        <div>
          <h4 className="font-black tracking-widest uppercase text-xs text-slate-500 mb-3">Participation Risk</h4>
          <p className="text-xs text-slate-400 mb-3 italic">Requires at least 3 completed blocks.</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-red-100 text-red-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">At Risk</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">On-time ≤ 50% or 2+ overdue blocks</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">Attention</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">On-time ≤ 75% or 1 overdue block</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">On Track</span>
              <p className="text-sm font-medium text-slate-600 leading-snug">On-time &gt; 75% and 0 overdue blocks</p>
            </div>
          </div>
        </div>

      </div>
      
      {/* Trend Warning */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-start gap-3">
          <span className="shrink-0 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 uppercase tracking-widest rounded-full">Trend Warning</span>
          <p className="text-sm font-medium text-slate-600 leading-snug">
            Residents whose recent block scores have dropped by 10% or more compared to earlier blocks will also be flagged for Attention.
          </p>
        </div>
      </div>
    </div>
  );
}
