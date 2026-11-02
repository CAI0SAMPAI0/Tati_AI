# Arquitetura e Guia do Backend

O backend do **Teacher Tatiana AI (Tati AI)** e uma aplicacao monolitica modular construida em **Python 3.11+**, **Django 5** e **Django Ninja**, projetada para operar tanto de forma sincrona (WSGI) quanto assincrona e em tempo real (ASGI com **Django Channels 4**, **Daphne** e **Uvicorn**), alem de suportar processamento em segundo plano com **Celery 5**.

---

## 1. Visao Geral e Estrutura de Diretorios

O codigo-fonte do backend reside integralmente em [`../backend/`](../backend/):

```text
backend/
├── ai/
│   └── prompts/             # Templates Markdown versionados para prompts de IA (com hot-reload)
├── app/                     # Nucleo do projeto Django (configuracoes, ASGI/WSGI, API central)
│   ├── settings/            # Configuracoes por ambiente (base, development, production, test)
│   ├── shared/services/     # Cliente HTTP REST para Upstash Redis (upstash.py)
│   ├── api.py               # Instancia principal NinjaAPI, handlers de erro, health/metrics e registro de routers
│   ├── asgi.py              # Roteador ProtocolTypeRouter (HTTP + WebSocket via Django Channels)
│   ├── celery.py            # Instancia Celery e agendamento periodico (Celery Beat)
│   ├── middleware.py        # Middlewares de normalizacao de URL, rate limit, telemetria e logs JSON
│   ├── tests.py             # Testes de endpoints de sistema (/health, /app/version)
│   ├── urls.py              # Mapeamento de rotas Django (/admin/, /api/v1/, /api/ e /)
│   └── wsgi.py              # Entrypoint WSGI tradicional
├── apps/                    # Aplicacoes de dominio do ecossistema Tati AI
│   ├── authentication/      # Login, registro, JWT, Google OAuth, recuperacao de senha e sessao ativa
│   ├── users/               # Perfil do aluno, nivel CEFR, ofensiva (streak), metas semanais e avatar
│   ├── chat/                # Tutor IA, simulacoes CEFR, WebSocket de voz/texto, STT/TTS e pipeline RAG
│   ├── activities/          # Flashcards SRS, podcasts, gramatica, pronuncia, Hub seguro, exames trimestrais
│   ├── dashboard/           # Painel administrativo da professora, curadoria, analytics e relatorios PDF/CSV
│   ├── notifications/       # Notificacoes in-app, WebPush (VAPID), FCM, e-mail (Brevo/Resend/SMTP) e WAHA
│   └── payments/            # Integracao Mercado Pago (PIX, Checkout Pro, Webhooks) e gestao de assinaturas
├── assets/                  # Imagens de avatar e recursos estaticos internos do backend
├── scripts/                 # Scripts operacionais (ex.: upload_hf.py para deploy no Hugging Face Spaces)
├── shared/                  # Utilitarios transversais (PromptManager, AICache, invalidacao de cache, async_db)
├── Dockerfile               # Imagem Docker completa (API + LibreOffice + Poppler + FFmpeg)
├── Dockerfile.api           # Imagem Docker enxuta para execucao serverless/API pura
├── manage.py                # Utilitario CLI do Django
└── requirements.txt         # Dependencias Python fixadas por faixa de versao
```

---

## 2. Configuracao por Ambiente (`backend/app/settings/`)

O modulo [`../backend/app/settings/__init__.py`](../backend/app/settings/__init__.py) seleciona automaticamente o perfil de configuracao com base na variavel `ENVIRONMENT` (quando `DJANGO_SETTINGS_MODULE` aponta para `app.settings`):

