'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, CheckCircle, AlertCircle, Loader2, Shield, FileText, Smartphone } from './AppIcons';
import { DataTable } from './DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface NotificationManagerProps {
  user?: any;
  profile?: any;
}

type TabState = 'manager' | 'registrations' | 'audit';

export default function NotificationManager({ user, profile }: NotificationManagerProps) {
  const [activeTab, setActiveTab] = useState<TabState>('manager');

  // Global Broadcast state
  const [totalSubscribed, setTotalSubscribed] = useState<number>(0);
  const [broadcastTitle, setBroadcastTitle] = useState('FMC Board Review Announcement');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ success: boolean; message: string } | null>(null);

  // Device Tester state
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [publicVapidKey, setPublicVapidKey] = useState<string>('');

  // Audit Data State
  const [auditData, setAuditData] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    setPublicVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');
    fetchSubscriptionCount();
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    checkActiveSubscription();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'audit' || activeTab === 'registrations') {
      fetchAuditData();
    }
  }, [activeTab]);

  const fetchSubscriptionCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('/api/web-push/send', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch count');
      const data = await response.json();
      setTotalSubscribed(data.count || 0);
    } catch (err) {
      console.error('Error fetching subscription count:', err);
    }
  };

  const fetchAuditData = async () => {
    setAuditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('/api/admin/push-audit', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch audit data');
      const data = await response.json();
      setAuditData(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const checkActiveSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in your browser.');
      return;
    }
    if (!publicVapidKey) {
      alert('VAPID public key is missing. Ensure NEXT_PUBLIC_VAPID_PUBLIC_KEY is configured.');
      return;
    }

    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        if (permission !== 'granted') throw new Error('Permission not granted for notifications');

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });

        const subJson = subscription.toJSON();
        await supabase.from('web_push_subscriptions').insert({
          user_id: user?.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        });
        setPushEnabled(true);
      }
      fetchSubscriptionCount();
    } catch (err: any) {
      console.error('Push registration error:', err);
      alert(err.message || 'Failed to update push preferences.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) return;
    setTestLoading(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active auth session found');

      const response = await fetch('/api/web-push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: 'FMC Board Review App Test Push',
          body: 'Success! Your device is registered and push notifications are working properly.',
          targetUserId: user.id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test notification');

      setTestResult({
        success: true,
        message: `Test push sent! Results: ${data.counts?.sent || 0} sent, ${data.counts?.failed || 0} failed.`
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to trigger test push.' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      alert('Both Title and Message are required for broadcasting.');
      return;
    }

    setBroadcastLoading(true);
    setBroadcastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active auth session');

      const response = await fetch('/api/web-push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send broadcast');

      setBroadcastResult({
        success: true,
        message: `Broadcast complete! Recipient summary: ${data.counts?.sent || 0} sent, ${data.counts?.failed || 0} failed, ${data.counts?.expired || 0} expired (deleted).`
      });
      setBroadcastBody('');
      fetchSubscriptionCount();
    } catch (err: any) {
      setBroadcastResult({ success: false, message: err.message || 'Failed to dispatch broadcast.' });
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Compute registration list
  let registrationList = [];
  if (auditData?.roster && auditData?.subscriptions) {
    const subEmails = new Set(auditData.subscriptions.map((s: any) => s.email?.toLowerCase()));
    registrationList = auditData.roster.map((r: any) => ({
      ...r,
      isRegistered: subEmails.has(r.email?.toLowerCase())
    })).sort((a: any, b: any) => (a.isRegistered === b.isRegistered ? 0 : a.isRegistered ? -1 : 1));
  }

  const registrationColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'full_name',
      header: 'Name',
      cell: info => info.row.original.full_name || info.row.original.email,
    },
    {
      accessorKey: 'pgy_level',
      header: 'PGY',
      cell: info => (
        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: row => row.isRegistered,
      header: 'Status',
      cell: info => {
        const isRegistered = info.getValue() as boolean;
        return isRegistered ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Registered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" /> Missing
          </span>
        );
      },
    },
  ], []);

  const auditColumns: ColumnDef<any>[] = useMemo(() => [
    {
      id: 'timestamp',
      accessorFn: row => new Date(row.executed_at).getTime(),
      header: 'Timestamp',
      cell: info => (
        <span className="text-slate-500 text-xs font-semibold">
          {new Date(info.row.original.executed_at).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'cron_name',
      header: 'Job Name',
      cell: info => (
        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-widest">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      id: 'message',
      accessorFn: row => `${row.details?.title} ${row.details?.body}`,
      header: 'Message',
      cell: info => {
        const row = info.row.original;
        return (
          <div className="min-w-[250px]">
            <div className="font-bold text-slate-900">{row.details?.title || 'System Broadcast'}</div>
            <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{row.details?.body || '-'}</div>
          </div>
        );
      },
    },
    {
      id: 'dispatch_stats',
      accessorFn: row => row.details?.sent || 0,
      header: 'Dispatch Stats',
      cell: info => {
        const row = info.row.original;
        return (
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-600 font-bold">Sent: {row.details?.sent || 0}</span>
            <span className="text-red-500 font-bold">Failed: {row.details?.failed || 0}</span>
          </div>
        );
      },
    },
    {
      id: 'receipts',
      accessorFn: row => {
        const runId = row.details?.run_id;
        const logReceipts = runId ? (auditData?.receipts || []).filter((r: any) => r.run_id === runId) : [];
        return logReceipts.length;
      },
      header: 'Receipts Confirmed',
      cell: info => {
        const row = info.row.original;
        const runId = row.details?.run_id;
        const logReceipts = runId ? (auditData?.receipts || []).filter((r: any) => r.run_id === runId) : [];
        const sent = row.details?.sent || 0;
        const confirmed = logReceipts.length;
        const pct = sent > 0 ? Math.round((confirmed / sent) * 100) : 0;
        return runId ? (
          <div className="flex flex-col items-center">
            <span className={`text-lg font-black tracking-tighter ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {confirmed} <span className="text-sm font-bold text-slate-400">/ {sent}</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{pct}% Arrival</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-bold">No Run ID</span>
        );
      },
    },
  ], [auditData]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-black uppercase tracking-widest mb-1.5">
              <Shield className="w-4 h-4" /> System Administrator Tools
            </div>
            <h1 className="text-3xl font-black tracking-tight">Push Notification Hub</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl font-medium">
              Manage resident web push subscriptions, send manual announcement broadcasts, or view push delivery audits.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center shrink-0">
            <div className="text-3xl font-black tracking-tight">{totalSubscribed}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-100 mt-0.5">
              Total Subscribed Devices
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex shadow-inner border border-slate-200/50 overflow-x-auto">
        <button
          onClick={() => setActiveTab('manager')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'manager' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Megaphone className="w-4 h-4" /> Push Manager
        </button>
        <button
          onClick={() => setActiveTab('registrations')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'registrations' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Smartphone className="w-4 h-4" /> Registrations
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" /> Delivery Logs
        </button>
      </div>

      {activeTab === 'manager' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">📱</span>
                Device Setup & Tester
              </h2>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Verify your current browser registration and trigger a direct test notification to this specific screen.
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3.5 border border-slate-100 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">Browser Permissions:</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  permissionStatus === 'granted' ? 'bg-emerald-100 text-emerald-800' : permissionStatus === 'denied' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>{permissionStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">Push Subscription:</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  pushEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>{pushEnabled ? 'Active' : 'Not Subscribed'}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {permissionStatus !== 'granted' && (
                <button onClick={handleRequestPermission} className="flex-1 px-5 py-3 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all text-sm active:scale-95 shadow-md shadow-amber-100">
                  Request Permission
                </button>
              )}
              <button onClick={handleTogglePush} disabled={pushLoading} className={`flex-1 px-5 py-3 font-bold rounded-2xl transition-all text-sm active:scale-95 shadow-md flex items-center justify-center gap-2 ${
                  pushEnabled ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                }`}>
                {pushLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {pushEnabled ? 'Remove Subscription' : 'Subscribe This Device'}
              </button>
              <button onClick={handleSendTestNotification} disabled={!pushEnabled || testLoading} className="flex-1 px-5 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-40 transition-all text-sm active:scale-95 shadow-md shadow-indigo-100 flex items-center justify-center gap-2">
                {testLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Test
              </button>
            </div>
            {testResult && (
              <div className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />}
                <div className="font-bold leading-normal">{testResult.message}</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">📢</span>
                Manual Broadcast Dispatch
              </h2>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Send a text-based push notification instantly to all registered devices in the program.
              </p>
            </div>
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Notification Title</label>
                <input type="text" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Title" className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800 bg-slate-50/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Message Body</label>
                <textarea value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="Type notification message here..." rows={3} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800 bg-slate-50/50" />
              </div>
              <button type="submit" disabled={broadcastLoading || totalSubscribed === 0} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-40 transition-all text-sm active:scale-95 shadow-lg flex items-center justify-center gap-2">
                {broadcastLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting...</> : <><Megaphone className="w-4 h-4" /> Dispatch Announcement Broadcast</>}
              </button>
            </form>
            {broadcastResult && (
              <div className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${broadcastResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                {broadcastResult.success ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />}
                <div className="font-bold leading-normal">{broadcastResult.message}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'registrations' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-black text-slate-800">Resident Device Registration Status</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Cross-referenced against the current authorized roster</p>
          </div>
          {auditLoading ? (
            <div className="p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <DataTable 
              columns={registrationColumns} 
              data={registrationList} 
              globalSearchPlaceholder="Search registrations..."
            />
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-black text-slate-800">Push Notification Delivery Logs</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Logs of all push notification dispatches (last 30 days)</p>
          </div>
          {auditLoading ? (
            <div className="p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <DataTable 
              columns={auditColumns} 
              data={auditData?.logs || []} 
              globalSearchPlaceholder="Search logs..."
            />
          )}
        </div>
      )}
    </div>
  );
}
