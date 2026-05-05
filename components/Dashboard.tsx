'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Shield, LogOut, Database, BarChartIcon, Users, Settings, 
  Search, Sparkles, Megaphone, CheckCircle, ChevronRight, Eye, X, Clock, Calendar
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
  const [activeTab, setActiveTab] = useState(profile?.role === 'admin' ? 'performance' : 'quizzes');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  
  // Block Builder State
  const [selectedCount, setSelectedCount] = useState(40);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch Categories and Years dynamically
        const { data: qData } = await supabase.from('questions').select('category, year');
        if (qData) {
          const uniqueCats = [...new Set(qData.map(q => q.category))].filter(Boolean).sort() as string[];
          const uniqueYears = [...new Set(qData.map(q => q.year))].filter(Boolean).sort().reverse() as string[];
          
          setCategories(uniqueCats);
          setAvailableYears(uniqueYears);
          
          setSelectedCats(uniqueCats);
          setSelectedYears(uniqueYears); // Default to all available years
        }

        // Fetch Current Block
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

  const isAdmin = profile?.role === 'admin';

  const tabs = isAdmin ? [
    { id: 'performance', label: 'Program Performance', icon: BarChartIcon },
    { id: 'attendance', label: 'Attendance', icon: Users },
    { id: 'quizzes', label: 'Resident View', icon: Eye },
    { id: 'roster', label: 'Roster Manager', icon: Settings },
  ] : [
    { id: 'quizzes', label: 'Question Blocks', icon: Database },
    { id: 'my_performance', label: 'My Performance', icon: BarChartIcon },
  ];

  const handleStartCustomBlock = () => {
    onStartQuiz({ 
      topic: 'Mixed Review Block',
      categories: selectedCats,
      years: selectedYears,
      count: selectedCount
    });
    setShowBuilder(false);
  };

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
                  {isAdmin ? 'Administrator' : `Resident | ${profile?.pgy || 'PGY'}`}
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
            <span>Currently Active: Block {currentBlock.block_number}</span>
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
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8 hover-lift">
                  <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner">
                    <Database className="w-12 h-12" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-black text-slate-800">Mixed Block Builder</h2>
                    <p className="text-slate-500 font-medium max-w-md mt-1">Generate a mixed review session using available ITE years and subjects.</p>
                  </div>
                  <button 
                    onClick={() => setShowBuilder(true)}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100"
                  >
                    Start Mixed Block
                  </button>
                </div>

                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-12 mb-4 ml-2">Active Subject Reviews</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-3xl animate-pulse border border-slate-100" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {categories.map(cat => (
                      <div key={cat} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group hover-lift">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <CheckCircle className="w-6 h-6 opacity-20" />
                          </div>
                          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">AVAILABLE</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-lg mb-1">{cat}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Question Block</p>
                        <button 
                          onClick={() => onStartQuiz({ topic: cat, categories: [cat], years: availableYears, count: 40 })}
                          className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-black group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          Start Block
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'performance' && <AdminPerformance />}
            {activeTab === 'attendance' && <AttendanceManager />}
            {activeTab === 'roster' && <RosterManager />}
            
            {activeTab === 'my_performance' && (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-4">
                <BarChartIcon className="w-16 h-16 text-slate-200 mx-auto" />
                <h2 className="text-2xl font-black text-slate-800">Performance Data Analysis</h2>
                <p className="text-slate-500 max-w-sm mx-auto">Analyzing your clinical metrics and historical board prep scores. Results will appear here shortly.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Block Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 overflow-y-auto max-h-[90vh] scrollbar-hide">
              <button onClick={() => setShowBuilder(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-all">
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                  <Database className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800">Mixed Block Builder</h2>
                  <p className="text-slate-500 font-bold tracking-tight">Configure your study session</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* ITE Year Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Select ITE Years
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableYears.length > 0 ? availableYears.map(year => (
                      <button 
                        key={year}
                        onClick={() => setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])}
                        className={`px-6 py-3 rounded-xl font-black transition-all ${selectedYears.includes(year) ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        {year}
                      </button>
                    )) : (
                      <p className="text-xs font-bold text-slate-400 italic">No years found in database.</p>
                    )}
                  </div>
                </div>

                {/* Question Count */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Question Count
                  </label>
                  <div className="flex gap-3">
                    {[10, 20, 40, 100].map(count => (
                      <button 
                        key={count}
                        onClick={() => setSelectedCount(count)}
                        className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${selectedCount === count ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Filter Subjects
                    </label>
                    <button 
                      onClick={() => setSelectedCats(selectedCats.length === categories.length ? [] : categories)}
                      className="text-xs font-black text-blue-600 hover:underline"
                    >
                      {selectedCats.length === categories.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                    {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${selectedCats.includes(cat) ? 'border-blue-600 bg-blue-50/50 text-blue-900' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                      >
                        <span className="font-bold">{cat}</span>
                        {selectedCats.includes(cat) && <CheckCircle className="w-5 h-5 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleStartCustomBlock}
                disabled={selectedCats.length === 0}
                className="w-full mt-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xl hover:bg-blue-700 disabled:opacity-30 active:scale-[0.98] transition-all shadow-2xl shadow-blue-200"
              >
                Assemble Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
