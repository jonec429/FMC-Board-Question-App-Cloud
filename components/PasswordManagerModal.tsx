'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X,
  Lock,
  Key,
  Mail,
  Loader2,
  CheckCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  AlertCircle
} from './AppIcons';

interface PasswordManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    full_name: string;
    first_name?: string;
    last_name?: string;
    email: string;
    has_account: boolean;
    profile_id?: string;
    pgy?: string;
    role?: string;
  } | null;
}

export default function PasswordManagerModal({ isOpen, onClose, member }: PasswordManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'link' | 'email'>('manual');
  
  // Manual set password states
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');
  const [manualError, setManualError] = useState('');
  const [copiedInstructions, setCopiedInstructions] = useState(false);

  // Generate direct link states
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Send reset email states
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [emailError, setEmailError] = useState('');

  if (!isOpen || !member) return null;

  const firstName = member.first_name || member.full_name?.split(' ')[0] || 'Resident';

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Fmc' + Math.floor(100 + Math.random() * 900) + '!';
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setManualSuccessMsg('');
    setManualError('');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setManualError('Password must be at least 6 characters.');
      return;
    }

    setIsSettingPassword(true);
    setManualError('');
    setManualSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'set_password',
          email: member.email,
          userId: member.profile_id,
          password: newPassword,
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update password');
      }

      setManualSuccessMsg(data.message || 'Password updated successfully!');
    } catch (err: any) {
      setManualError(err?.message || 'Failed to set password');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const copyLoginMessage = () => {
    const message = `Hi ${firstName}, your FMC Board Question App password has been reset to: ${newPassword}\n\nYou can log in at https://brq.stvfamilymed.org using your ${member.email} email address. You can change this password at any time inside Settings.`;
    navigator.clipboard.writeText(message);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2500);
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    setLinkError('');
    setGeneratedLink('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'generate_link',
          email: member.email,
          userId: member.profile_id,
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate reset link');
      }

      setGeneratedLink(data.directLink);
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to generate reset link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyDirectLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendResetEmail = async () => {
    setIsSendingEmail(true);
    setEmailError('');
    setEmailSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'send_reset_email',
          email: member.email,
          userId: member.profile_id,
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setEmailSuccessMsg(data.message || `Reset email sent to ${member.email}!`);
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to send reset email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-[36px] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                Manage Password & Access
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {member.full_name}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                  {member.email}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Status Banner */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">Account Status:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
              member.has_account
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${member.has_account ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              {member.has_account ? 'Active App User' : 'Pending Registration'}
            </span>
          </div>
          {member.pgy && (
            <span className="text-slate-400 font-semibold">{member.pgy}</span>
          )}
        </div>

        {/* Body content */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6">
          {!member.has_account ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-amber-900 dark:text-amber-200">
                    User Has Not Created an Account Yet
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                    {member.full_name} is on the authorized program roster, but hasn&apos;t registered their account yet. Password overrides and reset links require an active Supabase user account.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const subject = encodeURIComponent("Invitation to the FMC Board Question App");
                        const body = encodeURIComponent(
                          `Hi ${firstName},\n\nYou are invited to access the FMC Board Question App! Please visit the link below and click 'Create an Account' using your ${member.email} email address:\n\nhttps://brq.stvfamilymed.org\n\nBest,\nJonathan Carbungco, MD`
                        );
                        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${member.email}&su=${subject}&body=${body}`, '_blank');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      Send Registration Invitation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'manual'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  Set Password
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('link')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'link'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Direct Link
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'email'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send Email
                </button>
              </div>

              {/* TAB 1: MANUAL SET PASSWORD */}
              {activeTab === 'manual' && (
                <form onSubmit={handleSetPassword} className="space-y-4 animate-fade-in">
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
                    <span className="font-bold">Instant Password Override:</span> Sets a new password directly in the database. The resident can log in immediately without opening any email or clicking links.
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                        New Password
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate Temp Password
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setManualSuccessMsg('');
                          setManualError('');
                        }}
                        placeholder="e.g. Ascension2026!"
                        required
                        minLength={6}
                        className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono font-bold text-slate-800 dark:text-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {manualError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                      {manualError}
                    </div>
                  )}

                  {manualSuccessMsg && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        {manualSuccessMsg}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs">
                        Copy the pre-formatted text below to send directly to {firstName} via Teams, text, or email:
                      </p>
                      <button
                        type="button"
                        onClick={copyLoginMessage}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        {copiedInstructions ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedInstructions ? 'Copied to Clipboard!' : 'Copy Login Instructions'}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSettingPassword || newPassword.length < 6}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isSettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set New Password'}
                  </button>
                </form>
              )}

              {/* TAB 2: DIRECT RESET LINK */}
              {activeTab === 'link' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800 dark:text-white">One-Time Recovery Link:</span> Generates a direct URL that lets the resident set their own password immediately. Send this link directly via Microsoft Teams, SMS, or private email to bypass Ascension hospital spam filters.
                  </div>

                  {!generatedLink ? (
                    <button
                      type="button"
                      onClick={handleGenerateLink}
                      disabled={isGeneratingLink}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      {isGeneratingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Direct Reset Link'}
                    </button>
                  ) : (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Reset Link Generated!
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs break-all select-all text-slate-700 dark:text-slate-300 max-h-24 overflow-y-auto">
                        {generatedLink}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={copyDirectLink}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedLink ? 'Link Copied!' : 'Copy Direct Link'}
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateLink}
                          disabled={isGeneratingLink}
                          className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  {linkError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                      {linkError}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SEND RESET EMAIL */}
              {activeTab === 'email' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800 dark:text-white">Email Notification:</span> Dispatches the password recovery email to <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{member.email}</span>.
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      Note: If Ascension hospital firewalls quarantine the automated email, use the <strong>&quot;Set Password&quot;</strong> or <strong>&quot;Direct Link&quot;</strong> tab instead.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={isSendingEmail}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Password Reset Email'}
                  </button>

                  {emailSuccessMsg && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      {emailSuccessMsg}
                    </div>
                  )}

                  {emailError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                      {emailError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
