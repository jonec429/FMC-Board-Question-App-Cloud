'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, CheckCircle, Eye, EyeOff, AbfmShield, Key } from './AppIcons';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function ForcePasswordChangeModal({ isOpen, onSuccess }: ForcePasswordChangeModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          must_reset_password: false,
        }
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-[36px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-800 p-8 sm:p-10 relative">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <Key className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            Create Your New Password
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 font-medium leading-relaxed">
            You signed in using a temporary password. Please choose a secure, private password to secure your account.
          </p>
        </div>

        {success ? (
          <div className="py-6 flex flex-col items-center text-center animate-fade-in">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Password Updated!</h3>
            <p className="text-slate-400 text-xs mt-1">Entering your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New Password (min 6 characters)"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-sm font-bold text-slate-800 dark:text-white border border-transparent dark:border-slate-700"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-sm font-bold text-slate-800 dark:text-white border border-transparent dark:border-slate-700"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-200 dark:border-red-900/50">
                <div className="w-2 h-2 bg-red-600 rounded-full shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 6}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
