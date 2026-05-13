Tauri (desktop) — notas rápidas

Tauri é uma boa opção para gerar binários leves (Windows, macOS, Linux).

Prereqs:
- Node.js
- Rust toolchain (rustup + cargo)

Dev flow (sugestão):
1. Crie app com a CLI do Tauri (na pasta `mobile_app/desktop`):
```bash
# instalar create-tauri-app (opcional)
npm create tauri-app
# ou seguir: https://tauri.app/v1/guides/getting-started/setup
```
2. Configure dev server para `http://localhost:3000` para dev.
3. Durante build de produção aponte para `https://<seu-site>.vercel.app`.

Dica: Tauri precisa build env com Rust; se quiser evitar Rust local, use Electron (mais pesado) ou services CI para produzir builds.
