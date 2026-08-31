# Tati AI — Arquitetura de Diretórios

```
Tati_AI
├── apps/                                  # Aplicações secundárias (monorepo)
│   └── hub-site/                          # Site do Hub de Materiais (Next.js)
│       ├── app/                           # Rotas e páginas (App Router)
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── sitemap.ts
│       │   ├── login/
│       │   ├── materiais/
│       │   ├── meus-materiais/
│       │   └── pedidos/
│       ├── components/                    # Componentes do hub-site
│       │   ├── BrandMark.tsx
│       │   ├── CheckoutFlow.tsx
│       │   ├── HubHeader.tsx
│       │   ├── HubLayoutWrapper.tsx
│       │   ├── Navbar.tsx
│       │   ├── Sidebar.tsx
│       │   ├── auth-provider.tsx
│       │   ├── login-form.tsx
│       │   ├── catalog/
│       │   └── secure/
│       ├── hooks/
│       ├── lib/
│       ├── providers/
│       ├── public/
│       ├── scripts/
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── backend/                               # API principal (FastAPI + Python)
│   ├── app/
│   │   ├── core/                          # Configurações globais do backend
│   │   │   ├── celery_app.py              # Configuração do Celery
│   │   │   ├── config.py                  # Variáveis de ambiente e settings
│   │   │   ├── database.py                # Conexão com banco de dados
│   │   │   ├── enums.py                   # Enumerações globais
│   │   │   ├── exceptions.py              # Exceções customizadas
│   │   │   ├── security.py                # JWT e autenticação
│   │   │   ├── tasks.py                   # Tasks base do Celery
│   │   │   ├── dependencies/              # Injeção de dependências (FastAPI)
│   │   │   │   ├── auth.py
│   │   │   │   └── db.py
│   │   │   └── utils/                     # Utilitários globais
│   │   │       ├── level_utils.py
│   │   │       ├── rate_limiter.py
│   │   │       └── sentry_config.py
│   │   │
│   │   ├── modules/                       # Módulos de domínio (feature-based)
│   │   │   │
│   │   │   ├── activities/                # Atividades, exercícios e conteúdo
│   │   │   │   ├── routes/                # Endpoints HTTP
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── achievements.py
│   │   │   │   │   ├── assets.py
│   │   │   │   │   ├── challenges.py
│   │   │   │   │   ├── flashcards.py
│   │   │   │   │   ├── hub.py
│   │   │   │   │   ├── modules.py
│   │   │   │   │   ├── personalized.py
│   │   │   │   │   ├── podcasts.py
│   │   │   │   │   ├── premium.py
│   │   │   │   │   ├── public.py
│   │   │   │   │   ├── quizzes.py
│   │   │   │   │   ├── ranking.py
│   │   │   │   │   ├── submissions.py
│   │   │   │   │   ├── trophies.py
│   │   │   │   │   ├── vocabulary.py
│   │   │   │   │   └── weekly_plan.py
│   │   │   │   ├── schema/                # Schemas Pydantic
│   │   │   │   │   └── premium.py
│   │   │   │   ├── services/              # Lógica de negócio
│   │   │   │   │   ├── activity_service.py
│   │   │   │   │   ├── error_log_service.py
│   │   │   │   │   ├── exercise_generator.py
│   │   │   │   │   ├── gamification_service.py
│   │   │   │   │   ├── module_service.py
│   │   │   │   │   ├── podcast_discovery.py
│   │   │   │   │   ├── podcast_exercise.py
│   │   │   │   │   ├── podcast_recommender.py
│   │   │   │   │   ├── premium_service.py
│   │   │   │   │   ├── pronunciation_challenge.py
│   │   │   │   │   ├── pronunciation_matcher.py
│   │   │   │   │   ├── quiz_service.py
│   │   │   │   │   ├── ranking.py
│   │   │   │   │   ├── submission_service.py
│   │   │   │   │   ├── trophy_service.py
│   │   │   │   │   ├── url_to_module.py
│   │   │   │   │   ├── vocabulary_srs.py
│   │   │   │   │   ├── weekly_plan.py
│   │   │   │   │   └── weekly_plan_service.py
│   │   │   │   └── tasks.py               # Tasks assíncronas (Celery)
│   │   │   │
│   │   │   ├── admin/                     # Painel administrativo
│   │   │   │   ├── routes/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── dashboard.py
│   │   │   │   │   ├── premium.py
│   │   │   │   │   └── tasks.py
│   │   │   │   └── services/
│   │   │   │       └── dashboard_service.py
│   │   │   │
│   │   │   ├── auth/                      # Autenticação e autorização
│   │   │   │   ├── routes/
│   │   │   │   │   └── auth.py
│   │   │   │   └── services/
│   │   │   │       └── auth_service.py
│   │   │   │
│   │   │   ├── cefr/                      # Avaliação de nível CEFR
│   │   │   │   ├── __init__.py
│   │   │   │   ├── domain/                # Modelos de domínio
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── models.py
│   │   │   │   ├── routes/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── admin.py
│   │   │   │   ├── services/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── cefr_scheduler.py
│   │   │   │   │   ├── cefr_service.py
│   │   │   │   │   ├── embeddings.py
│   │   │   │   │   ├── file_extractor.py
│   │   │   │   │   └── generator.py
│   │   │   │   └── tasks.py
│   │   │   │
│   │   │   ├── chat/                      # Chat com IA (Tati)
│   │   │   │   ├── routes/
│   │   │   │   │   └── chat.py
│   │   │   │   └── services/
│   │   │   │       ├── audio_generator.py
│   │   │   │       ├── chat_service.py
│   │   │   │       ├── llm.py
│   │   │   │       ├── prompt_builder.py
│   │   │   │       ├── rag.py
│   │   │   │       ├── rag_search.py
│   │   │   │       └── semantic_judge.py
│   │   │   │
│   │   │   ├── notifications/             # Push notifications e alertas
│   │   │   │   ├── routes/
│   │   │   │   │   └── notifications.py
│   │   │   │   ├── services/
│   │   │   │   │   ├── notification_dispatcher.py
│   │   │   │   │   ├── notification_scheduler.py
│   │   │   │   │   ├── notification_service.py
│   │   │   │   │   ├── notifications.py
│   │   │   │   │   └── push_notifications.py
│   │   │   │   └── tasks.py
│   │   │   │
│   │   │   ├── payments/                  # Pagamentos e assinaturas
│   │   │   │   ├── routes/
│   │   │   │   │   ├── asaas.py
│   │   │   │   │   └── mercadopago.py
│   │   │   │   └── services/
│   │   │   │       ├── asaas.py
│   │   │   │       ├── mercadopago.py
│   │   │   │       ├── payment_notifier.py
│   │   │   │       └── subscription_manager.py
│   │   │   │
│   │   │   ├── simulation/                # Simulação de conversação
│   │   │   │   ├── routes/
│   │   │   │   │   ├── avatar.py
│   │   │   │   │   └── simulation.py
│   │   │   │   └── services/
│   │   │   │       ├── simulation.py
│   │   │   │       └── simulation_service.py
│   │   │   │
│   │   │   └── users/                     # Usuários e perfis
│   │   │       ├── repositories/
│   │   │       │   └── user_repository.py
│   │   │       ├── routes/
│   │   │       │   ├── __init__.py
│   │   │       │   ├── bootstrap.py
│   │   │       │   ├── daily_summary.py
│   │   │       │   ├── goals.py
│   │   │       │   ├── onboarding.py
│   │   │       │   ├── permissions.py
│   │   │       │   ├── profile.py
│   │   │       │   ├── progress.py
│   │   │       │   ├── streaks.py
│   │   │       │   ├── vocabulary.py
│   │   │       │   └── xp.py
│   │   │       └── services/
│   │   │           ├── progress_report.py
│   │   │           ├── progress_service.py
│   │   │           ├── streaks.py
│   │   │           ├── study_goals.py
│   │   │           ├── user_service.py
│   │   │           └── xp_system.py
│   │   │
│   │   ├── routers/                       # Aggregador de rotas (tasks Celery)
│   │   │   └── tasks.py
│   │   │
│   │   ├── shared/                        # Serviços e rotas compartilhados
│   │   │   ├── routes/
│   │   │   │   ├── feedback.py
│   │   │   │   └── validation.py
│   │   │   └── services/
│   │   │       ├── cloudinary_service.py
│   │   │       ├── document_validator.py
│   │   │       ├── email.py
│   │   │       ├── file_gen.py
│   │   │       ├── geolocation.py
│   │   │       ├── history.py
│   │   │       ├── media_availability.py
│   │   │       ├── pdf_generator.py
│   │   │       ├── secure_document_service.py
│   │   │       ├── storage.py
│   │   │       └── upstash.py
│   │   │
│   │   └── routers_init.py                # Registro central de todos os routers
│   │
│   ├── assets/
│   ├── main.py                            # Entry point da aplicação FastAPI
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Dockerfile.api
│
├── frontend/                              # App principal do aluno (Next.js 14)
│   ├── app/                               # Rotas e páginas (App Router)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── metadata.ts
│   │   ├── (authenticated)/               # Rotas protegidas (requer login)
│   │   │   ├── layout.tsx
│   │   │   ├── achievements/
│   │   │   ├── activities/
│   │   │   ├── chat/
│   │   │   ├── competitions/
│   │   │   ├── dashboard/
│   │   │   ├── flashcards/
│   │   │   ├── goals/
│   │   │   ├── install/
│   │   │   ├── payment/
│   │   │   ├── podcasts/
│   │   │   ├── profile/
│   │   │   ├── progress/
│   │   │   ├── quiz/
│   │   │   ├── receipt/
│   │   │   ├── settings/
│   │   │   ├── vocab/
│   │   │   ├── voice/
│   │   │   └── voice-only/
│   │   ├── (public)/                      # Rotas públicas (sem login)
│   │   │   ├── layout.tsx
│   │   │   └── login/
│   │   └── hub/
│   │
│   ├── components/                        # Componentes reutilizáveis
│   │   ├── BrandMark.tsx
│   │   ├── CheckoutFlow.tsx
│   │   ├── DeployBanner.tsx
│   │   ├── activities/
│   │   ├── catalog/
│   │   ├── charts/
│   │   ├── chat/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   ├── onboarding/
│   │   ├── payment/
│   │   ├── podcasts/
│   │   ├── pwa/
│   │   └── ui/
│   │
│   ├── hooks/                             # React hooks customizados
│   │   ├── useAuth.ts
│   │   ├── useChatSocket.ts
│   │   ├── useI18n.ts
│   │   ├── usePaymentWebSocket.ts
│   │   ├── usePermissions.ts
│   │   ├── useTheme.ts
│   │   ├── useTour.ts
│   │   └── useVoiceSocket.ts
│   │
│   ├── lib/                               # Utilitários e integrações
│   │   ├── catalog.ts
│   │   ├── api/                           # Cliente HTTP e configuração de API
│   │   │   ├── auth-cookie.ts
│   │   │   ├── auth.ts
│   │   │   ├── client.ts
│   │   │   ├── create-server-page.tsx
│   │   │   ├── endpoints.ts
│   │   │   ├── page-prefetches.ts
│   │   │   ├── prefetch-hydration.tsx
│   │   │   ├── server-fetch.ts
│   │   │   ├── ssr-prefetch.tsx
│   │   │   ├── types.ts
│   │   │   ├── weekly-plan.ts
│   │   │   └── types/
│   │   ├── constants/
│   │   │   └── levels.ts
│   │   ├── hub-core/
│   │   ├── i18n/                          # Internacionalização
│   │   │   ├── config.ts
│   │   │   └── messages/
│   │   ├── theme/                         # Design tokens
│   │   │   ├── rem.ts
│   │   │   └── tokens.ts
│   │   ├── utils/
│   │   │   └── index.ts
│   │   └── ws/                            # WebSocket helpers
│   │       ├── chat-socket.ts
│   │       ├── socket.ts
│   │       └── types.ts
│   │
│   ├── providers/                         # Context Providers React
│   │   ├── app-providers.tsx
│   │   ├── auth-provider.tsx
│   │   ├── hydration-provider.tsx
│   │   ├── i18n-provider.tsx
│   │   ├── notification-provider.tsx
│   │   ├── query-provider.tsx
│   │   └── theme-provider.tsx
│   │
│   ├── store/                             # Estado global (Zustand)
│   │   └── error-store.ts
│   │
│   ├── public/
│   ├── scripts/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── packages/                              # Pacotes compartilhados (monorepo)
│   └── hub-core/                          # Lib compartilhada entre frontend e hub-site
│       ├── src/
│       │   ├── auth-cookie.ts
│       │   ├── auth.ts
│       │   ├── catalog.ts
│       │   ├── client.ts
│       │   ├── endpoints.ts
│       │   ├── index.ts
│       │   ├── levels.ts
│       │   ├── session.ts
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
│
├── mobile_app/                            # Aplicações mobile e desktop
│   ├── capacitor/                         # App mobile (iOS & Android via Capacitor)
│   │   ├── android/
│   │   ├── ios/
│   │   ├── assets/
│   │   ├── capacitor.config.json
│   │   ├── set_server_url.py
│   │   └── package.json
│   ├── desktop/                           # App desktop (Tauri — planejado)
│   │   └── TAURI_README.md
│   ├── README.md
│   └── styles.py
│
├── design_system/                         # Sistema de design e referências visuais
│   └── refs/
│
├── pwa/                                   # Scripts de build e configuração PWA
│   ├── build-pwa.sh
│   ├── create-pwa-icons-png.py
│   ├── create-pwa-icons.js
│   ├── generate-icons.js
│   └── test-pwa.py
│
├── scripts/                               # Scripts utilitários de desenvolvimento
│   ├── analyze-t-keys.js
│   ├── check_tables.py
│   ├── convert-i18n-to-english.js
│   ├── find_t_calls.js
│   ├── fix_db_schema.py
│   ├── fix_module_publication.py
│   ├── generate-icons.py
│   ├── migrate_cefr_levels.sql
│   ├── send_test_notifications.py
│   ├── switch-env.js
│   ├── test_features.py
│   └── update_plan_price.py
│
├── docker-compose.yml                     # Orquestração Docker (produção)
├── docker-compose.dev.yml                 # Orquestração Docker (desenvolvimento)
├── package.json                           # Workspace root (monorepo npm)
├── .env                                   # Variáveis de ambiente locais
├── .env.example                           # Template de variáveis de ambiente
├── .env.docker.example                    # Template para ambiente Docker
├── .gitignore
├── PRD.md                                 # Product Requirements Document
├── Procfile                               # Configuração para deploy (ex: Railway)
└── readme.md                              # Documentação principal do projeto
```

