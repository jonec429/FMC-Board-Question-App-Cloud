'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { X, Loader2, CheckCircle, Lock, MailIcon, Sparkles } from './AppIcons';

// Public VAPID key
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

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

  // Push notification states
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  React.useEffect(() => {
    // Check if push is enabled
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in your browser.');
      return;
    }

    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          // Remove from backend
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        setPushEnabled(false);
      } else {
        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });

        // Save to backend
        const subJson = subscription.toJSON();
        await supabase.from('web_push_subscriptions').insert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        });
        setPushEnabled(true);
      }
    } catch (err: any) {
      console.error('Push error:', err);
      alert('Failed to update push preferences. Make sure you have allowed notifications in your browser.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNameSuccess(false);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // Helper: tag timeout/network errors with which step they belong to.
    // Default 10s is enough for most calls; pass a longer timeout for steps
    // known to be slow (e.g., Supabase upserts that re-evaluate RLS on return).
    const runStep = async <T,>(label: string, op: Promise<T> | PromiseLike<T>, timeoutMs = 10000): Promise<T> => {
      try {
        return await withTimeout(op, timeoutMs);
      } catch (err: any) {
        throw new Error(`[${label}] ${err?.message || 'unknown error'}`);
      }
    };

    try {
      // 1. Update profiles table — THE actual save the app cares about.
      // Promoted to first because Step 2 (auth metadata, below) is known to
      // hang in certain session states and is not load-bearing for this app.
      // Longer timeout (30s) because the upsert can be slow on Supabase free
      // tier — the row write itself succeeds quickly, but the response that
      // re-reads it through RLS sometimes takes 10–20s on cold starts.
      const { error: profileError } = (await runStep(
        'profiles row',
        supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          }),
        30000
      )) as any;
      if (profileError) throw new Error(`[profiles row] ${profileError.message}`);

      // [REMOVED 2026-05-14] supabase.auth.updateUser was previously called
      // here to keep user_metadata in sync with the profiles row. It has
      // been removed because:
      //   1. This app reads names exclusively from the profiles table
      //      (formatDisplayName operates on full_name).
      //   2. auth.updateUser hangs reliably in some session states. Even
      //      as a fire-and-forget call it leaves the supabase-js client in
      //      a refresh-token retry loop that corrupts localStorage, so the
      //      next getSession() on page reload also hangs.
      //   3. The only theoretical loss is Supabase's built-in email
      //      template interpolation (e.g., "Hi {{first_name}}" in password
      //      reset emails) — which this app doesn't customize.
      // If user_metadata sync is ever needed (custom email templates,
      // social login, Edge Functions reading JWT claims), re-add with a
      // proper error-handling / refresh-token-recovery strategy.

      // 3. Update authorized_roster — best-effort, logged but non-fatal
      try {
        const { error: rosterError } = (await runStep(
          'Step 3 / authorized_roster',
          supabase
            .from('authorized_roster')
            .update({ name: fullName })
            .eq('email', user.email)
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

          {/* Notifications Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notifications</h3>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Receive reminders for the Question of the Day</p>
              </div>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${pushEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

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
