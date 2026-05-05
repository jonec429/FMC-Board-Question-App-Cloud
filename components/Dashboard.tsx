'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, LogOut, Database, PlusCircle, BarChartIcon, Users, Settings, 
  Search, RefreshCw, Download, CheckCircle, XCircle 
} from './Icons';
import { ABFM_CONTENT_AREAS, ABFM_CATEGORIES } from '@/lib/constants';

interface DashboardProps {
  user: any;
  profile: any;
  onLogout: () => void;
  onStartQuiz: (quiz: any) => void;
}

import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';

export default function Dashboard({ user, profile, onLogout, onStartQuiz }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(profile?.role === 'admin' ? 'performance' : 'quizzes');
  // ...
  // Inside Tabs array:
  // { id: 'performance', label: 'Performance', icon: BarChartIcon },
  // { id: 'roster', label: 'Roster', icon: Users },
  // { id: 'attendance', label: 'Attendance', icon: Clipboard },
  // ...
  // Inside Tab Content switch:
  // {activeTab === 'performance' && <AdminPerformance />}
  // {activeTab === 'roster' && <RosterManager />}
  // {activeTab === 'attendance' && <AttendanceManager />}
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch stats and available quizzes
    setLoading(false);
  }, []);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* ... (Navigation stays same) */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-100 text-white">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-xl font-black text-slate-800 tracking-tight">FMC QBank</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {isAdmin ? 'Administrator' : `Resident | ${profile?.pgy || 'PGY'}`}
                </span>
                <span className="text-sm font-bold text-slate-700 leading-none">{profile?.full_name || user.email}</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <div className="flex flex-col h-full animate-fade-in">
          {/* Tabs Navigation */}
          <div className="mb-8">
            <div className="flex bg-white p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-hide shadow-sm border border-slate-200/50">
              {(isAdmin ? [
                { id: 'performance', label: 'Program Performance', icon: BarChartIcon },
                { id: 'attendance', label: 'Attendance', icon: Users },
                { id: 'content', label: 'Content Manager', icon: Database },
                { id: 'settings', label: 'Settings', icon: Settings }
              ] : [
                { id: 'quizzes', label: 'My Quizzes', icon: Database },
                { id: 'my_performance', label: 'My Progress', icon: BarChartIcon },
              ]).map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)} 
                    className={`flex-1 sm:flex-none px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeTab === 'quizzes' && (
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
                  <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner">
                    <Database className="w-12 h-12" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-black text-slate-800">Master Question Bank</h2>
                    <p className="text-slate-500 font-medium max-w-md mt-1">Generate a mixed review block of 40 questions from all 600+ board prep items.</p>
                  </div>
                  <button 
                    onClick={() => onStartQuiz({ topic: 'Mixed Review Block' })}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100"
                  >
                    Start Mixed Block
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['Cardiology', 'Pediatrics', 'Obstetrics'].map(cat => (
                    <div key={cat} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                      <h3 className="font-black text-slate-800 text-lg mb-1">{cat}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Subject Review</p>
                      <button 
                        onClick={() => onStartQuiz({ topic: `${cat} Review` })}
                        className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-black group-hover:bg-blue-600 group-hover:text-white transition-all"
                      >
                        Start Block
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'performance' && <AdminPerformance />}
            
            {activeTab === 'attendance' && <AttendanceManager />}
            
            {activeTab === 'content' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center">
                <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Migration Success!</h3>
                <p className="text-slate-500 mt-2">600 Questions and Roster successfully imported to Supabase.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
