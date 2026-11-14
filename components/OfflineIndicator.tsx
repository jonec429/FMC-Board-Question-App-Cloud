'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

interface OfflineIndicatorProps {
  onReconnected?: () => void;
}

/**
 * OfflineIndicator
 * Provides real-time network awareness. Surfaces reassurance to residents in hospital dead zones
 * that their answers and progress are being safely buffered on their device.
 */
export default function OfflineIndicator({ onReconnected }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onReconnectedRef = useRef(onReconnected);
  onReconnectedRef.current = onReconnected;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      onReconnectedRef.current?.();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setIsOnline(false);
      setShowReconnected(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setIsOnline(true);
        onReconnectedRef.current?.();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (!isOnline) {
    return (
      <div 
        role="status" 
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-500/95 text-white text-xs md:text-sm font-medium rounded-full shadow-lg backdrop-blur-sm border border-amber-400 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
        <span>Offline Mode — Answers are safely saved to your device</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div 
        role="status" 
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-emerald-600/95 text-white text-xs md:text-sm font-medium rounded-full shadow-lg backdrop-blur-sm border border-emerald-500 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span>Connection restored — Syncing progress...</span>
      </div>
    );
  }

  return null;
}
