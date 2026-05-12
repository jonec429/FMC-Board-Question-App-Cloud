'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import QuizEngine from '@/components/QuizEngine';
import CustomBuilderScreen from '@/components/CustomBuilderScreen';
import AdminConsole from '@/components/AdminConsole';
import { Loader2 } from '@/components/AppIcons';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const loadProfile = async (sessionUser: any) => {
    // Try to find an existing profile row first
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (profileData && (profileData.pgy || profileData.full_name)) {
      setProfile(profileData);
      return;
    }

    // Fallback: synthesize a profile from authorized_roster
    const { data: rosterData } = await supabase
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
    const { data: bData } = await supabase
      .from('block_schedule')
      .select('*')
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle();
    setCurrentBlock(bData);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await Promise.all([loadProfile(session.user), loadCurrentBlock()]);
      }
      setLoading(false);
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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Initializing FMC Cloud...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (activeQuiz) {
    return (
      <QuizEngine
        user={user}
        quizId={activeQuiz.quizId}
        topic={activeQuiz.topic}
        categories={activeQuiz.categories}
        years={activeQuiz.years}
        count={activeQuiz.count || 40}
        currentBlock={currentBlock}
        onComplete={() => setActiveQuiz(null)}
        onCancel={() => setActiveQuiz(null)}
      />
    );
  }

  if (showBuilder) {
    return (
      <CustomBuilderScreen
        onStart={(config) => {
          setShowBuilder(false);
          setActiveQuiz({
            topic: 'Mixed Review Block',
            categories: config.categories.length > 0 ? config.categories : undefined,
            years: config.years.length > 0 ? config.years : undefined,
            count: config.count,
          });
        }}
        onCancel={() => setShowBuilder(false)}
      />
    );
  }

  if (showAdmin) {
    return <AdminConsole onExit={() => setShowAdmin(false)} />;
  }

  return (
    <Dashboard
      user={user}
      profile={profile}
      currentBlock={currentBlock}
      onLogout={handleLogout}
      onStartQuiz={(quiz: any) => setActiveQuiz(quiz)}
      onOpenBuilder={() => setShowBuilder(true)}
      onOpenAdmin={() => setShowAdmin(true)}
    />
  );
}