| Modulo | Criterio de Selecao | Caracteristicas Principais |
| :--- | :--- | :--- |
| `app.settings.development` | Padrao (`ENVIRONMENT=development`) | `DEBUG=True`, CORS permissivo para portas locais (`3000`, `3001`, `5173`), fallback para SQLite se `DATABASE_URL` ausente. |
| `app.settings.production` | `ENVIRONMENT=production` ou `prod` | `DEBUG=False`, cabecalhos de seguranca ativos (`SECURE_PROXY_SSL_HEADER`, `X_FRAME_OPTIONS=DENY`, `SESSION_COOKIE_SECURE`), CORS restrito. |
| `app.settings.test` | Definido explicitamente em CI/testes | Banco SQLite em memoria (`:memory:`), `LocMemCache`, `CELERY_TASK_ALWAYS_EAGER=True` e `UnmanagedModelTestRunner` para criar tabelas de modelos `managed = False`. |

As variaveis de ambiente sao carregadas por `python-dotenv` a partir de `backend/.env` ou do arquivo [`.env`](../.env.example) na raiz do monorepo.

---

## 3. Roteamento HTTP e Django Ninja (`backend/app/api.py`)

A instancia principal `NinjaAPI` (`version="2.0.0"`, titulo `"Teacher Tatiana AI API"`) expoe documentacao interativa OpenAPI (Swagger UI) em `/docs` (e consequentemente `/api/v1/docs` e `/api/docs`).

Em [`../backend/app/urls.py`](../backend/app/urls.py), o objeto `api.urls` e montado em tres prefixos para retrocompatibilidade entre clientes web e mobile:
- `/api/v1/` (prefixo canonico utilizado pelos frontends e pelo aplicativo Flutter)
- `/api/`
- `/`

### 3.1. Endpoints de Sistema

Definidos diretamente em [`../backend/app/api.py`](../backend/app/api.py):
- `GET /health` e `GET /healthz`: verificam conectividade com o banco de dados (`SELECT 1`), status do cache Redis e disponibilidade do agendador de notificacoes.
- `GET /metrics`: retorna metricas em memoria coletadas pelo `PerformanceMiddleware` (contagem por rota/status, tempo medio de resposta e requisicoes lentas acima de 1000 ms).
- `GET /app/version`: informa versao atual do aplicativo Android (`version_code`, `apk_url`) para atualizacao OTA no wrapper Flutter.
- `GET /cors-test`: diagnostico de cabecalhos e origens CORS permitidas.

### 3.2. Routers de Dominio Registrados

