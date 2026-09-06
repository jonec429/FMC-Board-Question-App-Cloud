'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { X, Loader2, CheckCircle, Lock, MailIcon, Sparkles, Eye, EyeOff, Sun, Moon } from './AppIcons';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';
import { useTheme } from '@/context/ThemeContext';

// Public VAPID key
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface ProfileSettingsProps {
  user: any;
  profile: any;
  onClose: () => void;
  onProfileUpdate: (updatedProfile: any) => void;
}

export default function ProfileSettings({ user, profile, onClose, onProfileUpdate }: ProfileSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [firstName, setFirstName] = useState(profile?.first_name || profile?.full_name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(profile?.last_name || profile?.full_name?.split(' ').slice(1).join(' ') || '');
  const [designation, setDesignation] = useState(profile?.pgy || '');

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
  const [showPassword, setShowPassword] = useState(false);

  // Push notification states
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [notificationPreferences, setNotificationPreferences] = useState({
    qotd: profile?.notification_preferences?.qotd ?? true,
    qotd_reminder: profile?.notification_preferences?.qotd_reminder ?? true,
    block_reminders: profile?.notification_preferences?.block_reminders ?? true,
    faculty_digest: profile?.notification_preferences?.faculty_digest ?? true,
  });

  const handleTogglePreference = async (key: keyof typeof notificationPreferences) => {
    const newPrefs = { ...notificationPreferences, [key]: !notificationPreferences[key] };
    setNotificationPreferences(newPrefs);
    
    try {
      await supabase
        .from('profiles')
        .update({ notification_preferences: newPrefs })
        .eq('id', user.id);
        
      onProfileUpdate({ ...profile, notification_preferences: newPrefs });
    } catch (err) {
      console.error('Failed to save preference:', err);
      // Revert on failure
      setNotificationPreferences(notificationPreferences);
    }
  };

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
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        // Convert subscription keys
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        
        let p256dhBase64: string | null = null;
        if (p256dh) {
          const arr = new Uint8Array(p256dh);
          let binary = '';
          for (let i = 0; i < arr.byteLength; i++) {
            binary += String.fromCharCode(arr[i]);
          }
          p256dhBase64 = btoa(binary);
        }

        let authBase64: string | null = null;
        if (auth) {
          const arr = new Uint8Array(auth);
          let binary = '';
          for (let i = 0; i < arr.byteLength; i++) {
            binary += String.fromCharCode(arr[i]);
          }
          authBase64 = btoa(binary);
        }

        // Save to backend
        const { error: subError } = await supabase.from('web_push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: p256dhBase64,
          auth: authBase64
        }, { onConflict: 'endpoint' });

        if (subError) throw subError;
        setPushEnabled(true);
      }
    } catch (err) {
      console.error('Push error:', err);
      alert('Failed to update push subscription. Please check notification permissions.');
    } finally {
      setPushLoading(false);
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNameSuccess(false);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const runStep = async <T,>(label: string, op: Promise<T> | PromiseLike<T>, timeoutMs = 10000): Promise<T> => {
      try {
        return await withTimeout(op, timeoutMs);
      } catch (err: any) {
        throw new Error(`[${label}] ${err?.message || 'unknown error'}`);
      }
    };

    try {
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
            pgy: designation.trim() || null,
          }),
        30000
      )) as any;
      if (profileError) throw new Error(`[profiles row] ${profileError.message}`);

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
        pgy: designation.trim() || null,
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
      setPasswordError('Passwords do not match.');
      setSavingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      console.error('Password change error:', err);
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-[40px] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Profile & Settings</h2>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-7 custom-scrollbar">
          
          {/* Appearance & Theme Section */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Appearance & Theme
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Light Theme */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-center transition-all ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Light</div>
                  <div className="text-[10px] opacity-70">Clean & crisp</div>
                </div>
              </button>

              {/* Dark Theme */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-center transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-slate-800 text-white shadow-sm ring-2 ring-blue-400/30 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-700 text-blue-300 flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Dark</div>
                  <div className="text-[10px] opacity-70">Charcoal slate</div>
                </div>
              </button>

              {/* Midnight Theme */}
              <button
                type="button"
                onClick={() => setTheme('midnight')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-center transition-all ${
                  theme === 'midnight'
                    ? 'border-indigo-500 bg-midnight-900 text-white shadow-sm ring-2 ring-indigo-500/40 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-midnight-700 text-indigo-300 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Midnight</div>
                  <div className="text-[10px] opacity-70">Deep OLED black</div>
                </div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Name Section */}
          <form onSubmit={handleSaveName} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personal Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block">Designation (PGY, Faculty, Fellow, etc.)</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Faculty, Fellow, PGY-1, Class of 2026"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 mb-1 block">Email</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 italic">Email changes require admin assistance.</p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-900/40">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : nameSuccess ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Changes'}
            </button>
          </form>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* View As Section (Super Admin Only) */}
          {((user?.email && SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) || profile?.role === 'admin') && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-purple-500" />
                Admin Tools: View As
              </h3>
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Role Impersonation</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">See the app exactly as a resident or faculty member would. Resets on refresh.</p>
                </div>
                <select
                  value={profile?.view_as || 'admin'}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    onProfileUpdate({ ...profile, view_as: newRole === 'admin' ? null : newRole });
                  }}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-sm rounded-xl outline-none focus:ring-2 focus:ring-purple-500 shrink-0"
                >
                  <option value="admin">Admin (Default)</option>
                  <option value="faculty">Faculty</option>
                  <option value="resident">Resident</option>
                </select>
              </div>
            </div>
          )}

          {/* Divider */}
          {((user?.email && SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) || profile?.role === 'admin') && (
            <div className="border-t border-slate-100 dark:border-slate-800" />
          )}

          {/* Notifications Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notifications</h3>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Push Notifications</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Enable push notifications on this device</p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${pushEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {pushEnabled && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Question of the Day</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Morning alert when the new question opens</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('qotd')}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${notificationPreferences.qotd ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationPreferences.qotd ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">QOTD Reminder</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Midday reminder if you haven't answered</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('qotd_reminder')}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${notificationPreferences.qotd_reminder ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationPreferences.qotd_reminder ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Block Reminders</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Alerts for upcoming block deadlines</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('block_reminders')}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${notificationPreferences.block_reminders ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationPreferences.block_reminders ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {(profile?.role === 'faculty' || profile?.role === 'admin') && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Faculty Digest</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Weekly summary of resident performance</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePreference('faculty_digest')}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${notificationPreferences.faculty_digest ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationPreferences.faculty_digest ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Password Section */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Change Password</h3>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-500 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-500 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {passwordError && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-900/40">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword || newPassword.length < 6}
              className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : passwordSuccess ? <><CheckCircle className="w-4 h-4" /> Updated!</> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
