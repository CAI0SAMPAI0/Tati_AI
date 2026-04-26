const SW_VERSION = 'v3';
const STATIC_CACHE = `tati-static-${SW_VERSION}`;
const RUNTIME_CACHE = `tati-runtime-${SW_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/activities.html',
  '/quiz.html',
  '/chat.html',
  '/dashboard.html',
  '/manifest.json',
  '/styles/global.css',
  '/styles/login.css',
  '/styles/activities.css',
  '/styles/quiz.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/i18n.js',
  '/js/pwa.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(STATIC_ASSETS.map(async (asset) => {
      try {
        await cache.add(asset);
      } catch (_) {
        // Alguns assets podem não existir em todos os ambientes.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const runtime = await caches.open(RUNTIME_CACHE);
        runtime.put(request, networkResponse.clone());
        return networkResponse;
      } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/index.html');
      }
    })());
    return;
  }

  const destination = request.destination;
  const isFreshAsset = destination === 'style' || destination === 'script' || destination === 'document';

  if (isFreshAsset) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          const runtime = await caches.open(RUNTIME_CACHE);
          runtime.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (_) {
        const cached = await caches.match(request);
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const runtime = await caches.open(RUNTIME_CACHE);
        runtime.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {};
  }

  const title = payload.title || 'Teacher Tati';
  const body = payload.body || 'Você recebeu uma nova notificação.';
  const url = payload.url || '/activities.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/activities.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url.includes(targetUrl));
      if (existing && 'focus' in existing) {
        return existing.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
