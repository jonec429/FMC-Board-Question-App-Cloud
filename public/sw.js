// FMC Board Review App — Service Worker (PWA Offline & Push Notifications)
const CACHE_NAME = 'fmc-pwa-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/pwa-icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/brand/program-logo.png',
];

// Installation: Pre-cache application shell & core branding assets
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    }).catch(function (err) {
      console.warn('[SW] Pre-cache warning:', err);
    })
  );
});

// Activation: Clean up old caches and claim clients immediately
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: Strategy-based offline resilience
self.addEventListener('fetch', function (event) {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Never cache API routes or external database requests (Supabase)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 1. Navigation Requests (Page Loads / HTML Shell): Network-First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          // Offline fallback: serve cached root shell or matching URL
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Static Assets (Next.js chunks, icons, brand images, fonts): Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    /\.(woff2?|ttf|otf|png|jpe?g|svg|ico|css|js)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(request).then(function (cachedResponse) {
          const fetchPromise = fetch(request)
            .then(function (networkResponse) {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(function () {
              // Network failed; will return cachedResponse if available
              return cachedResponse;
            });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});

// Push Notifications
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        ...data.data
      }
    };
    
    const promises = [
      self.registration.showNotification(data.title, options)
    ];
    
    if ('setAppBadge' in navigator) {
      promises.push(navigator.setAppBadge(1));
    }
    
    // Delivery Receipt Logic
    if (data.data && data.data.run_id) {
      promises.push(
        self.registration.pushManager.getSubscription().then(function(subscription) {
          if (subscription) {
            return fetch('/api/web-push/receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                run_id: data.data.run_id,
                endpoint: subscription.endpoint,
                title: data.title
              })
            }).catch(err => console.error('[SW] Failed to send push receipt:', err));
          }
        })
      );
    }

    event.waitUntil(Promise.all(promises));
  }
});

// Notification Click Handling
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge();
  }

  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        var clientUrl = new URL(client.url);
        var tUrl = new URL(targetUrl, self.location.origin);
        
        if (clientUrl.href === tUrl.href && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
