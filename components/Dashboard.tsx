'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Shield, LogOut, Database, BarChartIcon, Users, Settings, 
  Search, Sparkles, Megaphone, CheckCircle, ChevronRight, Eye, X, Clock, Calendar, RefreshCw, Plus, Edit3, Loader2, Save
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
  const isSuperAdmin = user?.email === 'jonathan.carbungco@ascension.org' || profile?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'performance' : 'quizzes');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [premadeQuizzes, setPremadeQuizzes] = useState<any[]>([]);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  
  const [showBuilder, setShowBuilder] = useState(false);
  const [showQuestionBrowser, setShowQuestionBrowser] = useState(false);
  const [showBlockCreator, setShowBlockCreator] = useState(false);
  
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: qData } = await supabase.from('questions').select('category, year');
        if (qData) {
          setCategories(Array.from(new Set(qData.map(q => q.category))).filter(Boolean).sort() as string[]);
          setAvailableYears(Array.from(new Set(qData.map(q => q.year))).filter(Boolean).sort().reverse() as string[]);
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

  const handleCreateBlock = async () => {
    if (!newBlockTitle.trim()) return;
    setIsInitializing(true);
    try {
      // 1. Create a quiz entry
      const { data: quiz, error: qError } = await supabase
        .from('quizzes')
        .insert({
          title: newBlockTitle,
          description: 'Custom Academic Block',
          question_ids: [], // Admin will fill this later
          is_active: true
        })
        .select()
        .single();

      if (qError) throw qError;

      // 2. Update Local State
      setPremadeQuizzes([quiz, ...premadeQuizzes]);
      setShowBlockCreator(false);
      setNewBlockTitle('');
      alert('Block Initialized! You can now browse questions to add them.');
    } catch (err: any) {
      alert('Error creating block: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleMixedBlock = async () => {
    // Basic logic for resident mixed block
    onStartQuiz({ topic: 'Mixed Block', count: 40 });
    setShowBuilder(false);
  };

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
                    {premadeQuizzes.length > 0 ? premadeQuizzes.map(quiz => (
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
                    )) : (
                      <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100">
                        <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-slate-800">No active blocks available</h4>
                        <p className="text-slate-400 text-sm">Blocks will appear here once created in the Curriculum Manager.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8 hover-lift">
                  <div className="w-24 h-24 bg-purple-50 rounded-3xl flex items-center justify-center text-purple-600 shadow-inner">
                    <Sparkles className="w-12 h-12" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-black text-slate-800">Mixed Block Builder</h2>
                    <p className="text-slate-500 font-medium max-w-md mt-1">Generate a custom review session using any year or subject.</p>
                  </div>
                  <button 
                    onClick={() => setShowBuilder(true)}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200"
                  >
                    Build Mixed Block
                  </button>
                </section>
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center">
                <Edit3 className="w-16 h-16 text-blue-100 mx-auto mb-6" />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Curriculum Manager</h2>
                <p className="text-slate-500 max-w-lg mx-auto mt-2 font-medium">Build your Blocks from scratch for the new academic year. You can select questions directly from your CSV upload here.</p>
                
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setShowQuestionBrowser(true)}
                    className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-400 transition-all group"
                  >
                    <Database className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
                    <span className="block font-black text-slate-800">Browse Question Bank</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active 2023-2025 Data</span>
                  </button>
                  <button className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-400 transition-all group">
                    <Calendar className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
                    <span className="block font-black text-slate-800">Set Schedule</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Academic Year 2026-27</span>
                  </button>
                  <button 
                    onClick={() => setShowBlockCreator(true)}
                    className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-100 hover:scale-105 transition-all"
                  >
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

      {/* Modals */}
      {showQuestionBrowser && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Question Bank (2023-2025)</h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Filter by Subject or Year</p>
              </div>
              <button onClick={() => setShowQuestionBrowser(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <div key={cat} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center group hover:bg-blue-50 transition-all border border-slate-100 hover:border-blue-200">
                    <div>
                      <span className="font-black text-slate-700 block">{cat}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject Pool</span>
                    </div>
                    <button className="p-2 bg-white text-blue-600 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBlockCreator && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Plus className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Create Academic Block</h2>
            <p className="text-slate-500 mb-8 font-medium">Define a new block for the 2026-2027 curriculum.</p>
            <div className="space-y-4 text-left">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Block Title</label>
              <input 
                type="text" 
                value={newBlockTitle}
                onChange={(e) => setNewBlockTitle(e.target.value)}
                placeholder="e.g. Block 1: Internal Medicine" 
                className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all font-bold text-slate-800" 
              />
            </div>
            <button 
              onClick={handleCreateBlock}
              disabled={isInitializing || !newBlockTitle.trim()}
              className="w-full mt-10 py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInitializing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-5 h-5" />}
              Initialize Block
            </button>
            <button onClick={() => setShowBlockCreator(false)} className="mt-6 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-slate-600 transition-all">Cancel</button>
          </div>
        </div>
      )}

      {showBuilder && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-12 text-center">
            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Mixed Block Builder</h2>
            <p className="text-slate-500 mb-10">Generate a custom 40-question review session.</p>
            <button 
              onClick={handleMixedBlock}
              className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Generate Block
            </button>
            <button onClick={() => setShowBuilder(false)} className="mt-6 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-slate-600 transition-all">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
