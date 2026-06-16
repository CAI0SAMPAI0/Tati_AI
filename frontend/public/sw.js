const CACHE_NAME = 'tati-static-v3';
const STATIC_ASSETS = ['/', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve(true);
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Nunca cachear requests autenticadas/sensíveis.
  if (request.headers.has('authorization')) return;
  if (request.method !== 'GET') return;
  
  // Ignora chamadas de API, auth, chat e outros serviços dinâmicos
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/auth') || 
    url.pathname.startsWith('/chat')
  ) {
    return;
  }

  // 1. REQUISIÇÕES DE NAVEGAÇÃO (PÁGINAS HTML): Network-First
  // Garante que páginas como /login, /dashboard e home nunca fiquem presas em cache antigo se houver internet
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Se estiver offline, serve a página do cache
          return caches.match(request);
        })
    );
    return;
  }

  // 2. OUTROS RECURSOS ESTÁTICOS (css, js, chunks, imagens, fontes): Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        
        // Evita cachear respostas HTML que possam vir como fetch (ex: data/HTML dinâmico)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});

