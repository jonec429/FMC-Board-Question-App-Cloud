'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, CheckCircle, XCircle, AbfmShield, Eye, EyeOff } from '@/components/AppIcons';

export default function AuthCallback() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. Check for errors in query string or hash
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash
        );

        const urlError = searchParams.get('error_description') || 
                         searchParams.get('error') || 
                         hashParams.get('error_description') || 
                         hashParams.get('error');

        if (urlError) {
          if (isMounted) {
            setErrorMessage(decodeURIComponent(urlError.replace(/\+/g, ' ')));
            setStatus('error');
          }
          return;
        }

        // 2. Check for token_hash (direct recovery link)
        const tokenHash = searchParams.get('token_hash');
        const type = (searchParams.get('type') || 'recovery') as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email_change';

        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type,
          });

          if (error) {
            if (isMounted) {
              setErrorMessage(error.message || 'The verification link is invalid or has expired.');
              setStatus('error');
            }
            return;
          }

          if (data?.session && isMounted) {
            setStatus('form');
            return;
          }
        }

        // 3. Check for PKCE auth code
        const code = searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (isMounted) {
              setErrorMessage(error.message || 'Unable to exchange authentication code.');
              setStatus('error');
            }
            return;
          }

          if (data?.session && isMounted) {
            setStatus('form');
            return;
          }
        }

        // 4. Check for active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          setStatus('form');
          return;
        }

        // 5. Listen for auth state change (e.g. PASSWORD_RECOVERY event from hash parse)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (!isMounted) return;
          if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED'))) {
            setStatus('form');
          }
        });

        // 6. Graceful timeout check (give it up to 4.5 seconds for hash parsing or slow mobile connections)
        setTimeout(async () => {
          if (!isMounted) return;
          const { data: { session: finalCheck } } = await supabase.auth.getSession();
          if (finalCheck) {
            setStatus('form');
          } else {
            setStatus(current => (current === 'loading' ? 'error' : current));
            setErrorMessage(current => current || 'The password reset link is invalid, expired, or has already been used. Please request a new one from your login screen or contact your program administrator.');
          }
        }, 4500);

        return () => {
          subscription.unsubscribe();
        };

      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || 'An unexpected error occurred while processing the reset link.');
          setStatus('error');
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setErrorMessage(updateError.message);
        setLoading(false);
      } else {
        setStatus('success');
        setLoading(false);
        // Redirect to dashboard after 2.5s
        setTimeout(() => {
          window.location.href = '/';
        }, 2500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update password. Please try again.');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[32px] shadow-2xl border border-slate-100 max-w-sm w-full text-center flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h2 className="text-xl font-black text-slate-800">Verifying Reset Link</h2>
          <p className="text-slate-400 text-xs mt-2 font-medium">Please wait while we validate your credentials...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Unable to Reset Password</h1>
          <p className="text-slate-500 mb-8 font-medium text-sm leading-relaxed">
            {errorMessage || 'The password reset link is invalid or has expired. Please request a new one.'}
          </p>
          <div className="flex flex-col gap-3">
            <a href="/" className="w-full inline-block py-3.5 px-6 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all text-sm">
              Return to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Password Updated!</h1>
          <p className="text-slate-500 mb-6 font-bold text-sm">Your new password is set. Redirecting you to the dashboard...</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 animate-[progress_2.5s_linear_forwards]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full relative">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl text-white mb-4">
            <AbfmShield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">Set New Password</h1>
          <p className="text-slate-400 text-xs mt-1 font-bold">Create a new secure password for your account.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password (min 6 characters)"
              className="w-full pl-12 pr-12 py-3.5 bg-slate-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-base"
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
              className="w-full pl-12 pr-12 py-3.5 bg-slate-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-base"
              required
              minLength={6}
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-red-600 rounded-full shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password.length < 6}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
