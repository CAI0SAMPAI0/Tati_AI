# Estrutura do Projeto — Teacher Tatiana AI (Tati AI)

Este documento mapeia a organizacao real de diretorios e arquivos do monorepo **Tati AI**, detalhando as responsabilidades de cada modulo, as fronteiras entre o backend (**Django 5 + Django Ninja**) e as aplicacoes frontend (**Vue 3 + Vite**), o papel do portal comercial `apps/hub-site/` e do pacote compartilhado `packages/hub-core/`, alem das configuracoes de infraestrutura, testes, migrations e documentacao.

> Pastas geradas ou locais ignoradas pelo versionamento (`node_modules/`, `.venv/`, `dist/`, `__pycache__/`, `.pytest_cache/`, `playwright-report/`) foram intencionalmente omitidas.

---

## 1. Visao Geral da Arvore do Repositorio

```text
Tati_AI/
├── .github/
│   └── workflows/
│       ├── ci.yml                              # Pipeline de CI (Flake8, testes Django, vue-tsc e vite build)
│       ├── deploy-hf.yml                       # Deploy automatizado do backend no Hugging Face Spaces
│       └── tauri-desktop-build.yml             # Workflow preparatorio para empacotamento desktop (manual/tag)
│
├── apps/
│   └── hub-site/                               # Portal SPA dedicado ao Hub de Materiais (@tati/hub-site, porta 3001)
│       ├── public/                             # Assets estaticos do portal Hub
│       ├── src/
│       │   ├── components/
│       │   │   ├── catalog/                    # HeroBanner, FilterChips, ProductCard e CatalogSkeleton
│       │   │   ├── secure/                     # SecureDocumentViewer.vue (leitor protegido com marca d'agua)
│       │   │   ├── BrandMark.vue               # Identidade visual Taty's Materials
│       │   │   ├── CheckoutFlow.vue            # Modal de checkout PIX/Cartao integrado ao Mercado Pago
│       │   │   ├── HubHeader.vue               # Cabecalho responsivo do portal Hub
│       │   │   ├── HubLayoutWrapper.vue        # Shell estrutural do portal
│       │   │   ├── LgpdConsentModal.vue        # Banner/modal de consentimento LGPD
│       │   │   └── Sidebar.vue                 # Navegacao lateral do catalogo, biblioteca e pedidos
│       │   ├── hooks/
│       │   │   └── usePaymentWebSocket.ts      # Hook cliente para eventos de pagamento
│       │   ├── lib/
│       │   │   └── catalog.ts                  # Resolucao de API URL e adaptadores de itens do catalogo
│       │   ├── router/
│       │   │   └── index.ts                    # Rotas (/materiais, /materiais/:id/ler, /meus-materiais, /pedidos, /login)
│       │   ├── stores/
│       │   │   └── auth.ts                     # Store Pinia conectada ao @tati/hub-core
│       │   ├── views/                          # CatalogView, ReadMaterialView, MyMaterialsView, OrdersView, LoginView
│       │   ├── App.vue                         # Componente raiz do portal Hub
│       │   ├── globals.css                     # Tokens visuais e estilos base Tailwind
│       │   └── main.ts                         # Inicializacao Vue 3 + Pinia + VueQueryPlugin + Router
│       ├── .env.example                        # Exemplo de variaveis VITE_* do Hub
│       ├── index.html                          # Documento HTML raiz do Vite
│       ├── package.json                        # Manifesto do workspace @tati/hub-site
│       ├── postcss.config.js                   # Configuracao PostCSS/Autoprefixer
│       ├── tailwind.config.ts                  # Configuracao Tailwind CSS do Hub
│       ├── tsconfig.json                       # Configuracao TypeScript do Hub
│       ├── vercel.json                         # Regras de rewrite SPA para deploy na Vercel
│       └── vite.config.ts                      # Configuracao Vite 6 (porta 3001 + proxy /api)
│
├── packages/
│   └── hub-core/                               # Biblioteca TypeScript compartilhada (@tati/hub-core)
│       ├── src/
│       │   ├── auth.ts                         # Funcoes de autenticacao, registro e perfil
│       │   ├── auth-cookie.ts                  # Leitura/gravacao de cookie de sessao cross-subdomain
│       │   ├── catalog.ts                      # Chamadas REST de catalogo, checkout e pedidos
│       │   ├── client.ts                       # Cliente HTTP configuravel (configureApiClient)
│       │   ├── endpoints.ts                    # Mapa centralizado de rotas /api/v1/*
│       │   ├── index.ts                        # Exportacoes publicas do pacote
│       │   ├── levels.ts                       # Constantes e descricoes de niveis CEFR
│       │   ├── session.ts                      # Persistencia resiliente de sessao (localStorage + cookie)
│       │   └── types.ts                        # Contratos TypeScript compartilhados
│       ├── package.json                        # Manifesto do pacote @tati/hub-core
│       └── tsconfig.json                       # Configuracao TypeScript da biblioteca
│
├── backend/                                    # Backend Python (Django 5 + Django Ninja + Channels + Celery)
│   ├── ai/
│   │   └── prompts/                            # Prompts Markdown versionados (carregados com hot-reload)
│   │       ├── accent_instructions.md          # Instrucoes de sotaque (US, UK, AU, CA, IE, IN)
│   │       ├── cefr_activity_generator.md      # Gerador de flashcards e simulacoes alinhados ao CEFR
│   │       ├── cefr_level_guidelines.md        # Diretrizes pedagogicas A1-C2
│   │       ├── chat_simulation.md              # Prompt de roleplay interativo
│   │       ├── chat_summary.md                 # Resumo pedagogico de conversas
│   │       ├── chat_title.md                   # Geracao automatica de titulo de conversa
│   │       ├── exam_dynamic_themes.md          # Temas dinamicos dos exames trimestrais
│   │       ├── exam_generator_system.md        # Geracao de questoes dos exames trimestrais
│   │       ├── exam_speaking_eval.md           # Rubrica de avaliacao oral em exames
│   │       ├── exam_writing_eval.md            # Rubrica de avaliacao escrita em exames
│   │       ├── image_prompt_generator.md       # Geracao de prompts visuais para flashcards
│   │       ├── leveling_assessment.md          # Avaliacao diagnostica de nivelamento CEFR
│   │       ├── pronunciation_free_speech.md    # Feedback de pronuncia em fala livre
│   │       ├── pronunciation_teacher.md        # Feedback fonetico guiado
│   │       ├── pronunciation_write.md          # Exercicios integrados de ditado/pronuncia
│   │       ├── tati_system_prompt.md           # Persona principal da Teacher Tatiana AI
│   │       └── word_analysis.md                # Explicacao contextual e traducao de palavras clicadas
│   │
│   ├── app/                                    # Nucleo de configuracao e entrada do projeto Django
│   │   ├── settings/
│   │   │   ├── __init__.py                     # Seletor dinamico baseado em ENVIRONMENT
│   │   │   ├── base.py                         # Configuracao comum (Apps, DB, Redis, Celery, JWT, CORS, IA)
│   │   │   ├── development.py                  # Perfil local (DEBUG=True, CORS local, fallback SQLite)
│   │   │   ├── production.py                   # Perfil seguro de producao (SSL proxy, cookies seguros)
│   │   │   └── test.py                         # Perfil de testes (SQLite :memory: + UnmanagedModelTestRunner)
│   │   ├── shared/
│   │   │   └── services/
│   │   │       └── upstash.py                  # Cliente HTTP REST para Upstash Redis
│   │   ├── api.py                              # Instancia NinjaAPI, routers, /health, /metrics e /app/version
│   │   ├── asgi.py                             # ProtocolTypeRouter (HTTP + WebSocket via Django Channels)
│   │   ├── celery.py                           # Instancia Celery e cronograma Beat
│   │   ├── middleware.py                       # NormalizePath, RateLimit, Performance e StructuredLogging
│   │   ├── tests.py                            # Testes automatizados dos endpoints de sistema
│   │   ├── urls.py                             # Montagem de /admin/, /api/v1/, /api/ e /
│   │   └── wsgi.py                             # Entrypoint WSGI
│   │
│   ├── apps/                                   # Aplicacoes de dominio Django
│   │   ├── authentication/                     # Autenticacao JWT, Google OAuth, sessao unica e recuperacao de senha
│   │   │   ├── migrations/0001_initial.py      # Migration inicial do modelo User (managed=False)
│   │   │   ├── api.py                          # Router /auth
│   │   │   ├── models.py                       # Modelo customizado User (tabela users)
│   │   │   ├── schemas.py                      # Contratos Pydantic de login, token e registro
│   │   │   ├── security.py                     # Emissao/validacao JWT, AuthBearer e require_teacher
│   │   │   ├── services.py                     # Regras de autenticacao, OAuth e reset de senha
│   │   │   └── tests.py                        # Suite de testes de autenticacao e JWT
│   │   │
│   │   ├── users/                              # Perfil do estudante, ofensiva (streak), metas e avatar
│   │   │   ├── migrations/0001_initial.py      # Migration estrutural inicial
│   │   │   ├── api.py                          # Routers /profile, /users e /avatar
│   │   │   ├── models.py                       # Modelos auxiliares de usuario
│   │   │   ├── progress_report.py              # Geracao de relatorio individual de evolucao em PDF
│   │   │   ├── schemas.py                      # Schemas de perfil, XP e ofensiva
│   │   │   └── services.py                     # StreakService, GoalService e gestao de perfil
│   │   │
│   │   ├── chat/                               # Tutor conversacional IA, voz em tempo real, nivelamento e RAG
│   │   │   ├── management/commands/
│   │   │   │   └── ingest_rag_materials.py     # CLI para indexacao vetorial de apostilas CEFR
│   │   │   ├── migrations/0001_initial.py      # Migration inicial (conversations, messages, cefr_simulations)
│   │   │   ├── rag/                            # Subsistema RAG (chunking, embeddings BGE, vector_store, drive_ingest)
│   │   │   ├── api.py                          # Router /chat
│   │   │   ├── audio_service.py                # STT (Groq Whisper) e TTS multi-sotaque (Edge TTS + gTTS)
│   │   │   ├── consumers.py                    # ChatConsumer WebSocket assincrono (voz e texto)
│   │   │   ├── document_service.py             # Exportacao de conversas em PDF e DOCX
│   │   │   ├── leveling_data.json              # Banco base para teste diagnostico CEFR
│   │   │   ├── leveling_service.py             # Motor de avaliacao de nivelamento
│   │   │   ├── models.py                       # Conversation, Message e CEFRSimulation
│   │   │   ├── routing.py                      # Rotas WebSocket (ws/chat e chat/ws)
│   │   │   ├── schemas.py                      # Contratos de chat, voz e analise de palavras
│   │   │   ├── services.py                     # Orquestracao de LLMs (Llama 3.1, Groq, Gemini) e correcoes
│   │   │   ├── simulation_api.py               # Router /simulation (cenarios de roleplay)
│   │   │   └── word_service.py                 # Dicionario contextual e pronuncia de termos clicados
│   │   │
│   │   ├── activities/                         # Atividades pedagogicas, pronuncia, Hub seguro, exames e gerador CEFR
│   │   │   ├── data/                           # Catalogos JSON indexados (Test English, LiveWorksheets, LingoClip)
│   │   │   ├── management/commands/
│   │   │   │   ├── migrate_flashcards_visual.py # Migracao visual de flashcards
│   │   │   │   └── run_cefr_schedules.py       # Execucao CLI dos agendamentos automaticos CEFR
│   │   │   ├── migrations/                     # 0001_initial a 0003 (inclui PronunciationHistory managed=True)
│   │   │   ├── activity_scraper.py             # Utilitario de indexacao de exercicios externos
│   │   │   ├── admin_exam_review.py            # Revisao docente de exames trimestrais
│   │   │   ├── api.py                          # Routers /activities, /catalog, /grammar, /speech, /exams, /cefr/*, /admin/premium
│   │   │   ├── assets_service.py               # Upload de midia via Cloudinary
│   │   │   ├── generator.py                    # CEFRGeneratorService (geracao IA de flashcards e simulacoes)
│   │   │   ├── grammar_data.py                 # Base estruturada de topicos gramaticais CEFR
│   │   │   ├── image_service.py                # Resolucao de imagens (FLUX.1-dev, Unsplash, Pexels)
│   │   │   ├── models.py                       # Flashcard, Module, Podcast, Trophy, PremiumContent, Game, NewsItem, PronunciationHistory, TrimestralExam, etc.
│   │   │   ├── schemas.py                      # Schemas de atividades, catalogo, pronuncia e exames
│   │   │   ├── secure_document_service.py      # Conversao PDF/DOCX -> WebP e marca d'agua dinamica
│   │   │   ├── services.py                     # FlashcardService, PodcastService, HubService, SpeechService, RankingService, etc.
│   │   │   ├── tasks.py                        # Tarefas Celery de sincronizacao do Hub e decks CEFR
│   │   │   ├── tests_flashcards.py             # Testes automatizados de flashcards e decks CEFR
│   │   │   └── trimestral_exams.py             # Regras de elegibilidade, geracao e correcao de exames trimestrais
│   │   │
│   │   ├── dashboard/                          # Painel administrativo e curadoria da professora
│   │   │   ├── api.py                          # Routers /dashboard e /tasks
│   │   │   ├── schemas.py                      # Contratos de analytics, CRUD de alunos e curadoria
│   │   │   └── services.py                     # Consultas agregadas, relatorios CSV/PDF e gestao de conteudos
│   │   │
│   │   ├── notifications/                      # Central multicanal de notificacoes e engajamento
│   │   │   ├── migrations/0001_initial.py      # Migration inicial (notifications, push_subscriptions)
│   │   │   ├── api.py                          # Router /notifications (in-app, VAPID WebPush, FCM)
│   │   │   ├── models.py                       # Notification e PushSubscription
│   │   │   ├── scheduler.py                    # BackgroundNotificationRunner (daemon interno de alertas)
│   │   │   ├── schemas.py                      # Contratos de notificacao e inscricao push
│   │   │   ├── services.py                     # NotificationDispatcher, Email (Brevo/Resend/SMTP), WebPush e FCM
│   │   │   ├── tasks.py                        # Tarefas Celery Beat de ofensiva e resumo semanal
│   │   │   └── waha_service.py                 # Cliente WhatsApp HTTP API (WAHA)
│   │   │
│   │   └── payments/                           # Pagamentos e assinaturas via Mercado Pago
│   │       ├── migrations/0001_initial.py      # Migration inicial (orders, subscriptions, premium_purchases)
│   │       ├── api.py                          # Router /payments (planos, PIX, Cartao, status e webhook)
│   │       ├── models.py                       # Order, Subscription e PremiumPurchase
│   │       ├── schemas.py                      # Contratos de checkout e webhook
│   │       └── services.py                     # Integracao SDK Mercado Pago e controle de vigencia de cobranca
│   │
│   ├── assets/                                 # Imagens internas do backend (avatar da professora, logos para PDF)
│   ├── scripts/
│   │   └── upload_hf.py                        # Script de sincronizacao de deploy com Hugging Face Spaces
│   ├── shared/                                 # Modulos transversais compartilhados entre os apps Django
│   │   ├── ai_cache.py                         # Cache hibrido de dois niveis (Redis + LRU em RAM) para IA
│   │   ├── async_db.py                         # Wrappers sync_to_async para operacoes ORM em rotas async
│   │   ├── cache.py                            # Invalidacao seletiva de cache por usuario
│   │   └── prompt_manager.py                   # Carregador de prompts Markdown com hot-reload
│   ├── Dockerfile                              # Imagem Docker completa de producao
│   ├── Dockerfile.api                          # Imagem Docker leve para execucao serverless
│   ├── manage.py                               # Ponto de entrada de comandos administrativos Django
│   ├── README.md                               # Resumo operacional rapido do backend
│   └── requirements.txt                        # Lista de dependencias Python
│
├── frontend/                                   # Aplicacao Web Principal (Alunos e Professora, porta 3000)
│   ├── public/                                 # Arquivos publicos servidos na raiz (manifest.json, sw.js, avatar, icons, downloads)
│   ├── src/
│   │   ├── api/                                # Cliente HTTP com auto-refresh JWT, modulos REST e cache IndexedDB
│   │   ├── assets/styles/globals.css           # Variaveis CSS de tema claro/escuro e estilos Tailwind
│   │   ├── components/                         # Componentes Vue organizados por contexto (activities, catalog, charts, chat, dashboard, feedback, layout, ui)
│   │   ├── composables/                        # Hooks reativos (useVoiceSocket, useAudioRecorder, useTTS, usePresence, useStreakAndTrophies, useToast)
│   │   ├── constants/                          # Sotaques, niveis CEFR e constantes de perfil
│   │   ├── router/index.ts                     # Rotas lazy-loaded e guards de autenticacao/role/APK
│   │   ├── services/pushNotifications.ts       # Registro do Service Worker e WebPush
│   │   ├── stores/                             # Stores Pinia (auth.ts, notifications.ts, theme.ts)
│   │   ├── types/catalog.ts                    # Tipagens especificas da vitrine interna
│   │   ├── utils/                              # Funcoes utilitarias e activityCache.ts
│   │   ├── views/                              # Views de cada rota (auth, chat, voice, activities, pronunciation, flashcards, exams, dashboard, hub, public, etc.)
│   │   ├── ws/                                 # Cliente WebSocket TatiWebSocket (socket.ts) e tipos (types.ts)
│   │   ├── App.vue                             # Raiz da aplicacao e orquestracao de presenca/notificacoes
│   │   └── main.ts                             # Inicializacao Vue 3 + Pinia + VueQueryPlugin + Router
│   ├── .env.example                            # Exemplo de variaveis VITE_* do frontend principal
│   ├── Dockerfile                              # Build multi-stage (Node 20 -> Nginx Alpine)
│   ├── nginx.conf                              # Configuracao Nginx para servir SPA em container
│   ├── package.json                            # Manifesto do workspace frontend
│   ├── railway.json                            # Configuracao de deploy alternativo no Railway
│   ├── tailwind.config.ts                      # Configuracao do Design System no Tailwind CSS
│   ├── tsconfig.json                           # Configuracao TypeScript
│   ├── vercel.json                             # Configuracao de deploy na Vercel
│   └── vite.config.ts                          # Configuracao Vite 6 (porta 3000 + proxy /api e /ws)
│
├── mobile/                                     # Aplicativo Mobile Oficial (Flutter Android / iOS)
│   ├── android/                                # Projeto nativo Android (Gradle, permissoes, Firebase)
│   ├── ios/                                    # Projeto nativo iOS (Runner Xcode)
│   ├── lib/
│   │   └── main.dart                           # Wrapper InAppWebView, FCM Push, Google Sign-In nativo e OTA check
│   ├── assets/images/                          # Splash e icones do aplicativo
│   ├── pubspec.yaml                            # Dependencias Flutter/Dart
│   └── README.md                               # Instrucoes de build do APK/AAB
│
├── mobile_app/                                 # Diretorio legado/planejado (notas historicas Capacitor e guia Tauri)
│   ├── desktop/TAURI_README.md                 # Documentacao preparatoria para versao Desktop Tauri
│   ├── README.md                               # Notas historicas de empacotamento mobile
│   └── styles.py                               # Utilitario legado auxiliar
│
├── pwa/                                        # Scripts auxiliares de geracao de icones e validacao PWA
│   ├── build-pwa.sh
│   ├── create-pwa-icons.js
│   ├── create-pwa-icons-png.py
│   ├── generate-icons.js
│   └── test-pwa.py
│
├── public/                                     # Icones e manifesto publicos na raiz do repositorio
├── downloads/                                  # Metadados de versao para distribuicao direta do APK
│
├── docs/                                       # Documentacao tecnica oficial do projeto
│   ├── assets/                                 # Capturas de tela reais verificadas das interfaces web
│   ├── architecture.md                         # Arquitetura geral do monorepo e integracoes
│   ├── backend.md                              # Arquitetura detalhada Django 5 + Django Ninja + Channels
│   ├── bundle_analysis.md                      # Metricas reais de build e chunks Vite 6
│   ├── frontend.md                             # Arquitetura Vue 3 (frontend, apps/hub-site e @tati/hub-core)
│   ├── frontend_route_mapping.md               # Mapeamento completo de rotas, layouts e guards
│   ├── guidelines.md                           # Padroes de codigo, nomenclatura e seguranca
│   ├── navigation_audit.md                     # Auditoria de navegacao declarativa e programatica no Vue Router
│   ├── provider_audit.md                       # Auditoria de plugins, stores Pinia e ciclo de vida global
│   ├── readme.md                               # Indice navegavel da documentacao tecnica
│   └── setup.md                                # Guia passo a passo de configuracao e execucao local
│
├── .env.example                                # Template principal de variaveis de ambiente
├── .flake8                                     # Regras de lint Python
├── CONFIGURACOES.md                            # Notas complementares de configuracoes operacionais
├── VARIAVEIS_ENV.md                            # Referencia complementar de variaveis de ambiente
├── docker-compose.yml                          # Orquestracao Docker (backend, frontend, celery_worker, celery_beat)
├── nginx.conf                                  # Proxy reverso Nginx opcional para deploy unificado
├── package.json                                # Manifesto raiz do monorepo NPM Workspaces
├── playwright.config.ts                        # Configuracao de testes E2E com Playwright
├── PROJECT_STRUCTURE.md                        # Este documento
├── railway.json                                # Configuracao de deploy do backend no Railway
├── readme.md                                   # Visao geral e guia rapido do projeto
└── vercel.json                                 # Configuracao raiz de build do frontend principal na Vercel
```

