'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { X, Loader2, CheckCircle, Lock, MailIcon } from './AppIcons';

interface ProfileSettingsProps {
  user: any;
  profile: any;
  onClose: () => void;
  onProfileUpdate: (updatedProfile: any) => void;
}

export default function ProfileSettings({ user, profile, onClose, onProfileUpdate }: ProfileSettingsProps) {
  // Name fields
  const [firstName, setFirstName] = useState(profile?.first_name || profile?.full_name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(profile?.last_name || profile?.full_name?.split(' ').slice(1).join(' ') || '');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNameSuccess(false);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      // 1. Update auth metadata (10s timeout — auth updates are the most common hang point)
      const { error: authError } = (await withTimeout(
        supabase.auth.updateUser({
          data: {
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        }),
        10000
      )) as any;
      if (authError) throw new Error(`Auth update failed: ${authError.message}`);

      // 2. Update profiles table
      const { error: profileError } = (await withTimeout(
        supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          }),
        10000
      )) as any;
      if (profileError) throw new Error(`Profile update failed: ${profileError.message}`);

      // 3. Update authorized_roster — best-effort, logged but non-fatal
      try {
        const { error: rosterError } = (await withTimeout(
          supabase
            .from('authorized_roster')
            .update({ name: fullName })
            .eq('email', user.email),
          10000
        )) as any;
        if (rosterError) console.warn('Roster name sync failed (non-fatal):', rosterError);
      } catch (rosterErr) {
        console.warn('Roster name sync failed (non-fatal):', rosterErr);
      }

      onProfileUpdate({
        ...profile,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      setSavingPassword(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-800">Profile Settings</h2>
            <p className="text-xs font-bold text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Name Section */}
          <form onSubmit={handleSaveName} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">Email</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-slate-100 rounded-xl border border-slate-100 text-slate-400 font-bold cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1 italic">Email changes require admin assistance.</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : nameSuccess ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Changes'}
            </button>
          </form>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Password Section */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Change Password</h3>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                required
              />
            </div>

            {passwordError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword || newPassword.length < 6}
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : passwordSuccess ? <><CheckCircle className="w-4 h-4" /> Updated!</> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
