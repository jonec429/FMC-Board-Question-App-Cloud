'use client';

import React, { useState } from 'react';
import {
  Shield, LogOut, Database, PlusCircle, BarChartIcon, Users, Settings, Sparkles, Clock, Calendar,
} from './AppIcons';
import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';
import BlockScheduleManager from './BlockScheduleManager';
import QuestionImporter from './QuestionImporter';
import BlockBuilder from './BlockBuilder';
import { getUserRole, isAdmin, getRoleLabel } from '@/lib/roles';

interface AdminConsoleProps {
  user?: any;
  profile?: any;
  onExit: () => void;
}

type TabId = 'performance' | 'roster' | 'schedule' | 'attendance' | 'builder' | 'content' | 'questions' | 'advanced';

export default function AdminConsole({ user, profile, onExit }: AdminConsoleProps) {
  const role = getUserRole(user, profile);
  const userIsAdmin = isAdmin(user, profile);
  // Faculty land directly on Performance; admins start on Performance too (most-used tab)
  const [activeTab, setActiveTab] = useState<TabId>('performance');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sidebar groups — ordered by likely-use frequency
  // `adminOnly: true` tabs are hidden from faculty users
  type TabDef = { id: TabId; label: string; icon: any; adminOnly?: boolean; description?: string };
  const tabGroups: { heading: string; items: TabDef[] }[] = [
    {
      heading: 'Reports',
      items: [
        { id: 'performance', label: 'Performance', icon: BarChartIcon, description: 'Resident progress & risk flags' },
      ],
    },
    {
      heading: 'Program Management',
      items: [
        { id: 'roster', label: 'Roster', icon: Users, adminOnly: true, description: 'Add, edit, archive members' },
        { id: 'schedule', label: 'Block Schedule', icon: Calendar, adminOnly: true, description: 'Date windows for each block' },
        { id: 'attendance', label: 'Attendance', icon: Clock, adminOnly: true, description: 'Bulk import from NI export' },
      ],
    },
    {
      heading: 'Content',
      items: [
        { id: 'questions', label: 'Questions', icon: Database, adminOnly: true, description: 'Bulk import from CSV / Gemini' },
        { id: 'builder', label: 'Block Builder', icon: PlusCircle, adminOnly: true, description: 'Curate questions into blocks' },
        { id: 'content', label: 'Curriculum', icon: Database, adminOnly: true, description: 'Edit & reorder blocks' },
      ],
    },
    {
      heading: 'System',
      items: [
        { id: 'advanced', label: 'Advanced', icon: Settings, adminOnly: true, description: 'Reporting & integrations' },
      ],
    },
  ];

  // Filter out admin-only items for faculty, then drop any heading that has no items left
  const visibleGroups = tabGroups
    .map(g => ({ ...g, items: g.items.filter(i => userIsAdmin || !i.adminOnly) }))
    .filter(g => g.items.length > 0);

  const SidebarButton = ({ tab }: { tab: TabDef }) => {
    const Icon = tab.icon;
    const active = activeTab === tab.id;
    return (
      <button
        onClick={() => {
          setActiveTab(tab.id);
          setMobileNavOpen(false);
        }}
        className={`group w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-start gap-3 ${
          active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{tab.label}</div>
          {tab.description && (
            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate ${active ? 'text-blue-100' : 'text-slate-400'}`}>
              {tab.description}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-100/40 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-2xl shadow-lg ${userIsAdmin ? 'bg-blue-600 shadow-blue-200' : 'bg-emerald-600 shadow-emerald-200'}`}>
                <Shield className="text-white w-5 h-5" />
              </div>
              <span className="hidden sm:inline">{userIsAdmin ? 'Admin Console' : 'Faculty Console'}</span>
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${userIsAdmin ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {getRoleLabel(user, profile)}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen(v => !v)}
              className="md:hidden p-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              aria-label="Toggle navigation"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onExit}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-sm"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* Body: Sidebar + Main */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className={`md:w-64 shrink-0 ${mobileNavOpen ? 'block' : 'hidden md:block'}`}>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 sticky top-6 space-y-4">
              {visibleGroups.map(group => (
                <div key={group.heading} className="space-y-1">
                  <div className="px-4 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {group.heading}
                  </div>
                  {group.items.map(item => <SidebarButton key={item.id} tab={item} />)}
                </div>
              ))}
              {!userIsAdmin && (
                <div className="mx-3 mt-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-[11px] font-bold leading-snug">
                  Faculty access: you can review resident performance and your advisees. Other modules are admin-only.
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'performance' && <AdminPerformance user={user} profile={profile} />}
            {activeTab === 'roster' && <RosterManager />}
            {activeTab === 'schedule' && <BlockScheduleManager />}
            {activeTab === 'attendance' && <AttendanceManager />}
            {activeTab === 'questions' && <QuestionImporter />}
            {activeTab === 'builder' && <BlockBuilder />}
            {activeTab === 'content' && <ContentStub />}
            {activeTab === 'advanced' && <AdvancedTab />}
          </main>
        </div>
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
