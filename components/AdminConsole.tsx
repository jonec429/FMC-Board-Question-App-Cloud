'use client';

import React, { useState } from 'react';
import {
  Shield, LogOut, Database, PlusCircle, BarChartIcon, Users, Settings, Sparkles, Clock, Loader2, Megaphone, FileText
} from './AppIcons';
import AdminPerformance from './AdminPerformance';
import AttendanceManager from './AttendanceManager';
import RosterManager from './RosterManager';
import CurriculumManager from './CurriculumManager';
import QuestionBankManager from './QuestionBankManager';
import NotificationManager from './NotificationManager';
import AdminReporting from './AdminReporting';
import AnnualRollover from './AnnualRollover';
import AssignQuizManager from './AssignQuizManager';
import { getUserRole, isAdmin, getRoleLabel } from '@/lib/roles';
import { useAdminData } from '@/hooks/useAdminData';

import { User, Profile } from '@/lib/types';

export type TabId = 'performance' | 'reporting' | 'roster' | 'attendance' | 'builder' | 'content' | 'questions' | 'notifications' | 'rollover' | 'assign';

interface AdminConsoleProps {
  user?: User | null;
  profile?: Profile | null;
  onExit: () => void;
  initialTab?: TabId;
}

export default function AdminConsole({ user, profile, onExit, initialTab }: AdminConsoleProps) {
  const role = getUserRole(user, profile);
  const userIsAdmin = isAdmin(user, profile);
  // Faculty land directly on Performance (or initialTab); admins start on Performance too (most-used tab)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'performance');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Hoist the hook call to the top level to avoid React Rules of Hooks violations.
  // Questions are lazily fetched only on tabs that require them.
  const adminDataResult = useAdminData({ 
    includeQuestions: activeTab === 'questions' || activeTab === 'builder' 
  });

  // Sidebar groups — ordered by likely-use frequency
  // `adminOnly: true` tabs are hidden from faculty users
  type TabDef = { id: TabId; label: string; icon: React.FC<any>; adminOnly?: boolean; description?: string };
  const tabGroups: { heading: string; items: TabDef[] }[] = [
    {
      heading: 'Reports',
      items: [
        { id: 'performance', label: 'Performance', icon: BarChartIcon, description: 'Resident progress & risk flags' },
        { id: 'assign', label: 'Assign Quizzes', icon: Sparkles, description: 'Assign targeted practice' },
        { id: 'reporting', label: 'Reports & CCC Export', icon: FileText, description: 'Customized CCC review packets, dossiers, & CSVs' },
      ],
    },
    {
      heading: 'Program Management',
      items: [
        { id: 'roster', label: 'Roster', icon: Users, adminOnly: true, description: 'Add, edit, archive members' },
        { id: 'attendance', label: 'Attendance', icon: Clock, adminOnly: true, description: 'Bulk import from NI export' },
        { id: 'notifications', label: 'Notifications', icon: Megaphone, adminOnly: true, description: 'Send broadcasts & tests' },
      ],
    },
    {
      heading: 'Content',
      items: [
        { id: 'questions', label: 'Questions', icon: Database, adminOnly: true, description: 'Browse bank or bulk import' },
        { id: 'builder', label: 'Curriculum Manager', icon: PlusCircle, adminOnly: true, description: 'Manage dates and questions' },
      ],
    },
    {
      heading: 'System',
      items: [
        { id: 'rollover', label: 'Annual Rollover', icon: Settings, adminOnly: true, description: 'Year-over-year question integration' },
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
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{tab.label}</div>
          {tab.description && (
            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate ${active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
              {tab.description}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-2xl shadow-lg ${userIsAdmin ? 'bg-blue-600 shadow-blue-200 dark:shadow-none' : 'bg-emerald-600 shadow-emerald-200 dark:shadow-none'}`}>
                <Shield className="text-white w-5 h-5" />
              </div>
              <span className="hidden sm:inline">{userIsAdmin ? 'Admin Console' : 'Faculty Console'}</span>
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${userIsAdmin ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'}`}>
                {getRoleLabel(user, profile)}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen(v => !v)}
              className="md:hidden p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              aria-label="Toggle navigation"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onExit}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg active:scale-95 text-sm"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* Body: Sidebar + Main */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className={`md:w-64 shrink-0 ${mobileNavOpen ? 'block' : 'hidden md:block'}`}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 sticky top-6 space-y-4 transition-colors">
              {visibleGroups.map(group => (
                <div key={group.heading} className="space-y-1">
                  <div className="px-4 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {group.heading}
                  </div>
                  {group.items.map(item => <SidebarButton key={item.id} tab={item} />)}
                </div>
              ))}
              {!userIsAdmin && (
                <div className="mx-3 mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold leading-snug border border-emerald-100 dark:border-emerald-900/40">
                  Faculty access: you can review resident performance and your advisees. Other modules are admin-only.
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'performance' && <AdminPerformance user={user} profile={profile} />}
            {activeTab === 'reporting' && adminDataResult.data && <AdminReporting adminData={adminDataResult.data} user={user} profile={profile} />}
            {activeTab === 'roster' && <RosterManager />}
            {activeTab === 'attendance' && <AttendanceManager />}
            {activeTab === 'questions' && <QuestionBankManager />}
            {activeTab === 'builder' && <CurriculumManager />}
            {activeTab === 'notifications' && <NotificationManager user={user} profile={profile} />}
            {activeTab === 'rollover' && <AnnualRollover user={user} onNavigate={(t) => setActiveTab(t as TabId)} />}
            {activeTab === 'assign' && <AssignQuizManager user={user} profile={profile} />}
          </main>
        </div>
      </div>
    </div>
  );
}