| Prefixo Base (sob `/api/v1`) | Modulo de Origem | Responsabilidade Principal |
| :--- | :--- | :--- |
| `/auth` | `apps.authentication.api` | Login (`/token` e `/login`), registro, refresh JWT, Google OAuth (`/google/login`, `/google/callback`, `/google/mobile`), heartbeat de presenca, logout e redefinicao de senha. |
| `/profile` | `apps.users.api` | Consulta e atualizacao do perfil do estudante, historico de XP, ofensiva (`streak`), congelamento de ofensiva (`freeze`) e nivel CEFR. |
| `/users` | `apps.users.api` | Alias administrativo/auxiliar do router de perfil e dados do usuario. |
| `/avatar` | `apps.users.api` | Servico de imagem do avatar da professora (`GET /avatar/teacher`). |
| `/activities` | `apps.activities.api` | Flashcards SRS, revisao de sexta-feira, modulos, podcasts, jogos Wordwall, noticias, leitura/listening (Test English, LiveWorksheets, LingoClip), proxy seguro de imagens, trofeus, ranking, meta semanal, feedback estudantil, reporte de bugs e leitura paginada com marca d'agua (`/hub/{id}/pages/{page}`). |
| `/catalog` | `apps.activities.api` | Catalogo publico do Hub de Materiais, inicio/cancelamento/consulta de checkout avulso e listagem de pedidos (`/orders`). |
| `/grammar` | `apps.activities.api` | Topicos e guias gramaticais filtrados por nivel CEFR (A1 a C1). |
| `/speech` | `apps.activities.api` | Avaliacao fonetica de pronuncia (`/verify-pronunciation`), transcricao STT (`/transcribe`), sintese TTS (`/tts`) e historico de pronuncia (`/pronunciation-history`). |
| `/exams` | `apps.activities.api` | Exames trimestrais adaptativos (`/trimestral/status`, `/start`, `/current`, `/submit`, `/history`, `/{exam_id}`, `/reset`). Atualmente restritos por flag de autorizacao a professores e programadores em fase de validacao. |
| `/chat` | `apps.chat.api` | Criacao/listagem/exclusao de conversas, envio de mensagens de texto e voz com correcao gramatical, sugestoes de estudo, analise contextual de palavras (`/word-info`), exportacao em PDF/DOCX e teste de nivelamento CEFR (`/leveling/*`). |
| `/simulation` | `apps.chat.simulation_api` | Listagem de cenarios de roleplay (estaticos e gerados por IA via `CEFRSimulation`), inicio de sessao e avaliacao final da simulacao. |
| `/payments` | `apps.payments.api` | Planos de assinatura, checkout PIX e Cartao via Mercado Pago, status de assinatura, cancelamento e receptor de webhooks (`/webhook`). |
| `/notifications` | `apps.notifications.api` | Listagem de notificacoes in-app, marcacao de leitura, exclusao, chave publica VAPID (`/vapid-public-key`), registro de subscricoes WebPush e tokens nativos FCM (`/fcm-subscribe`). |
| `/dashboard` | `apps.dashboard.api` | Estatisticas da turma, CRUD de alunos, gestao de jogos/noticias/flashcards/simulacoes, curadoria de feedbacks, exportacao de relatorios PDF/CSV e envio de comunicados via WhatsApp (WAHA). |
| `/flashcard-assets` | `apps.activities.api` | Upload de imagens para Cloudinary e geracao de ilustracoes pedagogicas com IA (FLUX.1-dev / Unsplash / Pexels). |
| `/admin/premium` | `apps.activities.api` | Gestao administrativa dos materiais pagos/gratuitos do Hub e sincronizacao de paginas WebP seguras. |
| `/cefr/admin` | `apps.activities.api` | Upload e indexacao de apostilas PDF/TXT (`cefr_documents`), extracao de topicos com IA, geracao de flashcards/simulacoes CEFR e agendamentos automaticos (`CEFRSchedule`). |
| `/cefr/images` | `apps.activities.api` | Resolucao individual e em lote de imagens ilustrativas para vocabulario CEFR. |
| `/tasks` | `apps.dashboard.api` | Consulta de status de tarefas assincronas do Celery (`GET /tasks/{task_id}`). |

---

## 4. Comunicacao em Tempo Real (WebSockets e Channels)

A configuracao ASGI em [`../backend/app/asgi.py`](../backend/app/asgi.py) utiliza `ProtocolTypeRouter` do Django Channels para separar trafego HTTP e conexoes WebSocket:

- **Rotas WebSocket implementadas** ([`../backend/apps/chat/routing.py`](../backend/apps/chat/routing.py)):
  - `ws/chat`
  - `chat/ws`
- **Consumidor**: `ChatConsumer` ([`../backend/apps/chat/consumers.py`](../backend/apps/chat/consumers.py)), baseado em `AsyncJsonWebsocketConsumer`.
  - Autentica o usuario via query string `?token=<jwt>` na abertura da conexao (`connect`).
  - Processa pacotes JSON de texto (`text`), audio em Base64 (`audio_b64` -> STT -> LLM -> TTS com suporte a sotaques em `VOICE_ACCENT_MAP`) e `ping`/`pong`.
  - Registra historico de mensagens em `conversations` e `messages` de forma assincrona (`sync_to_async`).
