import React from 'react';
import { X } from './AppIcons';
import QotdHistory from './QotdHistory';

interface QotdHistoryModalProps {
  onClose: () => void;
}

export default function QotdHistoryModal({ onClose }: QotdHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-white border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900">Past QOTDs</h2>
            <p className="text-slate-500 text-sm mt-1">Review previous questions and cohort stats</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <QotdHistory onBack={onClose} />
        </div>
      </div>
    </div>
  );
}
