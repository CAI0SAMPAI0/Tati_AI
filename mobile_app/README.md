# mobile_app — WebView wrapper (Capacitor) + desktop notes (Tauri)

Esta pasta contém um scaffold inicial para empacotar seu frontend como app nativa usando um WebView.

Visão geral
- Mobile: uso recomendado — Capacitor (Android/iOS). A app carrega a URL do seu frontend (em dev: `http://localhost:3000`, em produção: `https://<sua-vercel-url>`).
- Desktop: opção leve — Tauri (recomendada) ou Electron. Tauri gera binários leves, mas requer Rust.

Objetivo deste scaffold
- Fornecer arquivos iniciais e instruções para testar localmente sem mexer no frontend.
- Permitir atualização instantânea: app aponta para a URL do site (Vercel). Ao atualizar o webapp, usuários verão mudanças sem reinstalar.

Requisitos locais
- Node.js (>=16), npm
- Android Studio para emular/gerar APKs (Android)
- Xcode/macOS para iOS (ou usar builders cloud para iOS)
- Rust (opcional, para Tauri)

Próximos passos rápidos (dev)
1. Rode backend localmente (se precisar):
```bash
cd backend
uvicorn main:app --reload
```
2. Rode frontend local:
```bash
cd frontend
npm install
npm run dev
# normalmente em http://localhost:3000
```
3. Abra o shell Capacitor para desenvolvimento (veja `capacitor/README.md`).

Se quiser que eu crie o projeto Capacitor/electron/tauri completo (incluindo `npx cap add android`), posso guiar ou executar os comandos localmente dependendo do que você prefere. Arquivos aqui são apenas scaffold e documentação.