- **Channel Layer**: por padrao utiliza `InMemoryChannelLayer` para evitar latencia de rede em deploy de instancia unica; pode ser chaveado para `channels_redis.core.RedisChannelLayer` definindo `USE_REDIS_CHANNELS=true` e `REDIS_URL`.
- **Observacao sobre `/payments/ws`**: o portal `apps/hub-site` possui o hook cliente `usePaymentWebSocket.ts` apontando para `/payments/ws`, porem nao ha consumidor registrado para essa rota no `asgi.py` atual. Na implementacao vigente, a confirmacao de pagamento em tempo real no checkout opera por polling HTTP (`GET /api/v1/catalog/checkout/{payment_id}/status`) aliado ao webhook do Mercado Pago (`POST /api/v1/payments/webhook`).

---

## 5. Seguranca, Autenticacao e Middlewares

### 5.1. Autenticacao JWT e Controle de Acesso (`apps/authentication/security.py`)

- **Tokens JWT (`PyJWT`, algoritmo `HS256`)**:
  - `access` token: validade padrao de 7 dias (`ACCESS_TOKEN_EXPIRE_MINUTES = 10080`), contendo `sub` (username), `role`, `sid` (`active_session_id`) e `type: "access"`.
  - `refresh` token: validade de 30 dias (`REFRESH_TOKEN_EXPIRE_DAYS = 30`), aceito exclusivamente no endpoint de renovacao.
  - `hub_page_view` token: validade curta (2 horas), escopo estrito `hub_read:{content_id}` para carregar imagens de paginas protegidas no leitor digital sem expor o JWT principal na URL de imagem.
- **Controle de sessao simultanea**: para contas de alunos (`role="student"`), o campo `active_session_id` no modelo `User` invalida sessoes anteriores quando um novo login e realizado (exceto contas na whitelist de testes/professores).
- **Dependencias de autorizacao**:
  - `auth_required` (`AuthBearer`): exige Bearer token valido (ou query `?token=` em rotas especificas).
  - `auth_optional` (`OptionalAuthBearer`): resolve o usuario se autenticado ou prossegue como visitante (`None`).
  - `require_teacher(user)`: restringe rotas administrativas a usuarios com `role in ("teacher", "admin")` ou superusuarios.

### 5.2. Pipeline de Middlewares Customizados (`backend/app/middleware.py`)

Alem dos middlewares nativos do Django e `corsheaders.middleware.CorsMiddleware`, o backend aplica:
1. `NormalizePathMiddleware`: colapsa barras duplicadas (`//api/v1/...` -> `/api/v1/...`) para evitar erros 404 em clientes web/mobile.
2. `RateLimitMiddleware`: limitador em janela deslizante baseado no cache Django (`120 req/min` para rotas gerais e `30 req/min` para endpoints sensiveis de autenticacao como `/auth/login`, `/auth/token` e `/auth/register`), retornando HTTP `429` com `Retry-After`.
3. `PerformanceMiddleware`: mede a latencia de cada requisicao, injeta o cabecalho `X-Process-Time-Ms` e alimenta o endpoint `/metrics`.
4. `StructuredLoggingMiddleware`: emite logs estruturados em JSON contendo metodo, caminho, status HTTP, duracao em milissegundos e usuario.

---

## 6. Banco de Dados e Modelos Nao Gerenciados (`managed = False`)

O sistema utiliza **PostgreSQL** em producao (hospedado em Supabase ou Railway, conectado via `dj-database-url` e `psycopg2-binary`).

### Particularidade Arquitetural Importante

Quase todos os modelos ORM do projeto mapeiam tabelas pre-existentes no PostgreSQL com `managed = False` na classe `Meta`:
- `apps.authentication.models`: `User` (`db_table = "users"`).
- `apps.chat.models`: `Conversation` (`conversations`), `Message` (`messages`), `CEFRSimulation` (`cefr_simulations`).
- `apps.activities.models`: `Flashcard` (`cefr_flashcards`), `Module` (`modules`), `Podcast` (`podcasts`), `Trophy` (`trophies`), `PremiumContent` (`premium_content`), `Game` (`games`), `NewsItem` (`news`), `ActivitySubmission` (`activity_submissions`), `CEFRReference` (`cefr_references`), `CEFRSchedule` (`cefr_schedules`), `StudentFeedback` (`student_feedbacks`), `DeveloperBugReport` (`developer_bug_reports`), `TrimestralExam` (`trimestral_exams`).
- `apps.payments.models`: `Order` (`orders`), `Subscription` (`subscriptions`), `PremiumPurchase` (`premium_purchases`).
- `apps.notifications.models`: `Notification` (`notifications`), `PushSubscription` (`push_subscriptions`).

