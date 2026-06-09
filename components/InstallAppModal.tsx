'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X, CheckCircle } from './AppIcons';

type Platform = 'ios' | 'android' | 'other';

function NumberBadge({ n, tone }: { n: number; tone: string }) {
  return (
    <span className={`shrink-0 w-5 h-5 mt-0.5 rounded-full flex items-center justify-center text-[11px] font-black ${tone}`}>
      {n}
    </span>
  );
}

/**
 * "Install on your phone" how-to. Explains adding the PWA to the home screen on
 * both iOS (Safari → Share → Add to Home Screen) and Android (Chrome → ⋮ → Install).
 * Auto-detects the visitor's platform to highlight the relevant steps, and shows a
 * confirmation instead if the app is already running as an installed PWA.
 * Shared by the Login screen and the resident Dashboard.
 */
export default function InstallAppModal({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>('other');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/iPad|iPhone|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('other');

    // Already opened from the home screen as an installed app?
    const standalone =
      (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && (navigator as any).standalone === true);
    setInstalled(!!standalone);
  }, []);

  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 sticky top-0 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-black text-lg text-slate-800">Install on your phone</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-4 space-y-4">
          {installed ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl p-4 text-green-700">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold">You&apos;re all set — this app is already installed on this device.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">
              Add the app to your home screen for one-tap, full-screen access — no App Store needed. You&apos;ll also be
              able to get <strong>Question of the Day</strong> reminders.
            </p>
          )}

          {/* iPhone & iPad */}
          <div className={`rounded-2xl border p-4 ${isIOS ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-black text-slate-800 text-sm">iPhone &amp; iPad</h4>
              {isIOS && (
                <span className="text-[9px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Your device
                </span>
              )}
            </div>
            <ol className="space-y-2.5 text-sm text-slate-600">
              <li className="flex gap-2.5 items-start"><NumberBadge n={1} tone="bg-blue-100 text-blue-700" /><span>Open this page in <strong>Safari</strong> (Apple&apos;s browser).</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={2} tone="bg-blue-100 text-blue-700" /><span>Tap the <strong>Share</strong> button — the square with an arrow pointing up.</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={3} tone="bg-blue-100 text-blue-700" /><span>Scroll down and tap <strong>Add to Home Screen</strong>.</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={4} tone="bg-blue-100 text-blue-700" /><span>Tap <strong>Add</strong> in the top-right corner.</span></li>
            </ol>
          </div>

          {/* Android */}
          <div className={`rounded-2xl border p-4 ${isAndroid ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-black text-slate-800 text-sm">Android</h4>
              {isAndroid && (
                <span className="text-[9px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Your device
                </span>
              )}
            </div>
            <ol className="space-y-2.5 text-sm text-slate-600">
              <li className="flex gap-2.5 items-start"><NumberBadge n={1} tone="bg-green-100 text-green-700" /><span>Open this page in <strong>Chrome</strong>.</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={2} tone="bg-green-100 text-green-700" /><span>Tap the <strong>⋮</strong> menu (three dots) in the top-right.</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={3} tone="bg-green-100 text-green-700" /><span>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</span></li>
              <li className="flex gap-2.5 items-start"><NumberBadge n={4} tone="bg-green-100 text-green-700" /><span>Tap <strong>Install</strong> to confirm.</span></li>
            </ol>
          </div>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            Once installed, open the app from your home screen like any other app.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
