'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, MailIcon, Loader2, Sparkles, Megaphone, X } from './AppIcons';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [showNews, setShowNews] = useState(false);

  const handleSignIn = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    
    // Strict Domain Check
    if (!email.toLowerCase().endsWith('@ascension.org')) {
      setError('Please use your @ascension.org email address.');
      setLoading(false);
      return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      onLogin(data.user);
    }
    setLoading(false);
  };

  const handleSignUp = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    // 1. Strict Domain Check
    if (!cleanEmail.endsWith('@ascension.org')) {
      setError('Registration is restricted to @ascension.org email addresses.');
      setLoading(false);
      return;
    }

    // 2. Check if email is in the pre-approved authorized_roster
    const { data: authorized, error: authError } = await supabase
      .from('authorized_roster')
      .select('name')
      .eq('email', cleanEmail)
      .single();

    if (authError || !authorized) {
      setError('Email not found in the authorized program roster. Please contact Dr. Carbungco.');
      setLoading(false);
      return;
    }

    // 3. Proceed with Supabase Auth Sign Up
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: authorized.name,
        }
      }
    });

    if (error) {
      setError(error.message);
    } else {
      alert('Registration successful! You can now sign in.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 glass-panel">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg shadow-blue-200">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-800">FMC Board Question App</h1>
            <p className="text-slate-500 font-medium">Resident Performance System</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1 px-1">Ascension Email</label>
              <div className="relative">
                <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                  placeholder="name@ascension.org"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1 px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Sign In'}
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-bold">New Resident?</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
            >
              Register Account
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 font-medium leading-relaxed">
            Authorized use only. By signing in, you agree to the program's data privacy and clinical education standards.
          </p>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex justify-center items-center gap-6 text-slate-400">
          <button onClick={() => setShowAI(true)} className="text-xs font-bold hover:text-blue-600 transition-colors flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Disclaimer
          </button>
          <div className="w-1 h-1 bg-slate-300 rounded-full" />
          <button onClick={() => setShowNews(true)} className="text-xs font-bold hover:text-blue-600 transition-colors flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            What's New
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          </button>
        </div>
      </div>

      {/* AI Modal */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowAI(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-all">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">AI Education Disclaimer</h3>
            </div>
            <div className="space-y-4 text-slate-600 leading-relaxed font-medium">
              <p>This application utilizes advanced Large Language Models (LLMs) to assist in clinical education and question explanations.</p>
              <p className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-900 font-bold italic">
                "AI results should be cross-referenced with standard-of-care medical literature."
              </p>
              <p>Clinical decisions should always be based on established guidelines (ABFM/ACOG/AAP) and your professional judgment. We do not store PHI or patient data in this system.</p>
            </div>
            <button onClick={() => setShowAI(false)} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all">
              Understood
            </button>
          </div>
        </div>
      )}

      {/* What's New Modal */}
      {showNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowNews(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-all">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-50 text-yellow-600 rounded-xl">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">What's New in Cloud</h3>
            </div>
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-600 uppercase">Current Version</span>
                  <span className="text-xs font-bold text-slate-400">May 2024</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Full Cloud Migration: The app is now 10x faster and works perfectly on mobile PWAs.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Resident Performance: Real-time scoring and persistent block sessions.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Advanced Admin Console: Enhanced roster management and performance analytics.</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => setShowNews(false)} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
