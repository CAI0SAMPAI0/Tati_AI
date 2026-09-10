<div align="center">

# 🤖 Teacher Tati AI (Taty's English) 📚
### *Plataforma Inteligente de Ensino de Inglês com IA Conversacional 24/7, Avatar Reativo e Ecossistema Multiplataforma*

<br />

<p align="center">
  <img src="./frontend/public/images/tati_logo.jpg" alt="Teacher Tati Logo" width="140" style="border-radius: 50%; box-shadow: 0 4px 14px rgba(0,0,0,0.15); margin-right: 15px;" />
</p>

[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Django](https://img.shields.io/badge/Django_5-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django Ninja](https://img.shields.io/badge/Django_Ninja-092E20?style=for-the-badge&logo=fastapi&logoColor=white)](https://django-ninja.dev/)
[![Django Channels](https://img.shields.io/badge/Django_Channels-2C3E50?style=for-the-badge&logo=websocket&logoColor=white)](https://channels.readthedocs.io/)
[![Daphne](https://img.shields.io/badge/Daphne_ASGI-0B3C5D?style=for-the-badge&logo=python&logoColor=white)](https://github.com/django/daphne)
[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev/)
[![GPT-OSS-20B](https://img.shields.io/badge/GPT--OSS--20B-10A37F?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Mercado Pago](https://img.shields.io/badge/Mercado_Pago-009EE3?style=for-the-badge&logo=mercadopago&logoColor=white)](https://www.mercadopago.com.br/developers)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)

<br />

**[Visão Geral](#-visão-geral)** •
**[Preview & Funcionalidades](#-preview--funcionalidades-chave)** •
**[Arquitetura](#%EF%B8%8F-arquitetura-do-sistema)** •
**[Estrutura do Monorepo](#-estrutura-do-monorepo)** •
**[Como Começar](#-como-começar-desenvolvimento-local)** •
**[Variáveis de Ambiente](#-variáveis-de-ambiente)** •
**[Deploy](#-deploy--produção)**

---

</div>

## 📖 Visão Geral

O **Teacher Tati AI** é um ecossistema educacional de última geração voltado ao aprendizado prático, dinâmico e imersivo da língua inglesa. A plataforma reúne uma tutora virtual baseada em modelos de inteligência artificial de ponta — liderados por **GPT-OSS-20B** (via Groq) para diálogos velozes e pelo poder multimodal do **Google Gemini** (Gemini 1.5 Flash/Pro e Gemini Vision) — combinada à síntese de voz natural (Edge TTS / ElevenLabs) e a um **avatar animado reativo**, permitindo conversações realistas com sincronização labial e expressões em tempo real.

O projeto é mantido em um **Monorepo gerenciado com NPM Workspaces**, conectando:
- **Backend ASGI:** Construído com **Django 5**, **Django-Ninja** (para endpoints RESTful de alta tipagem e velocidade), **Django Channels** (para WebSockets bidirecionais de chat e voz) e servidor **Daphne**.
- **Frontend do Aluno:** Aplicação moderna em **Next.js 14 (App Router)** com suporte a PWA, modo offline e design fluido com Tailwind CSS.
- **Hub de Materiais (Hub Site):** Portal Next.js 14 dedicado à venda, catálogo e leitura protegida de materiais didáticos.
- **Mobile Nativo (Flutter):** App mobile Flutter com 120 FPS, gravação nativa de microfone e notificações push via Firebase (FCM).
- **Pacote Compartilhado (`@tati/hub-core`):** SDK com tipagens, gerenciamento de sessão/cookies e contratos de API unificados.
- **Pagamentos Integrados:** Checkout transparente e geração de PIX dinâmico com confirmação instantânea via **Mercado Pago**.

---

## 📸 Preview & Funcionalidades Chave

### 1. Avatar Reativo & Chat de Voz em Tempo Real
A IA reage visual e auditivamente conforme a fala do aluno, comutando expressões faciais em tempo real de acordo com o estado da conversa:

| Expressão Padrão | Ouvindo o Aluno | Falando / Ensinando | Reação / Feedback |
| :---: | :---: | :---: | :---: |
| <img src="./backend/assets/avatar/avatar_tati_normal.webp" width="160" alt="Tati Normal" style="border-radius:12px;" /> | <img src="./backend/assets/avatar/avatar_tati_ouvindo.webp" width="160" alt="Tati Ouvindo" style="border-radius:12px;" /> | <img src="./backend/assets/avatar/avatar_tati_aberta.webp" width="160" alt="Tati Falando" style="border-radius:12px;" /> | <img src="./backend/assets/avatar/tati_surpresa.webp" width="160" alt="Tati Surpresa" style="border-radius:12px;" /> |
| **Pronta para interagir** | **Microfone ativo (STT)** | **Síntese de áudio (TTS)** | **Correção e incentivo** |

* 🎙️ **Full Voice Mode via Django Channels:** Fluxo de áudio bidirecional e contínuo via WebSockets (`ws/live` e `chat/ws`), integrando Whisper (STT) e Edge TTS / ElevenLabs.
* 🗣️ **Pronunciation Reader & Challenge:** Treinamento fonético com pontuação de precisão de pronúncia palavra por palavra.

---

### 2. Destaques da Plataforma

* 🧠 **Pipeline de IA com GPT-OSS-20B & Gemini:**
  * **GPT-OSS-20B:** Modelo principal para conversação didática instantânea com baixíssima latência (Groq).
  * **Google Gemini (1.5 Flash / 2.0 Flash / 1.5 Pro):** Geração inteligente de questionários, nivelamento pedagógico, fallback automático e **Gemini Vision** para leitura e OCR de documentos/apostilas.
* 💳 **Pagamentos Nativos com Mercado Pago:**
  * Cobranças via **PIX instantâneo** com QR Code dinâmico e código Copia e Cola.
  * **Checkout Preferences** para pagamentos com cartão de crédito ou boleto.
  * Processamento de **Webhooks** com liberação em tempo real de assinaturas e materiais didáticos.
* 🎯 **Diagnóstico e Alinhamento CEFR (A1 a B2):** Prova de diagnóstico inicial e nivelamento contínuo das respostas do aluno.
* 🗂️ **Sistema SRS (Spaced Repetition System):** Algoritmo de repetição espaçada para memorização eficiente de vocabulário.
* 🏆 **Gamificação Completa:** Pontuação de experiência (XP), ofensivas diárias (*streaks*), troféus e ranking competitivo semanal.
* 🎧 **Podcasts Interativos:** Recomendações e exercícios de áudio baseados no histórico de aprendizado.
* 📚 **Hub de Materiais & Leitor Seguro:** Catálogo de apostilas com leitor seguro de PDF contra cópia e download não autorizado.
* 📱 **Ecossistema Multiplataforma:** Web PWA instalável + App Nativo Flutter com áudio nativo e push notifications via Firebase.

---

## 🏗️ Arquitetura do Sistema

### Diagrama de Módulos & Integrações

```mermaid
flowchart TB
    subgraph Clients["📱 Clientes & Interfaces"]
        WEB["App Aluno (Next.js 14)<br/>• App Router, Tailwind, Zustand<br/>• PWA & Suporte Offline"]
        HUB["Hub Site (Next.js 14)<br/>• Catálogo de Materiais Didáticos<br/>• Leitor Seguro de PDFs"]
        MOB["Mobile App (Flutter)<br/>• 120 FPS InAppWebView<br/>• Áudio Nativo & Firebase Push (FCM)"]
    end

    subgraph Shared["📦 Pacotes Compartilhados"]
        CORE["@tati/hub-core<br/>Tipagens, SDK, Auth-Cookie & Sessão"]
    end

    subgraph Backend["⚙️ Backend ASGI (Django 5 + Django-Ninja + Channels)"]
        DAPHNE["Daphne ASGI Server (Port 8080 / 7860)"]
        WS["Django Channels (WebSockets)<br/>• chat/ws • ws/live • live audio stream"]
        REST["Django-Ninja Router (REST API):<br/>• /auth • /profile • /users<br/>• /activities • /catalog • /cefr<br/>• /payments • /dashboard"]
        CELERY["Workers Celery + Celery Beat<br/>Tarefas Async, Notificações, SRS"]
    end

    subgraph CloudServices["☁️ Serviços Externos & Infraestrutura"]
        SUPABASE[("PostgreSQL / Supabase")]
        REDIS[("Redis / Upstash<br/>(Channel Layer & Cache)")]
        AI["Modelos de IA:<br/>• GPT-OSS-20B (Groq)<br/>• Google Gemini (Flash, Pro, Vision)"]
        TTS["Áudio: Edge TTS, ElevenLabs, Whisper"]
        MP["Pagamentos: Mercado Pago<br/>• PIX Instantâneo & Preferences"]
        STORAGE["Mídia: Cloudinary & Poppler"]
        FCM["Push: Firebase Cloud Messaging & WebPush"]
    end

    WEB --> CORE
    HUB --> CORE
    WEB -- "HTTP REST" --> REST
    WEB -- "WebSockets" --> WS
    HUB -- "HTTP REST" --> REST
    MOB -- "HTTP & WebSockets" --> DAPHNE

    DAPHNE --> WS
    DAPHNE --> REST
    REST --> CELERY
    REST --> SUPABASE
    WS --> REDIS
    REST --> AI
    WS --> AI
    WS --> TTS
    REST --> MP
    REST --> STORAGE
    CELERY --> FCM
```

---

### Fluxo de Conversação de Voz em Tempo Real

```mermaid
sequenceDiagram
    autonumber
    actor Aluno as 👤 Aluno
    participant App as 💻 Frontend / Flutter
    participant WS as ⚡ Django Channels (WebSocket)
    participant LLM as 🧠 GPT-OSS-20B / Gemini
    participant Audio as 🔊 TTS & Visemes (Edge / ElevenLabs)

    Aluno->>App: Fala frase em inglês pelo microfone
    App->>WS: Transmissão contínua de áudio via WebSocket (ws/live)
    WS->>LLM: Contexto da conversa + perfil pedagógico CEFR
    LLM-->>WS: Resposta didática da Teacher Tati + correções
    WS->>Audio: Síntese de fala + extração de visemas e expressões
    Audio-->>WS: Stream de áudio comprimido + estado do avatar (aberta, ouvindo, surpresa)
    WS-->>App: Reprodução de voz sincronizada à animação facial
    App-->>Aluno: Teacher Tati responde falando e expressando reação
```

---

## 📂 Estrutura do Monorepo

```text
Tati_AI/
├── apps/
│   └── hub-site/                # Portal público de catálogo e leitura de apostilas (Next.js 14)
├── packages/
│   └── hub-core/                # SDK TypeScript, tipagens unificadas e controle de sessão
├── frontend/                    # Aplicação web principal do aluno (Next.js 14 + App Router + PWA)
│   ├── app/
│   │   ├── (authenticated)/     # Rotas com autenticação: chat, voice, flashcards, progresso, etc.
│   │   └── (public)/            # Rotas públicas: login, recuperação de senha
│   ├── components/              # Componentes de UI, chat em tempo real, dashboard e gráficos
│   ├── hooks/                   # Hooks customizados (useAuth, useChatSocket, useVoiceSocket)
│   └── public/                  # Manifesto PWA, service worker, imagens e ícones
├── backend/                     # API principal (Django 5 + Django-Ninja + Channels ASGI)
│   ├── app/                     # Configuração Django, ASGI (ProtocolTypeRouter), Daphne e Celery
│   ├── apps/                    # Módulos de domínio desacoplados:
│   │   ├── activities/          # Quizzes, flashcards, podcasts e exercícios
│   │   ├── authentication/      # JWT, Google OAuth e segurança de rotas
│   │   ├── chat/                # Consumers Django Channels, GPT-OSS-20B, Gemini e áudio
│   │   ├── dashboard/           # Métricas do aluno, estatísticas e rankings
│   │   ├── notifications/       # Push notifications, WebPush e e-mails
│   │   ├── payments/            # Integração com Mercado Pago (PIX, preferences e webhooks)
│   │   └── users/               # Perfis, XP, streaks, níveis CEFR e avatares
│   ├── assets/                  # Imagens e frames visuais da personagem Teacher Tati
│   ├── manage.py                # Utilitário administrativo do Django
│   └── requirements.txt         # Dependências Python (Django, Ninja, Channels, Daphne, etc.)
├── mobile/                      # Aplicativo mobile nativo em Flutter (Android & iOS)
│   ├── lib/                     # Código Dart com InAppWebView e gravação de áudio nativa
│   └── android/ & ios/          # Configurações de plataforma e Firebase Cloud Messaging
├── docs/                        # Documentação técnica e guias de arquitetura
├── docker-compose.yml           # Orquestração de containers (PostgreSQL, Redis, Backend, Frontend)
└── package.json                 # Configuração raiz do NPM Workspaces
```

---

## 🚀 Como Começar (Desenvolvimento Local)

### 1. Pré-requisitos
* **Node.js:** versão `18.x` ou superior
* **Python:** versão `3.12` ou superior
* **NPM:** versão `9.x` ou superior
* *(Opcional)* **Docker & Docker Compose** para banco de dados e Redis
* *(Opcional)* **Flutter SDK** para executar o aplicativo mobile

---

### 2. Instalação Geral do Monorepo

Na raiz do projeto, instale as dependências de todos os workspaces:
```bash
npm install
```

---

### 3. Configurando e Rodando o Backend (Django + Channels)

1. Entre na pasta do backend e crie o ambiente virtual:
   ```bash
   cd backend
   python -m venv .venv
   ```

2. Ative o ambiente virtual:
   * **Windows (PowerShell):**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS:**
     ```bash
     source .venv/bin/activate
     ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

4. Crie o arquivo `.env` com as configurações do banco e chaves de API.

5. Execute as migrações do banco de dados:
   ```bash
   python manage.py migrate
   ```

6. Inicie o servidor ASGI com **Daphne** (necessário para suporte a WebSockets via Django Channels):
   ```bash
   daphne -p 8080 app.asgi:application
   # Ou para desenvolvimento básico HTTP:
   python manage.py runserver 8080
   ```
   > 📌 *Swagger / Documentação OpenAPI interativa disponível em:* `http://localhost:8080/docs`

---

### 4. Rodando os Frontends (Web)

A partir da **raiz do projeto**, execute:

* **Iniciar o App Principal do Aluno (Next.js):**
  ```bash
  npm run dev:frontend
  ```
  *Acesso no navegador:* `http://localhost:3000`

* **Iniciar o Hub de Materiais Didáticos (Next.js):**
  ```bash
  npm run dev:hub
  ```
  *Acesso no navegador:* `http://localhost:3001`

---

### 5. Rodando Tarefas Assíncronas (Celery)

Em um terminal separado com o ambiente virtual ativado:
```bash
cd backend
celery -A app.celery:app worker -l info
```
Para agendamento automático de tarefas (Celery Beat):
```bash
celery -A app.celery:app beat -l info
```

---

### 6. Rodando o App Mobile (Flutter)

No emulador ou dispositivo conectado via USB:
```bash
cd mobile
flutter pub get
flutter run
```
Para gerar o arquivo APK de produção:
```bash
flutter build apk --release
```
*Arquivo compilado:* `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

### 7. Executando via Docker Compose

Para rodar todo o ambiente (PostgreSQL, Redis, Backend Django e Frontend Next.js):
```bash
docker-compose up --build -d
```

---

## 🔒 Variáveis de Ambiente

Crie os arquivos `.env` pertinentes tendo como base o `.env.example`. Principais parâmetros:

| Grupo | Variável | Descrição |
| :--- | :--- | :--- |
| **Segurança & Sessão** | `JWT_SECRET_KEY` | Chave criptográfica para geração de tokens JWT |
| | `COOKIE_SECRET` | Chave de segurança para cookies autenticados |
| **Banco de Dados** | `DATABASE_URL` | Conexão PostgreSQL (ex: Supabase Pooler) |
| | `SUPABASE_URL` / `SUPABASE_KEY` | Credenciais da API do Supabase |
| **Modelos de IA** | `GROQ_API_KEY` | Chave da Groq para execução do modelo **GPT-OSS-20B** |
| | `GEMINI_API_KEY` | Chave de API do **Google Gemini** (1.5 Flash, 2.0 Flash, Vision) |
| | `HF_TOKEN_LLAMA` / `HUGGING_FACE_KEY` | Token de fallback para modelos Hugging Face |
| **Pagamentos (Mercado Pago)**| `MP_ACCESS_TOKEN` | Token de acesso de produção ou testes do **Mercado Pago** |
| | `FORWARD_WEBHOOK_URL` | URL de repasse de notificações de webhook (opcional) |
| **Cache & WebSockets** | `REDIS_URL` / `UPSTASH_REDIS_URL` | Conexão Redis para o Channel Layer do Django Channels |
| **Síntese de Áudio** | `ELEVENLABS_API_KEY` | Chave ElevenLabs (opcional, fallback nativo Edge TTS) |
| **Armazenamento de Mídia** | `CLOUDINARY_URL` | URL de conexão Cloudinary para upload de arquivos |
| **Frontend** | `NEXT_PUBLIC_API_URL` | Endpoint da API Backend (ex: `http://localhost:8080`) |

---

## 🧪 Qualidade, Lint e Testes

```bash
# Executar testes do backend Django
python manage.py test

# Validação de tipagem TypeScript nos frontends
npm run typecheck --workspace frontend
npm run typecheck --workspace @tati/hub-site

# Linter do código Python
npm run lint

# Formatação de código Python
npm run format
```

---

## 🚢 Deploy & Produção

* **Backend (Django + Channels ASGI):** Configurado via [Dockerfile](./backend/Dockerfile) multi-stage baseado em Python e servidor ASGI (`app.asgi:application` com Gunicorn + Uvicorn Workers / Daphne), otimizado para **Railway** e **Hugging Face Spaces**.
* **Frontends (Next.js 14):** Prontos para deploy contínuo na **Vercel** com suporte a SSR e Edge caching.
* **App Mobile (Flutter):** Build de release para distribuição direta via APK Android ou publicação nas lojas Google Play e App Store.

---

## 📚 Documentação Adicional

* 🏛️ [Visão Geral de Arquitetura](./docs/architecture.md)
* ⚙️ [Documentação do Backend (Django-Ninja & DDD)](./docs/backend.md)
* 🎨 [Documentação do Frontend (Next.js)](./docs/frontend.md)
* 🗺️ [Mapeamento de Estrutura de Arquivos (PROJECT_STRUCTURE.md)](./PROJECT_STRUCTURE.md)
* 📱 [Guia do Aplicativo Mobile Flutter](./mobile/README.md)

---

<div align="center">
  <sub>Desenvolvido com carinho para transformar o aprendizado de inglês com Inteligência Artificial. ✨</sub>
  <br />
  <sub>© 2026 Teacher Tati AI Team. Todos os direitos reservados.</sub>
</div>