---

## Visão Geral das Camadas

| Camada | Tecnologia | Descrição |
|--------|-----------|-----------|
| **Backend** | FastAPI + Python | API REST + WebSocket, organizada por módulos de domínio |
| **Frontend** | Next.js 14 (App Router) | App web do aluno com SSR, PWA e suporte offline |
| **Hub Site** | Next.js (App Router) | Portal de materiais e conteúdo para professores/admins |
| **Mobile** | Capacitor | Wrapper nativo para iOS e Android usando o frontend web |
| **Desktop** | Tauri (planejado) | App desktop multiplataforma |
| **Shared Lib** | TypeScript | Pacote `hub-core` compartilhado entre `frontend` e `hub-site` |
| **Tarefas Async** | Celery + Redis | Processamento de background (notificações, CEFR, relatórios) |

## Padrão de Módulo Backend

Cada módulo em `backend/app/modules/` segue a estrutura:

```
módulo/
├── routes/        # Endpoints FastAPI (camada HTTP)
├── services/      # Lógica de negócio e orquestração
├── repositories/  # Acesso a dados (quando aplicável)
├── schema/        # Schemas Pydantic (quando aplicável)
├── domain/        # Modelos de domínio (quando aplicável)
└── tasks.py       # Tasks Celery assíncronas (quando aplicável)
```
