# PWA Setup - Teacher Tati

Este guia centraliza a configuracao PWA do projeto.

## Estrutura

- Runtime PWA: `frontend/manifest.json`, `frontend/sw.js`, `frontend/js/pwa.js`
- Artefatos de build/teste: pasta `pwa/`
- Saida publica: `public/`

## Comandos

```bash
npm run install-pwa
npm run build-pwa
python pwa/test-pwa.py
```

## O que cada comando faz

- `npm run install-pwa`: gera icones em `public/icons/`.
- `npm run build-pwa`: copia assets de `frontend/` para `public/`, valida `manifest.json` e `sw.js`.
- `python pwa/test-pwa.py`: valida arquivos essenciais, manifest e sintaxe basica do service worker.

## Arquivos obrigatorios em producao

- `public/manifest.json`
- `public/sw.js`
- `public/pwa-installer.js`
- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`

## Validacao manual

1. Abrir o app em `https` ou `localhost`.
2. Confirmar registro do service worker no DevTools > Application.
3. Verificar prompt de instalacao (`beforeinstallprompt`).
4. Validar offline basico recarregando paginas ja cacheadas.