A excecao gerenciada diretamente pelas migrations padrao do Django e `PronunciationHistory` (`pronunciation_history`, `managed = True`). Alem disso, a tabela vetorial `cefr_documents` e manipulada via SQL direto (`psycopg2`) pelo subsistema RAG.

Para permitir testes automatizados isolados sem PostgreSQL externo, [`../backend/app/settings/test.py`](../backend/app/settings/test.py) define `UnmanagedModelTestRunner`, que converte temporariamente os modelos para `managed = True` e cria as tabelas em SQLite `:memory:` antes da suite de testes.

---

## 7. Inteligencia Artificial, Prompts, RAG e Audio

### 7.1. Provedores de LLM e Roteamento de Modelos
- **Tutor conversacional e simulacoes**: integra **Meta Llama 3.1 8B Instruct** via Hugging Face Router (`HF_TOKEN`, modelo padrao `meta-llama/Llama-3.1-8B-Instruct:novita`) e **Groq** (`GROQ_API_KEY`, modelos `openai/gpt-oss-120b` e `openai/gpt-oss-20b`), alem de suporte ao SDK **Google Gemini** (`GEMINI_API_KEY` / `GOOGLE_API_KEY`).
- **Gerenciamento de Prompts**: [`../backend/shared/prompt_manager.py`](../backend/shared/prompt_manager.py) carrega os arquivos `.md` em [`../backend/ai/prompts/`](../backend/ai/prompts/) (`tati_system_prompt.md`, `chat_simulation.md`, `pronunciation_teacher.md`, `exam_generator_system.md`, `cefr_activity_generator.md`, etc.), verificando `mtime` em disco para aplicar alteracoes sem reiniciar o servidor.

### 7.2. Pipeline RAG (`backend/apps/chat/rag/`)
- Divide apostilas e materiais CEFR em chunks semanticos (`chunking.py`).
- Gera embeddings vetoriais de 1024 dimensoes com `BAAI/bge-large-en-v1.5` (`embeddings.py`).
- Armazena e consulta documentos na tabela `cefr_documents` (`vector_store.py`, `retrieval.py`, `rag_service.py`).
- Comando CLI de ingestao: `python backend/manage.py ingest_rag_materials` (suporta pasta local ou sincronizacao via Google Drive em `drive_ingest.py`).

### 7.3. Processamento de Fala (`AudioService` e `SpeechService`)
- **STT (Speech-to-Text)**: transcricao de audio em tempo real via **Groq Whisper** (`whisper-large-v3` / `whisper-large-v3-turbo`).
- **TTS (Text-to-Speech)**: sintese neural gratuita via **Edge TTS** (`edge-tts`) com suporte a multiplos sotaques da lingua inglesa (`en-US`, `en-GB`, `en-AU`, `en-CA`, `en-IE`, `en-IN`) e fallback para `gTTS`.
- **Avaliacao de Pronuncia**: compara transcricao, fluencia e acuracia palavra por palavra e persiste o resultado em `PronunciationHistory`.

---

## 8. Cache, Tarefas Assincronas e Modo Serverless

