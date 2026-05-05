'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Shield, LogOut, Database, BarChartIcon, Users, Settings, 
  Search, Sparkles, Megaphone, CheckCircle, ChevronRight, Eye, X, Clock, Calendar, RefreshCw, Plus, Edit3
} from './AppIcons';

import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';

interface DashboardProps {
  user: any;
  profile: any;
  onLogout: () => void;
  onStartQuiz: (quiz: any) => void;
}

export default function Dashboard({ user, profile, onLogout, onStartQuiz }: DashboardProps) {
  // SUPER ADMIN BYPASS: Always show admin for jonathan.carbungco@ascension.org
  const isSuperAdmin = user?.email === 'jonathan.carbungco@ascension.org' || profile?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'performance' : 'quizzes');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [premadeQuizzes, setPremadeQuizzes] = useState<any[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: qData } = await supabase.from('questions').select('category, year');
        if (qData) {
          const uniqueCats = [...new Set(qData.map(q => q.category))].filter(Boolean).sort() as string[];
          const uniqueYears = [...new Set(qData.map(q => q.year))].filter(Boolean).sort().reverse() as string[];
          setCategories(uniqueCats);
          setAvailableYears(uniqueYears);
        }

        const { data: quizData } = await supabase.from('quizzes').select('*').order('title');
        if (quizData) setPremadeQuizzes(quizData);

        const today = new Date().toISOString().split('T')[0];
        const { data: bData } = await supabase
          .from('block_schedule')
          .select('*')
          .lte('start_date', today)
          .gte('end_date', today)
          .maybeSingle();
        setCurrentBlock(bData);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const tabs = isSuperAdmin ? [
    { id: 'performance', label: 'Program Performance', icon: BarChartIcon },
    { id: 'attendance', label: 'Attendance', icon: Users },
    { id: 'curriculum', label: 'Curriculum Manager', icon: Edit3 },
    { id: 'quizzes', label: 'Resident View', icon: Eye },
    { id: 'roster', label: 'Roster Manager', icon: Settings },
  ] : [
    { id: 'quizzes', label: 'Question Blocks', icon: Database },
    { id: 'my_performance', label: 'My Performance', icon: BarChartIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-100 text-white">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-xl font-black text-slate-800 tracking-tight">FMC Board Question App</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {isSuperAdmin ? 'Super Admin' : `Resident | ${profile?.pgy || 'PGY'}`}
                </span>
                <span className="text-sm font-bold text-slate-700 leading-none">{profile?.full_name || user.email}</span>
              </div>
              <button onClick={onLogout} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {currentBlock && (
        <div className="bg-blue-600 text-white py-3 px-4 shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 text-sm font-black uppercase tracking-widest">
            <Calendar className="w-4 h-4" />
            <span>Academic Block {currentBlock.block_number} Active</span>
            <span className="opacity-40">•</span>
            <span>Ends {new Date(currentBlock.end_date).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 pb-32">
        <div className="flex flex-col h-full animate-fade-in">
          <div className="mb-8">
            <div className="flex bg-white p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-hide shadow-sm border border-slate-200/50">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)} 
                    className={`flex-1 sm:flex-none px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'quizzes' && (
              <div className="space-y-12">
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 ml-2">Academic Curriculum</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {premadeQuizzes.map(quiz => (
                      <div key={quiz.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group hover-lift">
                        <h3 className="font-black text-slate-800 text-lg mb-1">{quiz.title}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{quiz.question_ids?.length || 0} Questions</p>
                        <button 
                          onClick={() => onStartQuiz({ topic: quiz.title, quizId: quiz.id, count: quiz.question_ids?.length || 40 })}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          Start Block
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {isSuperAdmin && (
                      <button 
                        onClick={() => setActiveTab('curriculum')}
                        className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all group"
                      >
                        <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-black uppercase tracking-widest text-[10px]">Create New Block</span>
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center">
                <Edit3 className="w-16 h-16 text-blue-100 mx-auto mb-6" />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Curriculum Manager</h2>
                <p className="text-slate-500 max-w-lg mx-auto mt-2 font-medium">Build your Blocks from scratch for the new academic year. You can select questions directly from your CSV upload here.</p>
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-400 transition-all group">
                    <Database className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
                    <span className="block font-black text-slate-800">Browse Questions</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">From CSV Upload</span>
                  </button>
                  <button className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-400 transition-all group">
                    <Calendar className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
                    <span className="block font-black text-slate-800">Set Schedule</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Academic Year 2024-25</span>
                  </button>
                  <button className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-100 hover:scale-105 transition-all">
                    <Plus className="w-8 h-8 mb-2 mx-auto" />
                    <span className="block font-black">Create New Block</span>
                    <span className="text-[10px] opacity-60 font-black uppercase tracking-widest">Start from Scratch</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'performance' && <AdminPerformance />}
            {activeTab === 'attendance' && <AttendanceManager />}
            {activeTab === 'roster' && <RosterManager />}
          </div>
        </div>
      </main>
    </div>
  );
}
