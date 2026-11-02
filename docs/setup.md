# Guia de Configuracao e Execucao Local (Setup)

Este guia detalha todos os passos verificados para configurar e executar localmente o monorepo **Tati AI** (Backend Django 5 + Django Ninja, Frontend Vue 3, Portal Hub de Materiais e servicos auxiliares).

---

## 1. Pre-requisitos

- **Python**: `3.11` ou `3.12` (validado na CI com Python `3.12`).
- **Node.js**: `20+` com **npm** (suporte a NPM Workspaces).
- **Banco de Dados**: instancia **PostgreSQL 15+** (local, Docker, Supabase ou Railway). Para testes rapidos ou inspecao basica sem `DATABASE_URL`, o modo `development` possui fallback para SQLite (`backend/db.sqlite3`), mas recursos que consultam tabelas pre-existentes ou extensoes PostgreSQL requerem um banco PostgreSQL configurado.
- **Redis** *(opcional em desenvolvimento)*: local ou Upstash (`REDIS_URL`). Sem Redis configurado, o Django utiliza `LocMemCache` em memoria e `InMemoryChannelLayer` para WebSockets.
- **Dependencias nativas opcionais** *(apenas para conversao local de documentos do Hub e processamento de audio)*:
  - `FFmpeg` (conversao/manipulacao de audio)
  - `LibreOffice` + `Poppler` (`pdftoppm` para conversao de PDF/DOCX em paginas WebP no `secure_document_service.py`)

---

## 2. Clonagem e Instalacao de Dependencias

### 2.1. Dependencias Node.js (Monorepo)
Na raiz do repositorio, um unico comando instala as dependencias compartilhadas de `frontend/`, `apps/hub-site/`, `packages/hub-core/` e Playwright:

```bash
git clone <url-do-repositorio>
cd Tati_AI
npm install
```

> **Nota sobre `package.json` na raiz**: a chave `workspaces` lista `frontend`, `frontend-backup`, `apps/*` e `packages/*`. O diretorio `frontend-backup` nao existe mais no repositorio e e ignorado com seguranca pelo npm.

### 2.2. Ambiente Virtual e Dependencias Python (`backend/`)

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

---

## 3. Variaveis de Ambiente

Crie os arquivos `.env` a partir dos templates versionados (nunca versione arquivos `.env` reais):

1. **Raiz / Backend**: copie [`.env.example`](../.env.example) para `.env` na raiz do projeto (ou `backend/.env`).
2. **Frontend Principal**: copie [`../frontend/.env.example`](../frontend/.env.example) para `frontend/.env`.
3. **Portal Hub**: copie [`../apps/hub-site/.env.example`](../apps/hub-site/.env.example) para `apps/hub-site/.env`.

### 3.1. Principais Variaveis do Backend (`.env`)

| Variavel | Obrigatoria? | Descricao |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Recomendada | `development` (padrao) ou `production`. |
| `SECRET_KEY` / `DJANGO_SECRET_KEY` | Sim (em prod) | Chave criptografica do Django. |
| `JWT_SECRET_KEY` | Sim (em prod) | Segredo `HS256` usado para assinar tokens JWT de sessao e leitura do Hub. |
| `DATABASE_URL` | Sim (PostgreSQL) | URL de conexao `postgresql://user:pass@host:5432/dbname`. |
| `GROQ_API_KEY` | Sim (para IA/STT) | Chave da API Groq (modelos LLM e transcricao Whisper). |
| `HF_TOKEN` | Sim (para Tutor IA) | Token Hugging Face Router (Llama 3.1 e geracao de imagens FLUX). |
| `GEMINI_API_KEY` | Opcional | Chave Google Gemini para fluxos auxiliares de IA. |
| `REDIS_URL` | Opcional em dev | Conexao `redis://` ou `rediss://` para cache Django, Celery e Channels. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Opcional | Credenciais HTTP REST do Upstash Redis. |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` | Para checkout | Credenciais do Mercado Pago para PIX e Cartao. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Recomendada | Assinatura HMAC para validacao de webhooks em `/api/v1/payments/webhook`. |
| `SUBSCRIPTION_BILLING_ENABLED` | Opcional | `false` por padrao; controla cobranca de assinaturas recorrentes junto a `SUBSCRIPTION_BILLING_START_DATE`. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Para uploads | Armazenamento de avatares, imagens de flashcards e capturas de bug. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Para OAuth | Credenciais Google OAuth 2.0. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_ADMIN_EMAIL` | Para WebPush | Chaves VAPID para notificacoes push no navegador. |
| `BREVO_API_KEY` / `RESEND_API_KEY` / `SMTP_*` | Para e-mails | Provedores de envio de recuperacao de senha, relatorios e alertas. |
| `WAHA_API_URL` / `WAHA_API_KEY` / `WAHA_SESSION` | Opcional | Integracao WhatsApp HTTP API para comunicados da professora. |

### 3.2. Variaveis do `frontend/.env`

