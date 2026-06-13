'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AbfmShield, Lock, MailIcon, Loader2, Info, HelpCircle, XCircle, X, Eye, EyeOff, Smartphone } from './AppIcons';
import { withTimeout } from '@/lib/utils';
import InstallAppModal from './InstallAppModal';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [changelog, setChangelog] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const res = await fetch('/api/changelog');
        const data = await res.json();
        if (data.updates) setChangelog(data.updates);
      } catch (err) {
        console.error('Failed to fetch changelog');
      }
    };
    fetchChangelog();
  }, []);

  const isEmailValid = email.toLowerCase().endsWith('@ascension.org');
  const showEmailError = email.length > 5 && !isEmailValid;

  const passwordsMatch = password === confirmPassword;
  const isSignupValid = isEmailValid && password.length >= 6 && passwordsMatch && firstName.trim() !== '' && lastName.trim() !== '';
  const isSigninValid = isEmailValid && password.length > 0;

  const handleSignIn = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    if (!isEmailValid) {
      setError('Please use your @ascension.org email address.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) setError(error.message);
      else onLogin(data.user);
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail.endsWith('@ascension.org')) {
      setError('Registration is restricted to @ascension.org email addresses.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your first and last name.');
      setLoading(false);
      return;
    }

    // Securely check authorized roster via API
    let authorized = null;
    try {
      const res = await fetch('/api/auth/verify-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        authorized = data.user;
      }
    } catch (err) {
      console.error('Error verifying roster:', err);
    }

    if (!authorized) {
      setError('Email not found in the authorized program roster. Please contact Dr. Carbungco.');
      setLoading(false);
      return;
    }

    try {
      const { data: signUpData, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              first_name: firstName.trim(),
              last_name: lastName.trim()
            }
          },
        })
      );

      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Create/Update profile explicitly to be sure
        await withTimeout(
          supabase.from('profiles').upsert({
            id: signUpData.user?.id,
            email: cleanEmail,
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            pgy: authorized.pgy,
            role: authorized.role || (authorized.pgy === 'Faculty' ? 'faculty' : 'resident')
          })
        );

        setError('');
        alert('Registration successful! You can now sign in.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !isEmailValid) {
      setError('Please enter a valid @ascension.org email address first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        })
      );
      if (error) setError(error.message);
      else alert('Password reset link sent to your email.');
    } catch (err: any) {
      setError(err?.message || 'Could not send reset link. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-stretch sm:items-center justify-center sm:p-6 font-sans text-slate-800">
      <div className="bg-white w-full max-h-[100dvh] shadow-2xl border border-slate-200 flex flex-col rounded-none sm:rounded-3xl sm:max-w-sm relative">
        <div className="flex flex-col flex-1 px-6 pt-8 pb-6 sm:px-8 sm:pt-8 sm:pb-6 relative animate-fade-in overflow-y-auto min-h-0">

          {/* Branding */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-xl text-white mb-3">
              <AbfmShield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">FMC Board Review App</h1>
            <p className="text-slate-400 text-xs mt-1 leading-snug">
              Ascension St. Vincent's Family Medicine Residency Program Jacksonville
            </p>
          </div>

          {/* Form */}
          <form id="fmc-login-form" onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="flex flex-col gap-2.5 flex-1 justify-center">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                  required
                />
              </div>
            )}
            
            <div>
              <div className="relative">
                <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Email Address"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 transition-all text-base ${showEmailError ? 'border-2 border-red-500 focus:ring-red-200' : 'focus:ring-blue-500'}`}
                  required
                />
              </div>
              {showEmailError && (
                <div className="flex items-center gap-1 mt-2 text-red-600 text-xs font-bold animate-fade-in">
                  <XCircle className="w-4 h-4" /> Please use your @ascension.org email
                </div>
              )}
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="Password"
                className="w-full pl-12 pr-12 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-base"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {mode === 'signup' && (
              <div className="relative animate-fade-in">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-12 pr-12 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}
            {mode === 'signup' && password.length > 0 && password.length < 6 && (
              <div className="flex items-center gap-1 text-amber-600 text-xs font-bold animate-fade-in pl-2">
                <Info className="w-4 h-4" /> Password must be at least 6 characters
              </div>
            )}
            {mode === 'signup' && confirmPassword.length > 0 && !passwordsMatch && (
              <div className="flex items-center gap-1 text-amber-600 text-xs font-bold animate-fade-in pl-2">
                <Info className="w-4 h-4" /> Passwords do not match
              </div>
            )}

            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-right text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
              >
                Forgot Password?
              </button>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signin' ? !isSigninValid : !isSignupValid)}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base mt-1 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'signin' ? 'Sign In' : 'Register'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors mt-1"
            >
              {mode === 'signin' ? 'Create an Account →' : '← Already registered? Sign in'}
            </button>
          </form>

          {/* Install-on-phone prompt */}
          <button
            type="button"
            onClick={() => setShowInstall(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 rounded-2xl font-bold text-xs transition-all"
          >
            <Smartphone className="w-4 h-4" />
            Install this app on your phone
          </button>

          {/* Bottom links */}
          <div className="mt-4 flex items-center justify-center gap-6">
            <button onClick={() => setShowAI(true)} className="flex items-center gap-1.5 text-amber-600/80 hover:text-amber-600 transition-colors text-[11px] font-bold py-1">
              <Info className="w-3.5 h-3.5" /> AI Disclaimer
            </button>
            <button onClick={() => setShowNews(true)} className="flex items-center gap-1.5 text-slate-400 hover:text-blue-500 transition-colors text-[11px] font-bold py-1">
              <HelpCircle className="w-3.5 h-3.5" /> What's New
            </button>
          </div>

          {/* Program logo — small, below the form & links for brand continuity */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/program-logo.png"
              alt="Ascension St. Vincent's Family Medicine Residency"
              className="w-32 max-w-full h-auto opacity-70"
            />
          </div>
        </div>
      </div>

      {/* AI Disclaimer Modal */}
      {showAI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-slate-800">AI Education Disclaimer</h3>
              <button onClick={() => setShowAI(false)} className="p-1 text-slate-400 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 mb-6">
              <p>This application uses Large Language Models (LLMs) to assist with question explanations and clinical education.</p>
              <p className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900 italic text-xs">
                AI results should be cross-referenced with standard-of-care medical literature.
              </p>
              <p>Clinical decisions should always be based on established guidelines (AAFP/ACOG/AAP) and your professional judgment. No PHI is stored in this system.</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowAI(false)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What's New Modal */}
      {showNews && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-slate-800">What's New</h3>
              <button onClick={() => setShowNews(false)} className="p-1 text-slate-400 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 mb-6 max-h-96 overflow-y-auto">
              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Latest Updates</div>
              {changelog.length > 0 ? (
                <ul className="space-y-3">
                  {changelog.map((update, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                      <span className="leading-snug">{update}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Loading latest improvements...</p>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowNews(false)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install App Modal */}
      {showInstall && <InstallAppModal onClose={() => setShowInstall(false)} />}
    </div>
  );
}
