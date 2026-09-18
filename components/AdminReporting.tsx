'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AdminData, User, Profile } from '@/lib/types';
import { getCurrentAcademicYear, formatAcademicYear, isActiveResident, deriveLabel, derivePGY, getResidentClassYear, residentMatchesCohort } from '@/lib/academicYear';
import { formatDisplayName } from '@/lib/utils';
import {
  computeCccReportData,
  exportCccCsv,
  getDateRangePreset,
  DateRangePreset,
  DateRangeConfig,
  CccResidentReportItem,
  CommitteeStanding,
} from '@/lib/cccReporting';
import {
  FileText,
  Download,
  Printer,
  Users,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Sliders,
  Info,
  Sparkles,
  BookOpen,
} from './AppIcons';

interface AdminReportingProps {
  adminData: AdminData;
  user?: User | null;
  profile?: Profile | null;
  initialPgy?: string;
  initialEmails?: string[];
}

export type ReportLayout = 'matrix' | 'dossiers' | 'combined';

export default function AdminReporting({
  adminData,
  user,
  profile,
  initialPgy,
  initialEmails,
}: AdminReportingProps) {
  const academicYear = getCurrentAcademicYear();

  // Faculty name for "My Advisees" matching
  const facultyName = useMemo(() => {
    if (!profile) return '';
    return profile.full_name || (profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '');
  }, [profile]);

  // Active roster entries
  const activeResidents = useMemo(() => {
    if (!adminData?.roster) return [];
    return adminData.roster.filter(isActiveResident).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [adminData]);

  // Extract distinct advisors for dropdown
  const distinctAdvisors = useMemo(() => {
    const set = new Set<string>();
    activeResidents.forEach((r) => {
      if (r.advisor?.trim()) set.add(r.advisor.trim());
    });
    return Array.from(set).sort();
  }, [activeResidents]);

  // Selection & Filter State
  const [selectedPgy, setSelectedPgy] = useState<string>(initialPgy || 'ALL');
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('ALL');
  const [selectedStanding, setSelectedStanding] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showResidentDrawer, setShowResidentDrawer] = useState<boolean>(false);

  // Set of selected resident emails (defaults to all active residents or initial selection)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(() => {
    if (initialEmails && initialEmails.length > 0) {
      return new Set(initialEmails.map((e) => e.toLowerCase()));
    }
    if (initialPgy && initialPgy !== 'ALL') {
      const matched = (adminData?.roster || [])
        .filter(isActiveResident)
        .filter((r) => residentMatchesCohort(r, initialPgy, academicYear, facultyName))
        .map((r) => (r.email || '').toLowerCase());
      if (matched.length > 0) return new Set(matched);
    }
    return new Set(activeResidents.map((r) => (r.email || '').toLowerCase()));
  });

  // Keep selected emails in sync if initial props change
  useEffect(() => {
    if (initialEmails && initialEmails.length > 0) {
      setSelectedEmails(new Set(initialEmails.map((e) => e.toLowerCase())));
    } else if (initialPgy && initialPgy !== 'ALL') {
      const matched = activeResidents
        .filter((r) => residentMatchesCohort(r, initialPgy, academicYear, facultyName))
        .map((r) => (r.email || '').toLowerCase());
      if (matched.length > 0) setSelectedEmails(new Set(matched));
    }
  }, [initialPgy, initialEmails, activeResidents, academicYear, facultyName]);

  // Date Range State
  const [datePreset, setDatePreset] = useState<DateRangePreset>('6m'); // Default to 6-month semi-annual review
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Report Layout format
  const [reportLayout, setReportLayout] = useState<ReportLayout>('combined');

  // Print state
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Derive active date range config
  const activeDateRange: DateRangeConfig = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        preset: 'custom',
        startDate: customStartDate,
        endDate: customEndDate,
        label: `Custom Evaluation Window (${customStartDate} to ${customEndDate})`,
      };
    }
    return getDateRangePreset(datePreset, academicYear);
  }, [datePreset, customStartDate, customEndDate, academicYear]);

  // Residents filtered by cohort controls (PGY, Advisor, Search) for the checklist
  const filteredRosterForSelection = useMemo(() => {
    return activeResidents.filter((r) => {
      const email = (r.email || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const pgy = (r.pgy || '').toUpperCase();
      const advisor = (r.advisor || '').toLowerCase();

      // PGY / Cohort filter
      if (selectedPgy !== 'ALL') {
        if (!residentMatchesCohort(r, selectedPgy, academicYear, facultyName)) {
          return false;
        }
      }

      // Advisor filter
      if (selectedAdvisor !== 'ALL') {
        if (advisor !== selectedAdvisor.toLowerCase()) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const derived = deriveLabel(r, academicYear).toLowerCase();
        const classYr = getResidentClassYear(r)?.toString() || '';
        if (
          !name.includes(q) &&
          !email.includes(q) &&
          !pgy.toLowerCase().includes(q) &&
          !derived.includes(q) &&
          !classYr.includes(q) &&
          !advisor.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [activeResidents, selectedPgy, selectedAdvisor, searchQuery, academicYear, facultyName]);

  // Quick Cohort Button Options with counts and graduation class years
  const cohortButtons = useMemo(() => {
    const pgy1Class = academicYear + 2;
    const pgy2Class = academicYear + 1;
    const pgy3Class = academicYear;

    const countAll = activeResidents.length;
    const countPgy1 = activeResidents.filter((r) => residentMatchesCohort(r, 'PGY-1', academicYear)).length;
    const countPgy2 = activeResidents.filter((r) => residentMatchesCohort(r, 'PGY-2', academicYear)).length;
    const countPgy3 = activeResidents.filter((r) => residentMatchesCohort(r, 'PGY-3', academicYear)).length;
    const countAdvisees = facultyName
      ? activeResidents.filter((r) => residentMatchesCohort(r, 'MY_ADVISEES', academicYear, facultyName)).length
      : 0;

    return [
      { id: 'ALL', label: 'All Residents', badge: countAll },
      { id: 'PGY-1', label: `PGY-1 (Class of ${pgy1Class})`, badge: countPgy1 },
      { id: 'PGY-2', label: `PGY-2 (Class of ${pgy2Class})`, badge: countPgy2 },
      { id: 'PGY-3', label: `PGY-3 (Class of ${pgy3Class})`, badge: countPgy3 },
      ...(facultyName ? [{ id: 'MY_ADVISEES', label: 'My Advisees', badge: countAdvisees }] : []),
    ];
  }, [activeResidents, academicYear, facultyName]);

  // Quick Cohort Button Handlers
  const handleSelectCohort = (pgyOption: string) => {
    setSelectedPgy(pgyOption);
    if (pgyOption === 'ALL') {
      setSelectedEmails(new Set(activeResidents.map((r) => (r.email || '').toLowerCase())));
    } else {
      const classEmails = activeResidents
        .filter((r) => residentMatchesCohort(r, pgyOption, academicYear, facultyName))
        .map((r) => (r.email || '').toLowerCase());
      setSelectedEmails(new Set(classEmails));
    }
  };

  // Toggle individual resident selection
  const handleToggleResident = (email: string) => {
    const lower = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  // Select / Deselect all visible
  const handleSelectAllVisible = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      filteredRosterForSelection.forEach((r) => {
        if (r.email) next.add(r.email.toLowerCase());
      });
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      filteredRosterForSelection.forEach((r) => {
        if (r.email) next.delete(r.email.toLowerCase());
      });
      return next;
    });
  };

  // Compute the report data for the selected residents and date range
  const reportData = useMemo<CccResidentReportItem[]>(() => {
    if (!adminData) return [];
    const list = computeCccReportData({
      adminData,
      selectedEmails: Array.from(selectedEmails),
      dateRange: activeDateRange,
      academicYear,
    });

    if (selectedStanding === 'ALL') return list;
    return list.filter((r) => r.standing === selectedStanding);
  }, [adminData, selectedEmails, activeDateRange, academicYear, selectedStanding]);

  // Print Handler
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 400);
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    exportCccCsv(reportData, activeDateRange.label);
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden on Physical Print) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 print-hidden">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                CCC & Academic Review Reporting Suite
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select any training class, individual residents, or advisees over a rolling date range with clear, non-abbreviated performance metrics.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleExportCsv}
              disabled={reportData.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              title="Download filtered report as CSV spreadsheet"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={reportData.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              title="Generate and print clean PDF dossier"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Class, Date Range, Advisor, Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Quick Class / Cohort Filter */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Training Class (Cohort):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cohortButtons.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCohort(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                    selectedPgy === c.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{c.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      selectedPgy === c.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {c.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Rolling Evaluation Period / Date Range */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Evaluation Period (Date Range):
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="6m">Past 6 Months (Semi-Annual CCC)</option>
              <option value="3m">Past 3 Months (Quarterly Review)</option>
              <option value="ay">Current Academic Year (Jul 1 – Jun 30)</option>
              <option value="30d">Past 30 Days (Recent Activity)</option>
              <option value="all">All-Time Residency Tenure</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 pt-1 animate-fade-in">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-[11px] font-medium"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-[11px] font-medium"
                />
              </div>
            )}
          </div>

          {/* 3. Advisor & Standing Filter */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Faculty Advisor Filter:
            </label>
            <select
              value={selectedAdvisor}
              onChange={(e) => setSelectedAdvisor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Faculty Advisors ({distinctAdvisors.length})</option>
              {distinctAdvisors.map((adv) => (
                <option key={adv} value={adv}>
                  {formatDisplayName(adv)}
                </option>
              ))}
            </select>

            <select
              value={selectedStanding}
              onChange={(e) => setSelectedStanding(e.target.value)}
              className="w-full px-3 py-1.5 mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 outline-none text-[11px]"
            >
              <option value="ALL">All Academic Standings</option>
              <option value="Satisfactory Progress">Satisfactory Progress Only</option>
              <option value="Academic Monitoring">Academic Monitoring Only</option>
              <option value="Remediation / Review Needed">Remediation / Review Needed Only</option>
            </select>
          </div>

          {/* 4. Report Print Layout */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              PDF Document Format:
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'matrix', label: 'Matrix Table', icon: Users },
                { id: 'dossiers', label: 'Dossiers', icon: FileText },
                { id: 'combined', label: 'Combined', icon: Sparkles },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setReportLayout(fmt.id as ReportLayout)}
                  className={`px-2 py-2 rounded-xl text-center font-bold text-[11px] transition-all flex flex-col items-center gap-1 border ${
                    reportLayout === fmt.id
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <fmt.icon className="w-3.5 h-3.5" />
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowResidentDrawer(!showResidentDrawer)}
              className="w-full mt-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Sliders className="w-3.5 h-3.5 text-blue-500" />
                <span>Select Individuals ({selectedEmails.size} / {activeResidents.length})</span>
              </span>
              {showResidentDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Individual Resident Picker Checklist */}
        {showResidentDrawer && (
          <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search residents by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-lg border border-blue-100 dark:border-blue-900/50"
                >
                  Select All Visible
                </button>
                <button
                  onClick={handleDeselectAllVisible}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg"
                >
                  Clear Visible
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredRosterForSelection.map((r) => {
                const lower = (r.email || '').toLowerCase();
                const isSelected = selectedEmails.has(lower);
                return (
                  <label
                    key={r.email}
                    onClick={() => handleToggleResident(r.email)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-slate-900 dark:text-white font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="truncate">
                        <span className="block truncate">{formatDisplayName(r.name)}</span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {deriveLabel(r, academicYear)} ({r.pgy || 'PGY'}) · Adv: {formatDisplayName(r.advisor || '—')}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Info Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-800 dark:text-white">Review Summary:</span>
            <span>Evaluating <strong>{reportData.length}</strong> residents</span>
            <span>•</span>
            <span className="truncate">Period: <strong>{activeDateRange.label}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {reportData.filter((r) => r.standing === 'Satisfactory Progress').length} Satisfactory
            </span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {reportData.filter((r) => r.standing === 'Academic Monitoring').length} Monitoring
            </span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {reportData.filter((r) => r.standing === 'Remediation / Review Needed').length} Review Needed
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINTABLE / LIVE PREVIEW REPORT DOCUMENT */}
      {/* ========================================================================= */}
      <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-10 space-y-10 print:border-none print:shadow-none print:p-0 print:rounded-none print:m-0 print:text-black">
        {/* Document Master Header */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 print:border-black">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-700 print:text-blue-900 block">
              Ascension St. Vincent&apos;s Family Medicine Residency
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 print:text-black mt-1">
              Clinical Competency Committee (CCC) Academic & Performance Review
            </h1>
            <p className="text-xs text-slate-600 print:text-gray-700 mt-1 font-medium">
              Evaluation Period: <strong className="text-slate-900 print:text-black">{activeDateRange.label}</strong> • Evaluation Date: <strong className="text-slate-900 print:text-black">{todayDisplay}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-500 print:text-gray-600">
            <p className="font-bold text-slate-800 print:text-black">
              Cohort: {selectedPgy === 'ALL' ? 'Entire Program' : selectedPgy === 'MY_ADVISEES' ? `Advisees (${formatDisplayName(facultyName)})` : selectedPgy}
            </p>
            <p className="font-medium">{reportData.length} Resident Physicians Evaluated</p>
            <p className="text-[11px] font-semibold text-blue-700 print:text-black uppercase tracking-wider mt-0.5">
              Confidential • Official Committee Record
            </p>
          </div>
        </div>

        {/* Empty State */}
        {reportData.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-bold text-base text-slate-600">No resident physicians match the current selection.</p>
            <p className="text-xs mt-1">Adjust your training class filter, advisor selection, or date range above.</p>
          </div>
        )}

        {/* SECTION 1: COMMITTEE REVIEW MATRIX (TABLE FORMAT) */}
        {(reportLayout === 'matrix' || reportLayout === 'combined') && reportData.length > 0 && (
          <div className="space-y-4 print-avoid-break">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider text-slate-800 print:text-black flex items-center gap-2">
                  <span>Committee Review Matrix</span>
                  <span className="text-xs font-semibold text-slate-500 print:text-gray-600">
                    ({reportData.length} Residents)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 print:text-gray-600">
                  Side-by-side milestone comparison. Minimum Passing Standard: ≥70% exam score · Compliance Standard: ≥75% on-time.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-2xl print:rounded-none print:border-black">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider border-b-2 border-slate-300 print:bg-gray-100 print:text-black print:border-black text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Resident Physician</th>
                    <th className="py-3 px-2">Training Level</th>
                    <th className="py-3 px-2">Faculty Advisor</th>
                    <th className="py-3 px-2 text-center">Curriculum Exam Avg</th>
                    <th className="py-3 px-2 text-center">Blocks Finished</th>
                    <th className="py-3 px-2 text-center">On-Time Rate</th>
                    <th className="py-3 px-2 text-center">Past-Due</th>
                    <th className="py-3 px-2 text-center">Academic Points</th>
                    <th className="py-3 px-3 text-right">Committee Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 print:divide-gray-300">
                  {reportData.map((r) => {
                    const isPassing = r.curriculumAvg >= 70;
                    const isOnTime = r.onTimeRate >= 75;
                    return (
                      <tr key={r.email} className="print-avoid-break hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 print:text-black block text-sm">
                            {r.formattedName}
                          </span>
                          <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                            {r.email}
                          </span>
                          {r.flags.length > 0 && (
                            <span className="text-[10px] font-bold text-red-700 print:text-black block mt-0.5">
                              ⚠️ {r.flags[0]}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-slate-700 print:text-black font-semibold">
                          <span className="block font-bold">{r.pgy}</span>
                          {r.classYear && (
                            <span className="block text-[10px] text-slate-500 print:text-gray-600 font-normal">
                              Class of {r.classYear}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-slate-700 print:text-black">
                          {formatDisplayName(r.advisor)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`font-black text-sm ${
                              r.curriculumAttempts === 0
                                ? 'text-slate-400'
                                : isPassing
                                ? 'text-emerald-700 print:text-black'
                                : 'text-red-700 print:text-black font-extrabold'
                            }`}
                          >
                            {r.curriculumAttempts > 0 ? `${r.curriculumAvg}%` : '—'}
                          </span>
                          <span className="block text-[9px] text-slate-400 print:text-gray-600">
                            {r.curriculumAttempts} module{r.curriculumAttempts === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-slate-800 print:text-black">
                          {r.blocksCompleted} of {r.requiredBlocksTotal}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`font-bold ${
                              r.blocksCompleted === 0
                                ? 'text-slate-400'
                                : isOnTime
                                ? 'text-emerald-700 print:text-black'
                                : 'text-amber-700 print:text-black'
                            }`}
                          >
                            {r.blocksCompleted > 0 ? `${r.onTimeRate}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold">
                          <span
                            className={
                              r.overdueCount > 0
                                ? 'text-red-700 print:text-black font-extrabold'
                                : 'text-slate-400 print:text-gray-500'
                            }
                          >
                            {r.overdueCount}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-black text-amber-700 print:text-black">
                          {r.totalPoints} pts
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                              r.standing === 'Satisfactory Progress'
                                ? 'bg-emerald-100 text-emerald-800 print:border print:border-black print:bg-white print:text-black'
                                : r.standing === 'Academic Monitoring'
                                ? 'bg-amber-100 text-amber-800 print:border print:border-black print:bg-white print:text-black'
                                : 'bg-red-100 text-red-800 print:border-2 print:border-black print:bg-white print:text-black font-black'
                            }`}
                          >
                            {r.standing}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Committee Glossary / Explanatory Legend for Faculty */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl print:rounded-none print:border-black print:bg-white text-xs space-y-3 mt-4 print-avoid-break">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 print:text-black uppercase tracking-wider text-[11px]">
                <Info className="w-4 h-4 text-blue-600 print:text-black" />
                <span>Clinical Competency Committee Guide & Metric Reference Key</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-600 print:text-gray-800 text-[11px]">
                <div>
                  <strong className="text-slate-900 print:text-black block">Curriculum Exam Average:</strong>
                  Cumulative score across assigned monthly board preparation questions. Residency target standard is <strong>≥ 70%</strong>.
                </div>
                <div>
                  <strong className="text-slate-900 print:text-black block">Monthly Blocks Completed:</strong>
                  Faculty-curated question modules covering the core ABFM board examination blueprint.
                </div>
                <div>
                  <strong className="text-slate-900 print:text-black block">On-Time Deadline Compliance:</strong>
                  Percentage of required monthly modules submitted prior to the deadline. Program target standard is <strong>≥ 75%</strong>.
                </div>
                <div>
                  <strong className="text-slate-900 print:text-black block">Academic Engagement Points:</strong>
                  Incentive credit earned for timely module submissions, didactic conference attendance, and faculty advising sessions.
                </div>
              </div>

              {/* Explicit Standing Criteria: At Risk vs Needs Attention vs On Track */}
              <div className="pt-3 border-t border-slate-200 print:border-black">
                <span className="font-bold text-slate-900 print:text-black block mb-1.5 text-[11px] uppercase tracking-wide">
                  Standing Parameter Criteria & Thresholds:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl print:border-black print:bg-white">
                    <span className="font-black text-red-900 print:text-black block text-xs">
                      🚨 Remediation / Review Needed (At Risk)
                    </span>
                    <p className="text-[10px] text-slate-500 print:text-gray-600 mb-1">Triggered if ANY of the following occur:</p>
                    <ul className="list-disc list-inside text-slate-800 print:text-black space-y-0.5 font-medium">
                      <li>Curriculum exam average ≤ 50%</li>
                      <li>2 or more past-due curriculum blocks</li>
                      <li>On-time submission compliance ≤ 50%</li>
                    </ul>
                  </div>

                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl print:border-black print:bg-white">
                    <span className="font-black text-amber-900 print:text-black block text-xs">
                      ⚠️ Academic Monitoring (Needs Attention)
                    </span>
                    <p className="text-[10px] text-slate-500 print:text-gray-600 mb-1">Triggered if ANY of the following occur:</p>
                    <ul className="list-disc list-inside text-slate-800 print:text-black space-y-0.5 font-medium">
                      <li>Curriculum exam average between 51% and 65%</li>
                      <li>1 past-due curriculum block</li>
                      <li>On-time submission compliance between 51% and 75%</li>
                      <li>Recent block scores dropped ≥ 10% compared to prior blocks</li>
                    </ul>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl print:border-black print:bg-white">
                    <span className="font-black text-emerald-900 print:text-black block text-xs">
                      ✅ Satisfactory Progress (On Track)
                    </span>
                    <p className="text-[10px] text-slate-500 print:text-gray-600 mb-1">Meets all program milestones:</p>
                    <ul className="list-disc list-inside text-slate-800 print:text-black space-y-0.5 font-medium">
                      <li>Curriculum exam average &gt; 65% (Goal: ≥ 70%)</li>
                      <li>0 past-due curriculum blocks (all up to date)</li>
                      <li>On-time submission compliance &gt; 75%</li>
                      <li>Stable or upward score trajectory</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: COMPREHENSIVE INDIVIDUAL RESIDENT DOSSIERS */}
        {(reportLayout === 'dossiers' || reportLayout === 'combined') && reportData.length > 0 && (
          <div className="space-y-12">
            {reportData.map((r, idx) => (
              <div
                key={r.email}
                className="border-2 border-slate-300 rounded-3xl p-6 sm:p-8 bg-white space-y-6 print:border-black print:rounded-none print:p-0 print:space-y-5 print-page-break"
              >
                {/* Individual Header Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b-2 border-slate-900 print:border-black">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900 print:text-black">
                        {r.formattedName}
                      </h2>
                      <span className="px-3 py-0.5 bg-blue-100 text-blue-800 print:border print:border-black print:bg-white print:text-black text-xs font-black rounded-full">
                        {r.pgyLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 print:text-gray-700 mt-1 font-medium">
                      Email: {r.email} • Faculty Advisor: <strong className="text-slate-900 print:text-black">{formatDisplayName(r.advisor)}</strong>
                    </p>
                  </div>

                  <div>
                    <span
                      className={`inline-block px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                        r.standing === 'Satisfactory Progress'
                          ? 'bg-emerald-100 text-emerald-800 print:border print:border-black print:bg-white print:text-black'
                          : r.standing === 'Academic Monitoring'
                          ? 'bg-amber-100 text-amber-800 print:border print:border-black print:bg-white print:text-black'
                          : 'bg-red-100 text-red-800 print:border-2 print:border-black print:bg-white print:text-black'
                      }`}
                    >
                      {r.standing}
                    </span>
                  </div>
                </div>

                {/* Automated Plain-Language Narrative Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl print:border print:border-black print:bg-white">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 print:text-black block mb-1">
                    Executive Performance Summary (Plain-Language Narrative)
                  </span>
                  <p className="text-xs text-slate-800 print:text-black font-medium leading-relaxed">
                    {r.narrativeSummary}
                  </p>
                </div>

                {/* 4 KPI Metric Cards with Spelled-Out Labels & Benchmarks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print-avoid-break">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center print:border print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                      Curriculum Exam Average
                    </span>
                    <span
                      className={`text-2xl font-black block mt-1 ${
                        r.curriculumAttempts === 0
                          ? 'text-slate-400'
                          : r.curriculumAvg >= 70
                          ? 'text-emerald-700 print:text-black'
                          : 'text-red-700 print:text-black'
                      }`}
                    >
                      {r.curriculumAttempts > 0 ? `${r.curriculumAvg}%` : '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-0.5">
                      Program Benchmark: ≥ 70%
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center print:border print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                      Curriculum Blocks Completed
                    </span>
                    <span className="text-2xl font-black text-slate-900 print:text-black block mt-1">
                      {r.blocksCompleted} of {r.requiredBlocksTotal}
                    </span>
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-0.5">
                      {r.overdueCount > 0 ? `${r.overdueCount} Past-Due Block(s)` : 'All Blocks Up to Date'}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center print:border print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                      On-Time Submission Rate
                    </span>
                    <span
                      className={`text-2xl font-black block mt-1 ${
                        r.blocksCompleted === 0
                          ? 'text-slate-400'
                          : r.onTimeRate >= 75
                          ? 'text-emerald-700 print:text-black'
                          : 'text-amber-700 print:text-black'
                      }`}
                    >
                      {r.blocksCompleted > 0 ? `${r.onTimeRate}%` : '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-0.5">
                      Program Benchmark: ≥ 75%
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center print:border print:border-black print:bg-white">
                    <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600 block">
                      Academic Engagement Points
                    </span>
                    <span className="text-2xl font-black text-amber-700 print:text-black block mt-1">
                      {r.totalPoints} Points
                    </span>
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-0.5">
                      Quizzes, Didactics, Advising
                    </span>
                  </div>
                </div>

                {/* Warning Flags if applicable */}
                {r.flags.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl print:border print:border-black print:bg-white print-avoid-break">
                    <span className="text-xs font-black text-red-900 print:text-black block mb-1">
                      Academic & Compliance Warning Triggers:
                    </span>
                    <ul className="list-disc list-inside text-xs text-red-800 print:text-black space-y-0.5 font-medium">
                      {r.flags.map((flag, fIdx) => (
                        <li key={fIdx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weak & Strong Categories (Board Prep Remediation) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-avoid-break">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black mb-2">
                      Identified Subject Growth Areas (Board Exam Prep)
                    </h4>
                    {r.weakCategories.length > 0 ? (
                      <div className="space-y-1.5">
                        {r.weakCategories.map((w, wIdx) => (
                          <div
                            key={wIdx}
                            className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
                              w.percentage < 60
                                ? 'bg-red-50 border-red-200 print:border-black print:bg-white'
                                : 'bg-amber-50 border-amber-200 print:border-black print:bg-white'
                            }`}
                          >
                            <span className="font-bold text-slate-800 print:text-black truncate pr-2">
                              {w.category}
                            </span>
                            <span className="font-black text-slate-900 print:text-black whitespace-nowrap">
                              {w.percentage}% ({w.correct} / {w.total})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No subject category question records logged in this period.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black mb-2">
                      Top Subject Strengths
                    </h4>
                    {r.strongCategories.length > 0 ? (
                      <div className="space-y-1.5">
                        {r.strongCategories.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs flex justify-between items-center print:border-black print:bg-white"
                          >
                            <span className="font-bold text-slate-800 print:text-black truncate pr-2">
                              {s.category}
                            </span>
                            <span className="font-black text-slate-900 print:text-black whitespace-nowrap">
                              {s.percentage}% ({s.correct} / {s.total})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No strong categories logged in this period.</p>
                    )}
                  </div>
                </div>

                {/* Block Submission History & Advising Meetings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-avoid-break">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black mb-2">
                      Curriculum Module Submissions ({r.blockSubmissions.length})
                    </h4>
                    <div className="border border-slate-300 rounded-xl overflow-hidden print:border-black text-xs">
                      {r.blockSubmissions.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 font-bold print:bg-gray-100 border-b border-slate-200 print:border-black">
                            <tr>
                              <th className="py-2 px-2.5">Curriculum Module</th>
                              <th className="py-2 px-2 text-right">Score</th>
                              <th className="py-2 px-2 text-center">Status</th>
                              <th className="py-2 px-2.5 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 print:divide-gray-300">
                            {r.blockSubmissions.slice(0, 8).map((b, bIdx) => (
                              <tr key={bIdx}>
                                <td className="py-1.5 px-2.5 truncate max-w-[170px]" title={b.topic}>
                                  {b.topic}
                                </td>
                                <td className="py-1.5 px-2 text-right font-black">
                                  {b.percentage}%
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      b.timingStatus === 'On-Time'
                                        ? 'bg-emerald-100 text-emerald-800 print:border print:border-black print:bg-white'
                                        : 'bg-amber-100 text-amber-800 print:border print:border-black print:bg-white'
                                    }`}
                                  >
                                    {b.timingStatus}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-right text-slate-500 print:text-black">
                                  {b.date}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-3 text-slate-400 italic">No module submissions recorded in this window.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black mb-2">
                      Faculty Advising & Didactic Attendance ({r.meetings.length + r.attendanceCount})
                    </h4>
                    <div className="border border-slate-300 rounded-xl overflow-hidden print:border-black text-xs">
                      {r.meetings.length > 0 || r.attendanceCount > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 font-bold print:bg-gray-100 border-b border-slate-200 print:border-black">
                            <tr>
                              <th className="py-2 px-2.5">Activity Record</th>
                              <th className="py-2 px-2.5 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 print:divide-gray-300">
                            {r.meetings.map((m, mIdx) => (
                              <tr key={mIdx}>
                                <td className="py-1.5 px-2.5 truncate max-w-[200px]" title={m.topic}>
                                  🧑‍🏫 {m.topic}
                                </td>
                                <td className="py-1.5 px-2.5 text-right text-slate-500 print:text-black">
                                  {m.date}
                                </td>
                              </tr>
                            ))}
                            {r.attendanceCount > 0 && (
                              <tr>
                                <td className="py-1.5 px-2.5 font-semibold text-slate-700 print:text-black">
                                  📋 Didactic Conference Sessions Logged
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 print:text-black">
                                  {r.attendanceCount} Sessions
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-3 text-slate-400 italic">No advising meetings or attendance recorded in this cycle.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Committee Action Plan & Official Sign-off Block */}
                <div className="pt-4 border-t-2 border-slate-900 print:border-black space-y-4 print-avoid-break">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black mb-1">
                      Clinical Competency Committee Action Plan & Study Commitments:
                    </h4>
                    <div className="h-20 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-400 italic print:border-black print:h-24 print:text-gray-500">
                      Document strengths, targeted study goals, milestone trajectory, and remediation commitments...
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-3">
                    <div>
                      <div className="border-b border-slate-500 print:border-black pb-1"></div>
                      <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                        Resident Physician Signature &amp; Date
                      </p>
                    </div>
                    <div>
                      <div className="border-b border-slate-500 print:border-black pb-1"></div>
                      <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                        Faculty Advisor Signature &amp; Date ({formatDisplayName(r.advisor)})
                      </p>
                    </div>
                    <div>
                      <div className="border-b border-slate-500 print:border-black pb-1"></div>
                      <p className="text-[11px] font-bold text-slate-700 print:text-black mt-1">
                        CCC Chairperson Signature &amp; Date
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Master Document Footer */}
        <div className="pt-6 border-t-2 border-slate-900 text-center text-xs text-slate-500 print:text-gray-600 print:border-black">
          <p className="font-bold">
            Ascension St. Vincent&apos;s Family Medicine Residency • Clinical Competency Committee (CCC) Official Document
          </p>
          <p className="text-[10px] mt-0.5">
            Generated on {todayDisplay} • Confidential educational peer-review document protected under medical peer review statutes
          </p>
        </div>
      </div>
    </div>
  );
}
