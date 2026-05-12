'use client';

import React, { useState } from 'react';
import {
  Shield, LogOut, Database, PlusCircle, BarChartIcon, Users, Settings, Sparkles, Clock,
} from './AppIcons';
import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';

interface AdminConsoleProps {
  onExit: () => void;
}

type TabId = 'content' | 'builder' | 'performance' | 'attendance' | 'metadata' | 'advanced';

export default function AdminConsole({ onExit }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<TabId>('content');

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'content', label: 'Content', icon: Database },
    { id: 'builder', label: 'Block Builder', icon: PlusCircle },
    { id: 'performance', label: 'Performance', icon: BarChartIcon },
    { id: 'attendance', label: 'Attendance', icon: Users },
    { id: 'metadata', label: 'Q Metadata', icon: Database },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-100/40 rounded-full blur-2xl pointer-events-none" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                  <Shield className="text-white w-5 h-5" />
                </div>
                Admin Console
              </h2>
            </div>
            <button
              onClick={onExit}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-sm"
            >
              <LogOut className="w-4 h-4" /> Exit
            </button>
          </div>

          {/* Tab Nav */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full overflow-x-auto shadow-inner border border-slate-200/50">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 sm:flex-none px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${isActive ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'content' && <ContentStub />}
        {activeTab === 'builder' && <BuilderStub />}
        {activeTab === 'performance' && <AdminPerformance />}
        {activeTab === 'attendance' && <AttendanceManager />}
        {activeTab === 'metadata' && <MetadataStub />}
        {activeTab === 'advanced' && <AdvancedTab />}
      </div>
    </div>
  );
}

// === STUBS ===

function StubCard({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: any;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm text-center max-w-2xl mx-auto">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-blue-600">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-2xl font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 mb-6 max-w-md mx-auto">{description}</p>

      <div className="bg-slate-50 rounded-2xl p-5 text-left mb-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Legacy features to port</p>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-blue-500 font-black mt-0.5">·</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
        <Clock className="w-3.5 h-3.5" /> Coming Soon — Roadmap Item
      </div>
    </div>
  );
}

function ContentStub() {
  return (
    <StubCard
      icon={Database}
      title="Content Management"
      description="Manage the academic curriculum — quiz blocks, schedule, and program content."
      features={[
        'List, edit, delete, and reorder quiz blocks (drag-and-drop)',
        'Edit block titles inline',
        'Sync live schedule from external sheet',
        'Email master performance reports to advisors',
        'Push local changes to the cloud',
      ]}
    />
  );
}

function BuilderStub() {
  return (
    <StubCard
      icon={PlusCircle}
      title="Block Builder"
      description="Curate questions from the master question bank into a fixed quiz block."
      features={[
        'Browse the master question bank with year + category filters',
        'Select questions to include in a new block',
        'Reorder selected questions',
        'Edit question metadata inline',
        'Save a new block to the curriculum',
      ]}
    />
  );
}

function MetadataStub() {
  return (
    <StubCard
      icon={Database}
      title="Question Metadata"
      description="Validate, export, and update question metadata across the master bank."
      features={[
        'Scan all quiz tabs for missing or duplicate composite IDs (YYYY-QQQ format)',
        'Export current metadata as CSV',
        'Bulk import updated metadata (difficulty, ABFM category)',
        'Repair year and Q# fields',
      ]}
    />
  );
}

function AdvancedTab() {
  const [section, setSection] = useState<'roster' | 'reports'>('roster');

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50">
        <button
          onClick={() => setSection('roster')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 ${section === 'roster' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
        >
          <Users className="w-4 h-4" /> Roster
        </button>
        <button
          onClick={() => setSection('reports')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 ${section === 'reports' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
        >
          <Sparkles className="w-4 h-4" /> Reports &amp; Emails
        </button>
      </div>

      {section === 'roster' && <RosterManager />}
      {section === 'reports' && (
        <StubCard
          icon={Sparkles}
          title="Reports &amp; Emails"
          description="Automated reporting and email workflows for residents and advisors."
          features={[
            'Generate multi-page master PDF report (all residents)',
            'Send individual advisor reports filtered to their advisees',
            'Export performance data to CSV',
            'Schedule mid-block email reminders to incomplete residents',
            'Send quiz result emails with missed-question summaries',
          ]}
        />
      )}
    </div>
  );
}
