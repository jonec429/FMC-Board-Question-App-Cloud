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
 * @param isBlocked - Set to true when an active quiz or examination is underway,
 *                    preventing an automatic reload from blowing away progress.
 */
export function useDayChangeReload(isBlocked: boolean = false) {
  useEffect(() => {
    const mountDay = new Date().toLocaleDateString();
    let hiddenAt = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }

      // Never disrupt an active exam/quiz session with an automatic reload
      if (isBlocked) {
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
  }, [isBlocked]);
}
