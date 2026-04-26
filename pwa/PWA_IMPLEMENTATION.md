# PWA Implementation - Teacher Tati

## Entregas implementadas

- Manifest publicado para instalacao: `frontend/manifest.json`.
- Service worker com cache estatico/runtime e fallback de navegacao: `frontend/sw.js`.
- Registro e CTA de instalacao no runtime: `frontend/js/pwa.js`.
- Assets finais para deploy em `public/` (`manifest`, `sw`, icones, `pwa-installer.js`).

## Organizacao aplicada

Todos os artefatos de suporte ao PWA foram movidos para `pwa/`:

- `pwa/build-pwa.sh`
- `pwa/create-pwa-icons.js`
- `pwa/create-pwa-icons-png.py`
- `pwa/generate-icons.js`
- `pwa/test-pwa.py`
- `pwa/PWA_SETUP.md`
- `pwa/PWA_IMPLEMENTATION.md`

## Scripts atualizados

- `package.json`:
  - `install-pwa`: `node pwa/create-pwa-icons.js`
  - `build-pwa`: `./pwa/build-pwa.sh`

## Observacoes tecnicas

- Os geradores de icone agora escrevem em `../public/icons` a partir de `pwa/`.
- O validador `pwa/test-pwa.py` usa raiz do projeto via `Path(__file__).resolve().parent.parent`.

## Status

Pronto para uso local e deploy web instalavel, com estrutura PWA separada da raiz.
