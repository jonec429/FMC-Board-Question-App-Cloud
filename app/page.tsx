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
import { User, Profile, Block, Question, Result } from '@/lib/types';
import { Session } from '@supabase/supabase-js';

interface ActiveQuizState {
  isQotd?: boolean;
  qotdQuestion?: Question;
  isQotdCompleted?: boolean;
  qotdAttempt?: Result;
  quizId?: string;
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
import { User, Profile, Block, Question, Result } from '@/lib/types';
import { Session } from '@supabase/supabase-js';

interface ActiveQuizState {
  isQotd?: boolean;
  qotdQuestion?: Question;
  isQotdCompleted?: boolean;
  qotdAttempt?: Result;
  quizId?: string;
  topic?: string;
  questionIds?: string[];
  categories?: string[];
  keywords?: string[];
  years?: string[];
  pool?: 'all' | 'unused' | 'incorrect';
  count?: number;
  timerEnabled?: boolean;
  forceNew?: boolean;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuizState | null>(null);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Reload the app when it returns to the foreground stale (new day or hidden > 4h)
  useDayChangeReload();

  // Sanity check: warn loudly if Supabase env vars never got wired up
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const envMissing = !supabaseUrl || !supabaseKey;

  const loadProfile = async (sessionUser: User) => {
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
        first_name: '',
        last_name: '',
        <ErrorBoundary fallbackMessage="The admin console encountered an error.">
          <AdminConsole user={user} profile={profile} onExit={() => setShowAdmin(false)} />
        </ErrorBoundary>
      )}
    </>
  );
}




