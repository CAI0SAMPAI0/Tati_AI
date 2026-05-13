Capacitor shell — instruções rápidas

1) Preparação (executar na pasta `mobile_app/capacitor`):

```bash
# instalar dependências do shell
npm install

# inicializar Capacitor (se ainda não inicializado via CLI)
# npx cap init "Tati AI" com.tati.ai --web-dir=www
```

2) Desenvolvimento local
- Configure `capacitor.config.json` -> `server.url` para `http://localhost:3000` (padrão neste scaffold).
- Rode seu frontend: `cd frontend && npm run dev`.
- Em seguida rode no Android (pré requisito: Android Studio instalado):

```bash
npx cap add android   # uma vez
npx cap open android  # abre Android Studio (rodar/emular lá)
```

No Android Studio, rode o app em um emulator ou dispositivo.

3) Produção (apontar para Vercel)
- No `capacitor.config.json` substitua `server.url` por `https://<seu-site>.vercel.app` ou remova `server.url` e copie os arquivos estáticos produzidos pelo build do frontend.
- Para publicar, construa o frontend e execute `npx cap copy` e `npx cap sync` antes de gerar builds nativos.

Observações
- A Apple costuma reprovar apps que apenas carregam um site; adicione integrações nativas para aprovação (notificações, login/biometria, offline cache, etc.).
- Para atualizações instantâneas sem rebuild, mantenha o app apontando para a URL do site (WebView).