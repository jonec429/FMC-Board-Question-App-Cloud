'use client';

import { useEffect } from 'react';

// 4 hours in milliseconds
const STALE_HIDDEN_MS = 4 * 60 * 60 * 1000;

/**
 * Reloads the page when it returns to the foreground and is likely stale — either
 * the local calendar day changed (QOTD and dashboard data roll over daily) or the
 * tab was hidden for more than 4 hours. PWAs can be suspended in the background for
 * long stretches, so this guards against stale UI on resume.
 *
 * Centralizes what used to be two separate visibilitychange listeners: a day-change
 * reload here and a 4-hour stale-tab reload in app/page.tsx.
 */
export function useDayChangeReload() {
  useEffect(() => {
    const mountDay = new Date().toLocaleDateString();
    let hiddenAt = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const dayChanged = new Date().toLocaleDateString() !== mountDay;
      const longHidden = hiddenAt > 0 && Date.now() - hiddenAt > STALE_HIDDEN_MS;
      if (dayChanged || longHidden) {
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
