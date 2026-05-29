self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
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

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge();
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
