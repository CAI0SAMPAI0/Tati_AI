# Tati AI (Teacher Tati) 🤖📚

> **Tati AI** é uma plataforma avançada de ensino de inglês e hub de conteúdos premium que utiliza Inteligência Artificial para proporcionar prática de conversação em tempo real, gamificação, e uma experiência educacional moderna.

O projeto adota uma arquitetura em **Monorepo** para gerenciar múltiplos aplicativos e pacotes de forma escalável e eficiente, conectando um backend poderoso em Python a frontends modernos em Next.js e Vanilla JS.

---

## 🏗️ Arquitetura e Tecnologias

A stack tecnológica foi desenhada para altíssima performance, escalabilidade e facilidade de manutenção.

### Tecnologias Principais
- **Backend:** FastAPI (Python 3.12), Pydantic, Uvicorn
- **Frontend Principal (Hub Premium):** Next.js (React), TypeScript, Tailwind CSS
- **Frontend Legado:** Vanilla JS / HTML SPA
- **Banco de Dados:** PostgreSQL (via Supabase)
- **Cache & Mensageria:** Redis (via Upstash)
- **Modelos de IA:** Groq (Llama 3), Anthropic (Claude), Google GenAI (Gemini)
- **Áudio (STT/TTS):** Whisper (OpenAI) / Edge TTS
- **Autenticação:** JWT Customizado + Google Identity Services (OAuth)
- **Pagamentos:** Integração com Asaas API
- **Monitoramento e Logs:** Sentry

---

## 📂 Estrutura do Monorepo

O repositório é gerenciado via **NPM Workspaces**.

```text
/
├── apps/
│   └── hub-site/      # Frontend do Hub Premium (Next.js)
├── packages/
│   └── hub-core/      # Lógica de negócios compartilhada, SDK e Tipagens (TypeScript)
├── backend/           # Backend Monolítico Modular (FastAPI)
├── frontend/          # Frontend Web SPA Clássico
├── mobile_app/        # Aplicação Mobile
└── pwa/               # Scripts e assets para a versão PWA (Progressive Web App)
```

### Detalhamento do Backend (DDD)
O diretório `backend/` segue o padrão **Domain-Driven Design (DDD)** modular:
- `app/core/`: Configurações globais, segurança, banco de dados e dependências.
- `app/modules/`: Regras de negócio divididas por domínio (`activities`, `admin`, `auth`, `chat`, `payments`, `users`, etc).
- `app/shared/`: Ferramentas globais (integrações com Cloudinary, e-mails via Resend, geração de PDFs).

---

## 🚀 Como Começar (Desenvolvimento Local)

### 1. Pré-requisitos
- **Node.js** (v18+) e NPM
- **Python** (v3.12+)
- Docker (opcional, para rodar dependências locais via docker-compose)

### 2. Instalação Geral

Na raiz do projeto, instale as dependências do monorepo (Frontends e Pacotes):
```bash
npm install
```

Configure o ambiente virtual do Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt
cp .env.example .env       # Preencha com suas chaves de API (Supabase, Groq, etc)
```

### 3. Rodando o Projeto

O arquivo `package.json` na raiz expõe comandos práticos para gerenciar os diferentes serviços:

- **Iniciar o Backend FastAPI:**
  ```bash
  npm run dev
  # ou manualmente dentro de /backend: uvicorn app.main:app --reload
  ```

- **Iniciar o Frontend do Hub Premium (Next.js):**
  ```bash
  npm run dev:hub
  ```

- **Iniciar o Frontend Clássico:**
  ```bash
  npm run dev:frontend
  ```

---

## 🔒 Variáveis de Ambiente Necessárias

O sistema exige a configuração de credenciais críticas no arquivo `.env` do backend e do frontend:
- `SUPABASE_URL` e `SUPABASE_KEY`
- `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- Chaves de integração: `ASAAS_API_KEY`, `RESEND_API_KEY`, `CLOUDINARY_URL`
- OAuth: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (no frontend hub-site)

---

## 🚢 Deploy

A aplicação está preparada para deploys modernos:
- **Backend:** Configurado para rodar no Railway / Vercel (via Dockerfile). O Docker multi-stage build instala bibliotecas de sistema necessárias como `poppler-utils` (para processamento de PDFs).
- **Frontends:** Otimizados para deploy direto na Vercel utilizando Vercel Build Caching e CI/CD padrão do Next.js.

---

## 📄 Licença
Proprietário. Todos os direitos reservados à equipe Tati AI.