```ini
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws/chat
VITE_GOOGLE_CLIENT_ID=
VITE_HUB_SITE_URL=http://localhost:3001/materiais
```

### 3.3. Variaveis do `apps/hub-site/.env`

```ini
VITE_API_URL=http://localhost:8000/api/v1
VITE_MAIN_SITE_URL=http://localhost:3000
VITE_AUTH_COOKIE_DOMAIN=
```

> Em desenvolvimento local, tanto `frontend/vite.config.ts` quanto `apps/hub-site/vite.config.ts` ja configuram proxy reverso automatico de `/api` e WebSockets para `http://127.0.0.1:8000`.

---

## 4. Banco de Dados e Migrations

Antes de iniciar o backend, valide a configuracao Django e aplique as migrations internas (tabelas nativas do Django, `django_celery_results`, `django_celery_beat` e `pronunciation_history`):

```bash
python backend/manage.py check
python backend/manage.py migrate
```

> **Importante sobre `managed = False`**: conforme detalhado em [`backend.md`](./backend.md), a maior parte dos modelos de dominio (`users`, `conversations`, `messages`, `cefr_flashcards`, `premium_content`, `orders`, etc.) mapeia tabelas PostgreSQL existentes com `managed = False`. O comando `migrate` nao recria essas tabelas automaticamente em um banco PostgreSQL vazio; em novos ambientes de producao/homologacao, conecte ao esquema PostgreSQL existente do projeto. Para testes automatizados locais sem banco externo, utilize o perfil `app.settings.test` (Secao 7).

---

## 5. Executando os Servicos Localmente

Abra terminais separados para cada processo necessario:

### Terminal 1 — Backend API + WebSockets (Porta `8000`)

Com suporte completo a HTTP e WebSockets via ASGI (**Daphne** ou **Uvicorn**):
```bash
# Usando o manage.py (com Daphne instalado noINSTALLED_APPS, runserver ja sobe ASGI)
python backend/manage.py runserver 0.0.0.0:8000

# Alternativa explicita com Uvicorn (a partir da pasta backend/)
cd backend
uvicorn app.asgi:application --host 0.0.0.0 --port 8000 --reload
```

A documentacao interativa da API ficara disponivel em:
- `http://localhost:8000/docs` (ou `http://localhost:8000/api/v1/docs`)
- Healthcheck: `http://localhost:8000/health`

### Terminal 2 — Frontend Principal (Porta `3000`)
Na raiz do repositorio:
```bash
npm run dev:frontend
# (Nota: o script "npm run dev" na raiz tambem inicia apenas o workspace frontend)
```
Acesse em `http://localhost:3000`.

### Terminal 3 — Portal Hub de Materiais (Porta `3001`)
Na raiz do repositorio:
```bash
npm run dev:hub
```
Acesse em `http://localhost:3001/materiais`.

### Terminal 4 — Celery Worker e Beat *(Opcional em dev)*
Necessario apenas se estiver testando filas assincronas com Redis ativo:
```bash
cd backend
celery -A app worker --loglevel=info --pool=solo
# Em outro terminal (agendamentos periodicos):
celery -A app beat --loglevel=info
```
*(Em Windows, utilize `--pool=solo` no Celery Worker).*

---

## 6. Execucao via Docker Compose

O arquivo [`../docker-compose.yml`](../docker-compose.yml) sobe quatro containers integrados (`backend` na porta `8000`, `frontend` na porta `3000`, `celery_worker` e `celery_beat`), lendo `DATABASE_URL`, `REDIS_URL` e demais credenciais do arquivo `.env` da raiz:

```bash
docker compose up --build
```

> O `docker-compose.yml` nao provisiona containers locais de PostgreSQL ou Redis; ele espera URLs acessiveis (como Supabase e Upstash/Redis externo) definidas no `.env`.

---

## 7. Executando Testes e Verificacoes

### 7.1. Testes Automatizados do Backend (Django)
O runner customizado em `app.settings.test` cria todas as tabelas em SQLite em memoria (`:memory:`), dispensando PostgreSQL ou Redis externos:

```bash
# Linux / macOS
DJANGO_SETTINGS_MODULE=app.settings.test python backend/manage.py test app apps.authentication apps.activities --noinput
```

```powershell
# Windows (PowerShell)
$env:DJANGO_SETTINGS_MODULE="app.settings.test"
.\.venv\Scripts\python.exe backend\manage.py test app apps.authentication apps.activities --noinput
```

> **Observacao sobre `npm test`**: o script `"test"` em [`../package.json`](../package.json) ainda referencia `python -m pytest backend/tests/` (diretorio inexistente da stack antiga). Utilize sempre `manage.py test` conforme acima e conforme configurado em [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### 7.2. Typecheck e Build dos Frontends
```bash
npm run typecheck
npm run build --workspace frontend
npm run build --workspace @tati/hub-site
```

### 7.3. Testes End-to-End (Playwright)
Configurados em [`../playwright.config.ts`](../playwright.config.ts):
```bash
npx playwright test
```