---

## 2. Fronteiras Arquiteturais e Responsabilidades

### 2.1. Limite entre Backend (`backend/`) e Frontends (`frontend/`, `apps/hub-site/`)
- **Comunicacao estritamente desacoplada**: os frontends sao SPAs estaticas em Vue 3 compiladas pelo Vite e servidas via CDN (Vercel ou Nginx). Nao ha renderizacao de templates HTML pelo Django (exceto o `/admin` interno e a interface Swagger em `/docs`).
- **Contratos REST e WebSocket**: toda troca de dados ocorre sob `/api/v1/*` (validada por schemas Pydantic v2 no Django Ninja) e pelos endpoints WebSocket `/ws/chat` e `/chat/ws` (Django Channels).
- **Seguranca concentrada no servidor**: geracao de prompts, chaves de provedores de IA, validacao de compras no Mercado Pago e aplicacao de marca d'agua em materiais PDF/WebP ocorrem exclusivamente dentro de `backend/`.

### 2.2. Papel de `apps/hub-site/` vs `frontend/`
- **`frontend/`** e o ambiente completo de ensino diario para alunos matriculados e para a professora (tutoria por chat e voz, exercicios, pronuncia, ranking, exames e painel administrativo), incluindo tambem uma visao integrada do Hub em `/activities/hub`.
- **`apps/hub-site/`** (`@tati/hub-site`) e um portal comercial enxuto e independente (`https://tati-hub.vercel.app`) voltado tambem ao publico externo que deseja adquirir e ler apostilas, e-books e planners avulsos da professora sem precisar navegar por toda a plataforma de tutoria.
- **`packages/hub-core/`** (`@tati/hub-core`) evita duplicacao de logica de sessao, tipos de catalogo e comunicacao com `/api/v1/catalog` no `apps/hub-site`, mantendo suporte a compartilhamento de sessao via cookies quando implantados sob o mesmo dominio raiz.

### 2.3. Migrations, Modelos e Testes no Django
- **Migrations (`backend/apps/*/migrations/`)**: versionam o estado inicial dos modelos e tabelas gerenciadas pelo Django (como `PronunciationHistory` em `activities/migrations/0003_*`), enquanto as tabelas legadas compartilhadas no PostgreSQL permanecem protegidas com `managed = False`.
- **Testes Automatizados**: localizados nos apps Django (`backend/app/tests.py`, `backend/apps/authentication/tests.py`, `backend/apps/activities/tests_flashcards.py`) e executados com `DJANGO_SETTINGS_MODULE=app.settings.test`, onde o `UnmanagedModelTestRunner` instancia todas as tabelas em SQLite em memoria para execucao rapida e deterministica na CI.
