#!/bin/bash

# Script de build para Teacher Tati com suporte PWA

echo "🚀 Iniciando build do Teacher Tati com suporte PWA..."

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p public/icons
mkdir -p public/screenshots

# Gerar ícones PWA
echo "🎨 Gerando ícones PWA..."
node pwa/create-pwa-icons.js

# Copiar arquivos estáticos
echo "📋 Copiando arquivos estáticos..."
cp -r frontend/* public/

# Otimizar imagens (se imagem-optimizer estiver instalado)
if command -v image-optimizer &> /dev/null; then
    echo "🖼️ Otimizando imagens..."
    image-optimizer public/images/
fi

# Minificar CSS
if command -v css-minifier &> /dev/null; then
    echo "🎨 Minificando CSS..."
    find public/css -name "*.css" -exec css-minifier {} \; -o {}.min
fi

# Minificar JavaScript
if command -v uglifyjs &> /dev/null; then
    echo "⚡ Minificando JavaScript..."
    find public/js -name "*.js" -exec uglifyjs {} -o {}.min \;
fi

# Criar arquivo de versão
echo "📝 Criando arquivo de versão..."
cat > public/version.json << EOF
{
  "version": "1.0.0",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pwaEnabled": true,
  "features": [
    "Offline support",
    "App installation",
    "Push notifications",
    "Background sync"
  ]
}
EOF

# Verificar manifest
echo "🔍 Verificando manifest..."
if [ -f "public/manifest.json" ]; then
    echo "✅ Manifest encontrado"
else
    echo "❌ Manifest não encontrado. Criando um básico..."
    cat > public/manifest.json << EOF
{
  "name": "Teacher Tati",
  "short_name": "Tati AI",
  "description": "Pratique inglês com IA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#6C63FF",
  "theme_color": "#6C63FF",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
EOF
fi

# Verificar service worker
echo "🔍 Verificando Service Worker..."
if [ -f "public/sw.js" ]; then
    echo "✅ Service Worker encontrado"
else
    echo "❌ Service Worker não encontrado. Criando um básico..."
    cat > public/sw.js << EOF
const CACHE_NAME = 'tati-ai-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
EOF
fi

echo "✅ Build concluído!"
echo "📱 O app agora está pronto para PWA!"
echo "🌐 Acesse http://localhost:3000 para testar"
echo "📲 Para instalar como app: acesse o site no Chrome/Edge e clique em 'Instalar'"
