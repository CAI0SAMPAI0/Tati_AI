const CACHE_NAME = 'tati-ai-v2.1.6';
const STATIC_ASSETS = ['/', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        const promises = STATIC_ASSETS.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn(`[Service Worker] Failed to cache static asset: ${asset}`, err);
          });
        });
        return Promise.all(promises);
      })
      .then(() => self.skipWaiting()),
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
  
  // Ignora esquemas não-HTTP (ex: ws://, wss://, capacitor://, chrome-extension://, etc.)
  if (!request.url.startsWith('http:') && !request.url.startsWith('https:')) {
    return;
  }

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
          // Se estiver offline, tenta servir do cache. Se não estiver cacheado, serve uma página offline amigável.
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Teacher Tati AI</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background-color: #0a0b0d;
                    color: #f3f4f6;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                    padding: 20px;
                    box-sizing: border-box;
                  }
                  .card {
                    background-color: #121318;
                    border: 1px solid #222530;
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 440px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                  }
                  h1 {
                    color: #6366f1;
                    font-size: 24px;
                    margin-top: 0;
                    font-weight: 800;
                  }
                  p {
                    font-size: 15px;
                    line-height: 1.6;
                    color: #9ca3af;
                    margin-bottom: 24px;
                  }
                  .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 28px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    transition: transform 0.2s, opacity 0.2s;
                    border: none;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                  }
                  .btn:hover {
                    transform: translateY(-1px);
                    opacity: 0.95;
                  }
                  .icon {
                    font-size: 56px;
                    margin-bottom: 20px;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon">📶</div>
                  <h1>Connection Lost</h1>
                  <p>You are currently offline. Please check your internet connection and try reloading the page.</p>
                  <a href="javascript:window.location.reload(true)" class="btn">Try to Reconnect</a>
                </div>
              </body>
              </html>`,
              {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            );
          });
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

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.json();
    const title = data.title || 'Teacher Tati';
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Error handling push event:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});


