'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import QuizEngine from '@/components/QuizEngine';
import CustomBuilderScreen from '@/components/CustomBuilderScreen';
import AdminConsole from '@/components/AdminConsole';
import { Loader2 } from '@/components/AppIcons';
import { withTimeout, withRetry } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useDayChangeReload } from '@/hooks/useDayChangeReload';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Reload the app when it returns to the foreground stale (new day or hidden > 4h)
  useDayChangeReload();

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
    // Clear any PWA notification badges when the app is opened
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(console.error);
    }

    const init = async () => {
      if (envMissing) {
        setInitError('Supabase environment variables are not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings, then redeploy.');
        setLoading(false);
        return;
      }
      // Tag timeout/network errors with which init step they belong to
      // Wrapped in withTimeout so that a hanging request triggers a retry/failure instead of an infinite spinner.
      // 30 second timeout allows free-tier Supabase projects to wake up from paused state.
      const runStep = async <T,>(label: string, op: () => Promise<T>): Promise<T> => {
        try {
          return await withRetry(() => withTimeout(op(), 30000), 1, 1000);
        } catch (err: any) {
          throw new Error(`[${label}] ${err?.message || 'unknown error'}`);
        }
      };

      try {
        const { data: { session } } = (await runStep(
          'getSession',
          () => supabase.auth.getSession()
        )) as any;
        if (session?.user) {
          setUser(session.user);
          // Run sequentially with step labels so a single hung query is identifiable
          await runStep('loadProfile', () => loadProfile(session.user));
          await runStep('loadCurrentBlock', () => loadCurrentBlock());
        }
      } catch (err: any) {
        console.error('App init error:', err);
        setInitError(err?.message || 'Failed to initialize the app. Check your network and Supabase project status.');
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      // init() above already loads the initial session, profile, and block.
      // Per Supabase's docs, never `await` a Supabase call inside this callback —
      // it holds the auth lock and deadlocks getSession on the next refresh (the
      // infinite spinner). Skip the redundant initial event and defer any DB work.
      if (event === 'INITIAL_SESSION') return;
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => {
          loadProfile(session.user).catch((e) => console.error('Profile reload failed:', e));
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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

  useEffect(() => {
    let timer: any;
    if (loading && !showReset) {
      timer = setTimeout(() => setShowReset(true), 5000);
    }
    return () => clearTimeout(timer);
  }, [loading, showReset]);

  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Initializing FMC BRQ App...</p>
          
          {showReset && (
            <div className="mt-8 flex flex-col items-center gap-2 animate-in fade-in duration-500 text-center max-w-xs">
              <p className="text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                Waking up database server...<br/>This can take up to 30 seconds.
              </p>
              <p className="text-slate-400 text-xs mt-2">If it seems permanently stuck:</p>
              <button 
                onClick={() => {
                  window.localStorage.clear();
                  window.sessionStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors text-xs"
              >
                Reset Session & Reload
              </button>
            </div>
          )}
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
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg active:scale-95"
            >
              Reload App
            </button>
            <p className="text-[10px] text-center text-slate-400 font-medium">Warning: Any unsaved quiz progress from the last few seconds may be lost.</p>
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
        <ErrorBoundary fallbackMessage="The dashboard encountered an error.">
          <Dashboard
            user={user}
            profile={profile}
            isActive={!(showBuilder || showAdmin || activeQuiz)}
            onLogout={handleLogout}
            onStartQuiz={(quiz: any) => setActiveQuiz(quiz)}
            onOpenBuilder={() => setShowBuilder(true)}
            onOpenAdmin={() => setShowAdmin(true)}
            onProfileUpdate={(updatedProfile: any) => setProfile(updatedProfile)}
          />
        </ErrorBoundary>
      </div>

      {activeQuiz && (
        <ErrorBoundary fallbackMessage="The quiz engine encountered an error.">
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
        </ErrorBoundary>
      )}

      {showBuilder && (
        <ErrorBoundary fallbackMessage="The custom quiz builder encountered an error.">
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
        </ErrorBoundary>
      )}

      {showAdmin && (
        <ErrorBoundary fallbackMessage="The admin console encountered an error.">
          <AdminConsole user={user} profile={profile} onExit={() => setShowAdmin(false)} />
        </ErrorBoundary>
      )}
    </>
  );
}
