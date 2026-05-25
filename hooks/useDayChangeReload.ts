'use client';

import { useEffect } from 'react';

/**
 * Hook that automatically reloads the page if the app is brought to the foreground
 * and the local day has changed since the component was mounted.
 * This is especially useful for PWAs where the app can be suspended in the background
 * overnight, leading to stale QOTD and dashboard state.
 */
export function useDayChangeReload() {
  useEffect(() => {
    // Record the day the component mounted
    const mountDay = new Date().toLocaleDateString();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentDay = new Date().toLocaleDateString();
        if (currentDay !== mountDay) {
          console.log('Day changed while in background. Reloading to fetch fresh QOTD and data.');
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
