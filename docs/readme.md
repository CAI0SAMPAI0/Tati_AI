# Indice da Documentacao Tecnica — Teacher Tatiana AI (Tati AI)

Bem-vindo a central de documentacao tecnica do ecossistema **Tati AI**. Todos os documentos deste diretorio refletem a implementacao atual do monorepo (**Django 5 + Django Ninja + Channels + Celery** no backend, **Vue 3 + Vite + TypeScript** nos frontends `frontend/` e `apps/hub-site/`, pacote compartilhado `@tati/hub-core` e aplicativo mobile **Flutter** em `mobile/`).

---

## 1. Documentos Principais de Arquitetura e Operacao

- **[Arquitetura do Sistema](./architecture.md)**
  Visao macro do monorepo, diagrama de camadas, stack tecnologica confirmada, fronteiras entre `frontend/`, `apps/hub-site/` e `mobile/`, fluxos de voz/WebSocket, protecao de documentos com marca d'agua, topologia de deploy e diferenciacao entre recursos implementados, em validacao ou planejados.

- **[Guia do Backend (Django 5 + Django Ninja)](./backend.md)**
  Organizacao de `backend/app/` e dos 7 apps em `backend/apps/`, perfis de configuracao, tabela completa dos 19 routers Django Ninja, WebSockets (`ChatConsumer`), autenticacao JWT e middlewares, particularidades dos modelos `managed = False` no PostgreSQL, pipeline RAG, processamento de fala (Whisper + Edge TTS), cache, Celery e integracao Mercado Pago.

- **[Guia do Frontend (Vue 3 + Vite + Hub)](./frontend.md)**
  Arquitetura das duas aplicacoes SPA (`frontend/` e `apps/hub-site/`) e do SDK `@tati/hub-core`, screenshots reais das interfaces em producao, estrutura de diretorios, Pinia stores, cache em camadas (Vue Query + IndexedDB), cliente HTTP com refresh automatico, cliente WebSocket e integracao PWA / Flutter `InAppWebView`.

- **[Configuracao e Execucao Local (Setup)](./setup.md)**
  Pre-requisitos, instalacao via NPM Workspaces e `venv`, variaveis de ambiente (`.env`, `frontend/.env`, `apps/hub-site/.env`), execucao do backend ASGI, frontends nas portas `3000` e `3001`, Celery, Docker Compose, banco de dados e comandos reais de teste.

- **[Diretrizes e Padroes de Codigo](./guidelines.md)**
  Convencoes de nomenclatura (`snake_case`, `PascalCase.vue`, `useCamelCase.ts`), separacao de camadas (`api.py`, `schemas.py`, `services.py`, `models.py`), gestao de prompts em Markdown, linting Flake8, tipagem `vue-tsc`, seguranca/LGPD e pipeline de CI/CD.

---

## 2. Mapeamentos e Auditorias Tecnicas do Frontend

- **[Mapeamento de Rotas e Layouts](./frontend_route_mapping.md)**
  Tabela completa de rotas publicas, full-screen e aninhadas sob `AuthenticatedLayout.vue` no `frontend/`, rotas do `apps/hub-site/` e funcionamento detalhado dos guards globais (`router.beforeEach`, captura OAuth e modo APK/PWA).

- **[Analise de Bundle (Vite 6)](./bundle_analysis.md)**
  Metricas verificadas de `vite build` para `frontend` e `@tati/hub-site`, tamanho bruto e gzip dos chunks de entrada, CSS, views lazy-loaded, micro-chunks de icones `lucide-vue-next` e oportunidades reais de otimizacao.

- **[Auditoria de Navegacao (Vue Router)](./navigation_audit.md)**
  Levantamento do uso declarativo de `<router-link>`, transicoes programaticas (`router.push` / `router.replace`) e redirecionamentos cross-origin (`window.location`) entre o app principal e o portal Hub.

- **[Auditoria de Estado Global e Ciclo de Vida](./provider_audit.md)**
  Analise dos plugins registrados em `main.ts` (`Pinia`, `VueQueryPlugin`, `Router`), responsabilidades das stores e servicos globais em `App.vue` (heartbeat de presenca de 30s, polling de notificacoes de 25s com deteccao de visibilidade, WebPush e ponte Flutter).

---

## 3. Documentos Complementares no Repositorio

- **[Visao Geral do Projeto (`readme.md` na raiz)](../readme.md)**
- **[Estrutura Completa do Repositorio (`PROJECT_STRUCTURE.md`)](../PROJECT_STRUCTURE.md)**
- **[Guia Especifico do Backend (`backend/README.md`)](../backend/README.md)**
- **[Guia do Aplicativo Mobile Flutter (`mobile/README.md`)](../mobile/README.md)**
