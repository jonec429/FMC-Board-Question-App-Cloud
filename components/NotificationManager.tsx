'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Megaphone, CheckCircle, AlertCircle, Loader2, Shield
} from './AppIcons';

interface NotificationManagerProps {
  user?: any;
  profile?: any;
}

export default function NotificationManager({ user, profile }: NotificationManagerProps) {
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

  useEffect(() => {
    // 1. Get vapid public key from env
    setPublicVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');

    // 2. Fetch total subscriptions count
    fetchSubscriptionCount();

    // 3. Check browser permissions and active subscription
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    checkActiveSubscription();
  }, [user]);

  const fetchSubscriptionCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/web-push/send', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch count');
      const data = await response.json();
      setTotalSubscribed(data.count || 0);
    } catch (err) {
      console.error('Error fetching subscription count:', err);
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
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          // Remove from backend
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        setPushEnabled(false);
      } else {
        // Request browser permission first
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        if (permission !== 'granted') {
          throw new Error('Permission not granted for notifications');
        }

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });

        // Save to backend
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
          title: 'FMC QBank Test Push',
          body: 'Success! Your device is registered and push notifications are working properly.',
          targetUserId: user.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      setTestResult({
        success: true,
        message: `Test push sent! Results: ${data.counts?.sent || 0} sent, ${data.counts?.failed || 0} failed.`
      });
    } catch (err: any) {
      console.error('Test push error:', err);
      setTestResult({
        success: false,
        message: err.message || 'Failed to trigger test push.'
      });
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
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      setBroadcastResult({
        success: true,
        message: `Broadcast complete! Recipient summary: ${data.counts?.sent || 0} sent, ${data.counts?.failed || 0} failed, ${data.counts?.expired || 0} expired (deleted).`
      });
      setBroadcastBody('');
      fetchSubscriptionCount();
    } catch (err: any) {
      console.error('Broadcast error:', err);
      setBroadcastResult({
        success: false,
        message: err.message || 'Failed to dispatch broadcast.'
      });
    } finally {
      setBroadcastLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-black uppercase tracking-widest mb-1.5">
              <Shield className="w-4 h-4" /> System Administrator Tools
            </div>
            <h1 className="text-3xl font-black tracking-tight">Push Notification Hub</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl font-medium">
              Manage resident web push subscriptions, send manual announcement broadcasts, or run push delivery tests on your current device.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Tester Column */}
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
                permissionStatus === 'granted'
                  ? 'bg-emerald-100 text-emerald-800'
                  : permissionStatus === 'denied'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {permissionStatus}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">Push Subscription:</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                pushEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {pushEnabled ? 'Active' : 'Not Subscribed'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {permissionStatus !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="flex-1 px-5 py-3 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all text-sm active:scale-95 shadow-md shadow-amber-100"
              >
                Request Permission
              </button>
            )}

            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`flex-1 px-5 py-3 font-bold rounded-2xl transition-all text-sm active:scale-95 shadow-md flex items-center justify-center gap-2 ${
                pushEnabled
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {pushLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {pushEnabled ? 'Remove Subscription' : 'Subscribe This Device'}
            </button>

            <button
              onClick={handleSendTestNotification}
              disabled={!pushEnabled || testLoading}
              className="flex-1 px-5 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-40 transition-all text-sm active:scale-95 shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {testLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Test Notification
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              )}
              <div className="font-bold leading-normal">{testResult.message}</div>
            </div>
          )}
        </div>

        {/* Global Broadcast Center Column */}
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
              <label htmlFor="broadcast-title" className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Notification Title
              </label>
              <input
                id="broadcast-title"
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800 bg-slate-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="broadcast-body" className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Message Body
              </label>
              <textarea
                id="broadcast-body"
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Type notification message here..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800 bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              disabled={broadcastLoading || totalSubscribed === 0}
              className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-40 transition-all text-sm active:scale-95 shadow-lg flex items-center justify-center gap-2"
            >
              {broadcastLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Broadcasting...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4" /> Dispatch Announcement Broadcast
                </>
              )}
            </button>
          </form>

          {broadcastResult && (
            <div className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${
              broadcastResult.success
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {broadcastResult.success ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              )}
              <div className="font-bold leading-normal">{broadcastResult.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
