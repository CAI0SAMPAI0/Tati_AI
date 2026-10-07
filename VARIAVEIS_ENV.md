# Variáveis de Ambiente (.env) — Tati AI

> Arquivo de referência rápida contendo **apenas as variáveis de ambiente** necessárias para configurar o Backend (Railway/Docker/Local) e o Frontend (Vercel/Local).

---

## 1. Backend (`backend/.env` ou Railway Variables)

### ⚙️ Core & Django
```env
# Chave secreta de segurança do Django (gere uma string aleatória forte)
SECRET_KEY=sua-chave-secreta-longa-e-segura-aqui

# Modo debug (deixe 'false' em produção)
DEBUG=false

# Nível de logging estruturado (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO

# URLs da aplicação para CORS e redirecionamentos
FRONTEND_URL=https://tati-ai.vercel.app
BACKEND_BASE_URL=https://tati-ai-production.up.railway.app

# E-mail para onde vão os feedbacks e notificações de erro
DEV_NOTIFICATION_EMAIL=cmsampaio71@gmail.com
DEFAULT_FROM_EMAIL=contato@tati-ai.com

# Permissões de usuários administrativos (separados por vírgula)
PROGRAMMER_USERNAMES=programador,admin,caio
ADMIN_USERNAMES=programador,admin,professor,professora
```

### 🗄️ Banco de Dados (PostgreSQL / Supabase)
```env
# String de conexão PostgreSQL padrão (Supabase, Railway ou local)
DATABASE_URL=postgresql://postgres:senha@db.exemplo.supabase.co:5432/postgres

# Conexões persistentes (0 para Supabase com PgBouncer, 60 para Postgres direto)
DB_CONN_MAX_AGE=0
```

### ⚡ Cache & Fila (Redis / Upstash / Celery)
```env
# URL de conexão Redis (Upstash ou Redis local)
REDIS_URL=redis://default:token@exemplo.upstash.io:6379
UPSTASH_REDIS_URL=redis://default:token@exemplo.upstash.io:6379
USE_REDIS_CACHE=true

# Celery e RabbitMQ (opcional se não usar Celery local)
CELERY_BROKER_URL=redis://default:token@exemplo.upstash.io:6379
USE_REDIS_CHANNELS=false
```

### 🧠 Modelagem de IA & RAG (LLMs, Groq, Embeddings e Cache)
```env
# Modelo principal do chat da Teacher Tatiana
LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct:novita
LLM_PROVIDER=meta_llama

# Modelo rápido da Groq para simulações, atividades e dicionário
GROQ_MODEL=openai/gpt-oss-120b

# Modelo de embeddings para o RAG
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5

# Chaves das APIs de Inteligência Artificial
GROQ_API_KEY=gsk_sua_chave_groq_aqui
# Você também pode fornecer múltiplas chaves separadas por vírgula:
# GROQ_KEYS=gsk_chave1,gsk_chave2,gsk_chave3

HF_TOKEN=hf_seu_token_huggingface_aqui
HF_TOKEN_LLAMA=hf_seu_token_huggingface_aqui

GEMINI_API_KEY=sua_chave_gemini_aqui

# Cache de IA (economiza chamadas de API e reduz latência)
AI_CACHE_ENABLED=true
AI_CACHE_TTL=86400
```

### 💤 Railway Serverless & Economia (Zero Sleep)
```env
# Ativa modo serverless no Railway para permitir que o container durma após inatividade
SERVERLESS=true

# Desativa a thread contínua de scheduler no container da API (evita pings no WAHA a cada 10 min)
ENABLE_NOTIFICATION_SCHEDULER=false
```

### 📲 WhatsApp (WAHA) & Webhooks de Notificação
```env
# Instância do WAHA no Render
WAHA_API_URL=https://waha-tati.onrender.com
WAHA_API_KEY=sua_chave_waha_aqui
WAHA_SESSION=professor

# Tokens para acionamento de crons externos (Vercel Cron, GitHub Actions, etc.)
CRON_SECRET=tati-ai-cron-secret-2026
CRON_TOKEN=cai0_based
```

### ✉️ Envio de E-mails (SMTP / Resend / Brevo)
```env
# Provedor Resend (recomendado para transacionais)
RESEND_API_KEY=re_sua_chave_resend_aqui
RESEND_FROM=Teacher Tatiana <contato@tati-ai.com>

# Ou SMTP tradicional (Gmail, Brevo, SendGrid)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=seu-usuario-smtp
SMTP_PASSWORD=sua-senha-smtp
SMTP_FROM=Teacher Tatiana <contato@tati-ai.com>
SMTP_FROM_NAME=Teacher Tati
```

### 🔑 Autenticação Google OAuth
```env
GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-google-client-secret
```

### 💳 Pagamentos (Mercado Pago)
```env
MP_ACCESS_TOKEN=APP_USR-seu-token-mercado-pago
FORWARD_WEBHOOK_URL=https://tati-ai-production.up.railway.app/api/payments/webhook
```

### 🔔 Web Push & PWA
```env
VAPID_PUBLIC_KEY=sua_chave_publica_vapid
VAPID_PRIVATE_KEY=sua_chave_privada_vapid
VAPID_CONTACT=mailto:contato@tati-ai.com
```

---

## 2. Frontend (`frontend/.env.local` ou Vercel Environment Variables)

```env
# URL base da API Django (produção ou local)
NEXT_PUBLIC_API_BASE_URL=https://tati-ai-production.up.railway.app

# URL base do WebSocket (usar wss:// em produção)
NEXT_PUBLIC_WS_BASE_URL=wss://tati-ai-production.up.railway.app/ws/voice

# URL pública da aplicação web (Vercel)
NEXT_PUBLIC_APP_URL=https://tati-ai.vercel.app

# URL do portal de materiais (Hub)
NEXT_PUBLIC_HUB_SITE_URL=https://tati-hub.vercel.app/materiais

# Google OAuth (mesmo Client ID do backend)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com

# CDN/Storage de visualização segura de materiais (Supabase Storage)
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages

# E-mail de suporte para o botão do catálogo
NEXT_PUBLIC_SUPPORT_EMAIL=contato@tati-ai.com

# Observabilidade (opcional)
NEXT_PUBLIC_SENTRY_DSN=
```
