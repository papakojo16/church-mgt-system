const CACHE = 'mtolivet-v35';
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/favicon.png', '/icons/icon-192.png', '/icons/icon-512.png'];
const OFFLINE_FALLBACK = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mt.Olivet Methodist Church</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f6fb;color:#1a1a2e;text-align:center;padding:1rem}h1{font-size:1.4rem;margin-bottom:.5rem}button{margin-top:1rem;padding:.6rem 1.6rem;border:none;border-radius:8px;background:#1e88e5;color:#fff;font-size:1rem;cursor:pointer}</style></head><body><div><h1>Mt. Olivet Methodist Church</h1><p>You are offline. Please check your internet connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('text/html')) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
            }
          }
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((c) => c || new Response(OFFLINE_FALLBACK, { headers: { 'Content-Type': 'text/html' } }))
        )
    );
    return;
  }

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
        .catch(() => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
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
