'use client';

import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, Target, CheckCircle, GraduationCap, ChevronRight, PlusCircle, Trash2 } from './AppIcons';
import { getCurrentAcademicYear, formatAcademicYear, derivePGY, isActiveResident } from '@/lib/academicYear';

interface TransitionWizardProps {
  roster: any[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function TransitionWizard({ roster, onClose, onRefresh }: TransitionWizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const academicYear = getCurrentAcademicYear();

  // PGY3s identified as those with derivePGY >= 3 and still active
  const graduatingResidents = useMemo(() => {
    return roster.filter(r => isActiveResident(r) && r.cohort_year && derivePGY(r.cohort_year, academicYear) >= 3);
  }, [roster, academicYear]);

  const [newIncoming, setNewIncoming] = useState([{ first_name: '', last_name: '', email: '', advisor: '' }]);

  const handleAddIncomingRow = () => {
    setNewIncoming([...newIncoming, { first_name: '', last_name: '', email: '', advisor: '' }]);
  };

  const handleUpdateIncoming = (index: number, field: string, value: string) => {
    const updated = [...newIncoming];
    updated[index] = { ...updated[index], [field]: value };
    setNewIncoming(updated);
  };

  const handleRemoveIncomingRow = (index: number) => {
    const updated = [...newIncoming];
    updated.splice(index, 1);
    setNewIncoming(updated);
  };

  const handleGraduatePGY3s = async () => {
    if (graduatingResidents.length === 0) {
      setStep(2);
      return;
    }
    
    setSubmitting(true);
    try {
      const emails = graduatingResidents.map(r => r.email);
      
      const updatePromise = supabase
        .from('authorized_roster')
        .update({ 
          status: 'graduated', 
          graduated_year: academicYear 
        })
        .in('email', emails);
        
      const { error } = await Promise.race([
        updatePromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Database timeout. Please check your connection or database schema.')), 10000))
      ]);

      if (error) throw error;
      await onRefresh();
      setStep(2);
    } catch (err: any) {
      console.error('Transition error:', err);
      alert(err.message || 'Error graduating residents');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnboardIncoming = async () => {
    const validRows = newIncoming.filter(r => r.first_name.trim() && r.last_name.trim() && r.email.trim());
    if (validRows.length === 0) {
      onClose(); // Just exit if none to add
      return;
    }

    setSubmitting(true);
    try {
      // For PGY1 in this academic year, cohort_year should be (academicYear - 1).
      // They will graduate in academicYear + 2.
      const cohortYear = academicYear - 1;
      const gradYear = academicYear + 2;
      const pgyLabel = `Class of ${gradYear}`;

      const inserts = validRows.map(row => ({
        name: `${row.first_name.trim()} ${row.last_name.trim()}`,
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        email: row.email.trim().toLowerCase(),
        advisor: row.advisor.trim(),
        pgy: pgyLabel,
        cohort_year: cohortYear,
        track: 'family_medicine',
        status: 'active'
      }));

      const { error } = await supabase.from('authorized_roster').insert(inserts);
      if (error) throw error;

      await onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error onboarding incoming class');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Academic Year Transition</h2>
              <p className="text-sm font-bold text-slate-500">Entering {formatAcademicYear(academicYear)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Wizard Progress */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <div className={`flex-1 py-4 text-center font-bold text-sm ${step === 1 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>1. Graduate PGY3s</div>
          <div className={`flex-1 py-4 text-center font-bold text-sm ${step === 2 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>2. Auto-Advance</div>
          <div className={`flex-1 py-4 text-center font-bold text-sm ${step === 3 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>3. Onboard PGY1s</div>
        </div>

        {/* Step 1: Graduate PGY3s */}
        {step === 1 && (
          <div className="p-8 space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-blue-800 text-sm font-medium">
              We identified <strong>{graduatingResidents.length}</strong> active residents whose derived PGY level is 3 or higher. Click below to mark them as graduated. They will no longer appear in active performance metrics.
            </div>
            {graduatingResidents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {graduatingResidents.map(r => (
                  <div key={r.email} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{r.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{r.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleGraduatePGY3s}
                disabled={submitting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {graduatingResidents.length > 0 ? 'Graduate Selected Residents' : 'Skip (None to Graduate)'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Auto-Advance Info */}
        {step === 2 && (
          <div className="p-8 space-y-6 flex flex-col items-center justify-center text-center py-16">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
              <Target className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800">Seamless Auto-Advance</h3>
            <p className="text-slate-500 max-w-lg text-lg">
              Because FMC Board Review App uses a cohort-based schema, <strong>PGY1s and PGY2s have automatically advanced</strong> to their next year based on the current date. No database updates are required!
            </p>
            <div className="pt-8">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg"
              >
                Next: Onboard PGY1s <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Onboard PGY1s */}
        {step === 3 && (
          <div className="p-8 space-y-6">
            <p className="text-slate-600 font-medium">
              Enter the incoming PGY1 class. You can also skip this and add them individually later via the Roster Manager or CSV import.
            </p>
            
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-bold text-slate-500 w-1/4">First Name</th>
                    <th className="px-4 py-3 font-bold text-slate-500 w-1/4">Last Name</th>
                    <th className="px-4 py-3 font-bold text-slate-500 w-1/4">Email</th>
                    <th className="px-4 py-3 font-bold text-slate-500 w-1/4">Faculty Advisor</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newIncoming.map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.first_name}
                          onChange={(e) => handleUpdateIncoming(i, 'first_name', e.target.value)}
                          placeholder="First"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-medium"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.last_name}
                          onChange={(e) => handleUpdateIncoming(i, 'last_name', e.target.value)}
                          placeholder="Last"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-medium"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="email"
                          value={row.email}
                          onChange={(e) => handleUpdateIncoming(i, 'email', e.target.value)}
                          placeholder="email@ascension.org"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-medium"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.advisor}
                          onChange={(e) => handleUpdateIncoming(i, 'advisor', e.target.value)}
                          placeholder="Dr. Lastname"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-medium"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleRemoveIncomingRow(i)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleAddIncomingRow}
              className="text-indigo-600 font-bold flex items-center gap-2 hover:text-indigo-700 transition-colors text-sm px-2"
            >
              <PlusCircle className="w-4 h-4" /> Add another row
            </button>

            <div className="flex justify-between items-center pt-8 mt-4 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOnboardIncoming}
                disabled={submitting}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-200"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Complete Transition
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