### 8.1. Camadas de Cache
1. **Cache Django (`django-redis` / `LocMemCache`)**: configurado via `REDIS_URL` (compativel com Redis padrao e Upstash TLS `rediss://`).
2. **Cliente REST Upstash (`app/shared/services/upstash.py`)**: utiliza `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` quando conexoes HTTP stateless sao preferiveis.
3. **`AICache` (`shared/ai_cache.py`)**: cache hibrido em dois niveis (Redis + LRU em RAM limitado a 500 entradas) para evitar chamadas repetidas de LLM e TTS em mensagens identicas.
4. **Invalidacao Seletiva (`shared/cache.py`)**: `invalidate_user_cache(username)` limpa chaves derivadas de perfil, progresso e dashboard apos submissoes de atividades.

### 8.2. Celery vs Agendador Interno vs Serverless
- **Celery (`app/celery.py`)**: executa tarefas pesadas fora do ciclo HTTP:
  - `apps.activities.tasks.sync_hub_materials_task` (conversao de PDFs/DOCX do Hub em paginas WebP via LibreOffice + Poppler `pdf2image` / `PyMuPDF`).
  - `apps.activities.tasks.generate_cefr_deck_task` (geracao de baralhos CEFR com IA).
  - `apps.notifications.tasks.*` (lembretes de ofensiva as 19h BRT, resumo semanal aos domingos as 10h BRT, disparos de e-mail e WebPush).
- **`BackgroundNotificationRunner` (`apps/notifications/scheduler.py`)**: thread daemon leve iniciada em `NotificationsConfig.ready()` quando `ENABLE_NOTIFICATION_SCHEDULER=true` e `SERVERLESS=false`, garantindo alertas de ofensiva, inatividade e agendamentos CEFR mesmo em ambientes sem container Celery Beat dedicado.
- **Modo Serverless (`SERVERLESS=true` / `Dockerfile.api`)**: desativa threads de background persistentes para execucao efemera.

---

## 9. Integracao de Pagamentos e Regra de Cobranca

O modulo [`../backend/apps/payments/`](../backend/apps/payments/) integra exclusivamente o SDK oficial do **Mercado Pago** (`mercadopago`):
- **Compras avulsas no Hub de Materiais (`/api/v1/catalog/checkout`)**: ativas imediatamente via PIX (QR Code Base64 + codigo copia-e-cola) e Cartao/Checkout Pro, registrando pedidos em `orders` e liberando acesso em `premium_purchases`.
- **Assinaturas da plataforma (`/api/v1/payments/checkout/pix` e `/checkout/card`)**: controladas pelas variaveis `SUBSCRIPTION_BILLING_ENABLED` (padrao `false`) e `SUBSCRIPTION_BILLING_START_DATE` (padrao `2027-03-01`). Enquanto a cobranca recorrente nao estiver habilitada ou antes da data configurada, tentativas de assinatura retornam aviso informativo sem gerar cobranca aos alunos.
- **Observacao sobre colunas legadas**: os modelos `User`, `Order` e `Subscription` preservam colunas nomeadas `asaas_customer_id`, `asaas_id` e `asaas_payment_id` apenas por compatibilidade com o esquema historico do banco PostgreSQL, armazenando nelas os identificadores retornados pelo Mercado Pago.

---

## 10. Comandos de Gerenciamento Customizados e Testes

### Comandos CLI (`manage.py`)
- `python backend/manage.py ingest_rag_materials`: ingere apostilas locais ou do Google Drive na base vetorial RAG.
- `python backend/manage.py run_cefr_schedules`: processa agendamentos ativos de geracao de flashcards e simulacoes CEFR (`--force` disponivel).
- `python backend/manage.py migrate_flashcards_visual`: atualiza baralhos legados para o formato visual com ilustracoes.

### Execucao da Suite de Testes
```bash
# A partir da raiz do repositorio (Linux/macOS)
DJANGO_SETTINGS_MODULE=app.settings.test python backend/manage.py test app apps.authentication apps.activities --noinput
```

```powershell
# PowerShell (Windows)
$env:DJANGO_SETTINGS_MODULE="app.settings.test"
.\.venv\Scripts\python.exe backend\manage.py test app apps.authentication apps.activities --noinput
```
