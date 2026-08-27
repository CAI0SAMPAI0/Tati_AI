const CACHE_NAME = 'tati-ai-v2.3.1';
const API_CACHE_NAME = 'tati-ai-api-v2.3.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/chat.html',
  '/activities.html',
  '/quiz.html',
  '/simulation.html',
  '/achievements.html',
  '/competitions.html',
  '/progress.html',
  '/profile.html',
  '/payment.html',
  '/settings.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/chat.js',
  '/js/chat_footer.js',
  '/js/dashboard.js',
  '/js/activities_ui.js',
  '/js/quiz.js',
  '/js/simulation.js',
  '/js/achievements.js',
  '/js/competitions.js',
  '/js/progress.js',
  '/js/profile.js',
  '/js/payment.js',
  '/js/settings.js',
  '/js/notifications.js',
  '/js/onboarding.js',
  '/js/script.js',
  '/js/i18n.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/toastify-js'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Intercepta requisições
self.addEventListener('fetch', event => {
  // Ignora requisições de WebSocket
  if (event.request.url.includes('ws://') || event.request.url.includes('wss://')) {
    return;
  }

  // Ignora requisições de APIs externas (não cacheamos)
  if (event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 1. REQUISIÇÕES DE NAVEGAÇÃO (PÁGINAS HTML): Network-First
  // Evita que páginas como index.html, dashboard.html e login fiquem presas em cache antigo
  if (event.request.mode === 'navigate' || event.request.url.endsWith('.html') || event.request.url === self.location.origin + '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => cached || caches.match('/'));
        })
    );
    return;
  }

  // 2. OUTROS RECURSOS ESTÁTICOS (css, js, imagens, fontes): Cache-First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Cache miss - fetch from network
        return fetch(event.request).then(response => {
          // Don't cache API responses
          if (event.request.url.includes('/api/') || event.request.url.includes('/activities/')) {
            return response;
          }

          // Evita cachear respostas HTML dinâmicas
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            return response;
          }

          // Cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        });
      })
  );
});

// Mensagem do SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { body: event.data.text() };
    }
  }

  const origin = self.location.origin;
  const rawIcon = data.icon || '/icons/icon-192x192.png';
  const iconUrl = rawIcon.startsWith('http') ? rawIcon : `${origin}${rawIcon.startsWith('/') ? '' : '/'}${rawIcon}`;
  const badgeUrl = `${origin}/icons/badge-96x96.png`;

  const title = data.title || 'Teacher Tatiana';
  const options = {
    body: data.body || data.message || 'You have a new study notification!',
    icon: iconUrl,
    badge: badgeUrl,
    vibrate: [200, 100, 200],
    tag: data.tag || 'tati-notification',
    renotify: true,
    data: {
      url: data.url || data.link || '/activities',
      ...data,
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetPath = event.notification.data?.url || '/activities';
  const urlToOpen = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});