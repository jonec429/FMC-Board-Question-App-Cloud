'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister
 * Automatically registers the PWA service worker on initial application load.
 * Enables offline shell caching and Web Push notifications for all users.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register after page load so it doesn't compete with critical path hydration
      const handleLoad = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Check for service worker updates
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      console.log('[SW] New version available and installed.');
                    } else {
                      console.log('[SW] Content cached for offline use.');
                    }
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[SW] Service worker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }
  }, []);

  return null;
}
