'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import QuizEngine from '@/components/QuizEngine';
import CustomBuilderScreen from '@/components/CustomBuilderScreen';
import AdminConsole from '@/components/AdminConsole';
import { Loader2 } from '@/components/AppIcons';
import { withTimeout } from '@/lib/utils';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Sanity check: warn loudly if Supabase env vars never got wired up
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const envMissing = !supabaseUrl || !supabaseKey;

  const loadProfile = async (sessionUser: any) => {
    // Try to find an existing profile row first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Profile fetch failed: ${profileError.message}`);
    }

    if (profileData && (profileData.pgy || profileData.full_name)) {
      setProfile(profileData);
      return;
    }

    // Fallback: synthesize a profile from authorized_roster
    const { data: rosterData, error: rosterError } = await supabase
      .from('authorized_roster')
      .select('name, pgy, advisor')
      .eq('email', sessionUser.email)
      .maybeSingle();

    if (rosterData) {
      setProfile({
        id: sessionUser.id,
        email: sessionUser.email,
        full_name: profileData?.full_name || rosterData.name,
        pgy: rosterData.pgy,
        advisor: rosterData.advisor,
        role: profileData?.role || (rosterData.pgy === 'Faculty' ? 'faculty' : 'resident'),
      });
    } else {
      setProfile(profileData || null);
    }
  };

  const loadCurrentBlock = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: bData, error } = await supabase
      .from('block_schedule')
      .select('*')
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle();
      
    if (error) {
      throw new Error(`Block fetch failed: ${error.message}`);
    }
    setCurrentBlock(bData);
  };

  useEffect(() => {
    const init = async () => {
      if (envMissing) {
        setInitError('Supabase environment variables are not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings, then redeploy.');
        setLoading(false);
        return;
      }
      // Tag timeout/network errors with which init step they belong to
      const runStep = async <T,>(label: string, op: Promise<T>, timeoutMs = 20000): Promise<T> => {
        try {
          return await withTimeout(op, timeoutMs);
        } catch (err: any) {
          throw new Error(`[${label}] ${err?.message || 'unknown error'}`);
        }
      };

      try {
        const { data: { session } } = (await runStep(
          'getSession',
          supabase.auth.getSession(),
          10000 // 10s timeout for session check - if it takes longer, the refresh token request is hanging
        )) as any;
        if (session?.user) {
          setUser(session.user);
          // Run sequentially with step labels so a single hung query is identifiable
          await runStep('loadProfile', loadProfile(session.user), 20000);
          await runStep('loadCurrentBlock', loadCurrentBlock(), 20000);
        }
      } catch (err: any) {
        console.error('App init error:', err);
        const isGetSessionHang = err?.message?.includes('[getSession]');
        if (isGetSessionHang && typeof window !== 'undefined') {
          // If the session refresh request hangs, the auth token is likely corrupted or the Supabase auth service is sluggish.
          // Treat it as an expired session: clear the tokens and route them to the login screen.
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith('sb-')) keysToRemove.push(key);
            }
            keysToRemove.forEach((k) => window.localStorage.removeItem(k));
          } catch {}
          setLoading(false);
          return; // They will be routed to <Login /> because user is null
        }
        setInitError(err?.message || 'Failed to initialize the app. Check your network and Supabase project status.');
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 5000);
    } catch (e) {
      console.error('Logout error (signOut timed out or failed):', e);
      // If signOut hangs or fails, force-clear auth tokens
      // (same recovery pattern used in init() for getSession hangs)
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('sb-')) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {}
    } finally {
      setUser(null);
      setProfile(null);
      // Hard reload to ensure all auth state is fully cleared
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Initializing FMC BRQ App...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-100 shadow-sm">
          <h2 className="text-xl font-black text-red-600 mb-3">App Failed to Start</h2>
          <p className="text-sm text-slate-700 mb-4 font-medium">{initError}</p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-xs text-slate-500 leading-relaxed">
            <p className="font-bold text-slate-600 mb-1">Common causes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Supabase project paused (free tier auto-pauses)</li>
              <li>Missing or incorrect Vercel environment variables</li>
              <li>Network connectivity issue</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg active:scale-95"
            >
              Retry
            </button>
            <button
              onClick={() => {
                window.localStorage.clear();
                window.sessionStorage.clear();
                window.location.reload();
              }}
              className="flex-1 px-5 py-3 bg-white text-red-600 font-bold border-2 border-red-100 rounded-xl hover:bg-red-50 transition-all shadow-sm active:scale-95"
            >
              Reset Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <>
      <div style={{ display: (showBuilder || showAdmin || activeQuiz) ? 'none' : 'block' }}>
        <Dashboard
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onStartQuiz={(quiz: any) => setActiveQuiz(quiz)}
          onOpenBuilder={() => setShowBuilder(true)}
          onOpenAdmin={() => setShowAdmin(true)}
          onProfileUpdate={(updatedProfile: any) => setProfile(updatedProfile)}
        />
      </div>

      {activeQuiz && (
        <QuizEngine
          user={user}
          isQotd={activeQuiz.isQotd}
          qotdQuestion={activeQuiz.qotdQuestion}
          isQotdCompleted={activeQuiz.isQotdCompleted}
          qotdAttempt={activeQuiz.qotdAttempt}
          quizId={activeQuiz.quizId}
          topic={activeQuiz.topic}
          questionIds={activeQuiz.questionIds}
          categories={activeQuiz.categories}
          keywords={activeQuiz.keywords}
          years={activeQuiz.years}
          pool={activeQuiz.pool}
          count={activeQuiz.count || 40}
          timerEnabled={activeQuiz.timerEnabled}
          currentBlock={currentBlock}
          onComplete={() => setActiveQuiz(null)}
          onCancel={() => setActiveQuiz(null)}
        />
      )}

      {showBuilder && (
        <CustomBuilderScreen
          user={user}
          onStart={(config) => {
            setShowBuilder(false);
            setActiveQuiz({
              topic: 'Mixed Review Block',
              categories: config.categories.length > 0 ? config.categories : undefined,
              years: config.years.length > 0 ? config.years : undefined,
              count: config.count,
              pool: config.pool,
              timerEnabled: config.timerEnabled,
            });
          }}
          onCancel={() => setShowBuilder(false)}
        />
      )}

      {showAdmin && (
        <AdminConsole user={user} profile={profile} onExit={() => setShowAdmin(false)} />
      )}
    </>
  );
}
