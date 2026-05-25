'use client';

import React, { useState } from 'react';
import {
  Shield, LogOut, Database, PlusCircle, BarChartIcon, Users, Settings, Sparkles, Clock, Loader2
} from './AppIcons';
import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';
import CurriculumManager from './CurriculumManager';
import QuestionBankManager from './QuestionBankManager';
import { getUserRole, isAdmin, getRoleLabel } from '@/lib/roles';
import { useAdminData } from '@/hooks/useAdminData';

interface AdminConsoleProps {
  user?: any;
  profile?: any;
  onExit: () => void;
}

type TabId = 'performance' | 'roster' | 'attendance' | 'builder' | 'content' | 'questions';

export default function AdminConsole({ user, profile, onExit }: AdminConsoleProps) {
  const role = getUserRole(user, profile);
  const userIsAdmin = isAdmin(user, profile);
  // Faculty land directly on Performance; admins start on Performance too (most-used tab)
  const [activeTab, setActiveTab] = useState<TabId>('performance');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The data loading has been pushed down into the individual tabs so the console 
  // shell loads instantly and tabs can be navigated without waiting on heavy queries.

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
        { id: 'attendance', label: 'Attendance', icon: Clock, adminOnly: true, description: 'Bulk import from NI export' },
      ],
    },
    {
      heading: 'Content',
      items: [
        { id: 'questions', label: 'Questions', icon: Database, adminOnly: true, description: 'Browse bank or bulk import' },
        { id: 'builder', label: 'Curriculum Manager', icon: PlusCircle, adminOnly: true, description: 'Manage dates and questions' },
      ],
    },
  ];

  // Filter out admin-only items for faculty, then drop any heading that has no items left
  const visibleGroups = tabGroups
    .map(g => ({ ...g, items: g.items.filter(i => userIsAdmin || !i.adminOnly) }))
    .filter(g => g.items.length > 0);

  const SidebarButton = ({ tab }: { tab: TabDef; key?: string }) => {
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
            {activeTab === 'attendance' && <AttendanceManager />}
            {activeTab === 'questions' && <QuestionBankManager />}
            {activeTab === 'builder' && <CurriculumManager />}
          </main>
        </div>
      </div>
    </div>
  );
}

// (End of file)
