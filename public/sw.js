const CACHE_NAME = 'tati-ai-v1';
const API_CACHE_NAME = 'tati-ai-api-v1';
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
      .catch(() => {
        // Se falhar both cache e network, retorna página offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Mensagem do SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});