const CACHE = 'mtolivet-v33';
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/favicon.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // Cache each shell asset individually so a single missing file can't
        // abort the whole install (which would leave the app on a stale worker).
        await Promise.allSettled(SHELL.map((url) => cache.add(url).catch(() => {})));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, fall back to cached app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((c) => c || caches.match('/')))
    );
    return;
  }

  // Everything else (assets + API GETs): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Display a push notification (used when the app subscribes to web push). The
// page can also trigger this directly via registration.showNotification().
self.addEventListener('push', (event) => {
  let data = { title: 'Mt. Olivet Methodist', body: '', url: '/' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    // Non-JSON payload: treat the raw text as the body.
    const text = event.data ? event.data.text() : '';
    if (text) data.body = text;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || '/' },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

// Tapping a notification focuses an existing app window or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
