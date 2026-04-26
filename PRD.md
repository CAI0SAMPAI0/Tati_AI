# PRD — Teacher Tati: Plataforma de Aprendizado de Inglês com IA

> **Versão:** 1.0  
> **Data:** Abril 2026  
> **Status:** Blueprint de Desenvolvimento  
> **Tipo de Documento:** Product Requirement Document (PRD)

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Objetivos e Métricas de Sucesso](#2-objetivos-e-métricas-de-sucesso)
3. [Personas e Casos de Uso](#3-personas-e-casos-de-uso)
4. [Escopo do Produto](#4-escopo-do-produto)
5. [Arquitetura Técnica](#5-arquitetura-técnica)
6. [Estrutura de Módulos (Backend)](#6-estrutura-de-módulos-backend)
7. [Modelagem de Dados](#7-modelagem-de-dados)
8. [Especificação de Endpoints e Rotas](#8-especificação-de-endpoints-e-rotas)
9. [Integração com IA](#9-integração-com-ia)
10. [Sistema de Gamificação](#10-sistema-de-gamificação)
11. [Sistema de Pagamentos e Acesso](#11-sistema-de-pagamentos-e-acesso)
12. [Design System e Frontend](#12-design-system-e-frontend)
13. [Requisitos Não-Funcionais](#13-requisitos-não-funcionais)
14. [Roadmap de Desenvolvimento em Fases](#14-roadmap-de-desenvolvimento-em-fases)
15. [Estrutura de Diretórios do Projeto](#15-estrutura-de-diretórios-do-projeto)
16. [Variáveis de Ambiente](#16-variáveis-de-ambiente)
17. [Riscos e Mitigações](#17-riscos-e-mitigações)
18. [Glossário](#18-glossário)

---

## 1. Visão Geral do Produto

### 1.1 Problema

O aprendizado de inglês no Brasil sofre de dois problemas centrais: (1) a falta de oportunidades de prática conversacional acessível e personalizada fora de aulas particulares caras, e (2) a baixa retenção de alunos em plataformas digitais devido à ausência de engajamento contínuo e feedback imediato sobre o desempenho.

Plataformas existentes como Duolingo e Babbel priorizam vocabulário e gramática isolada, mas negligenciam o componente mais crítico da fluência: a **conversação em tempo real com feedback contextual**.

### 1.2 Solução

**Teacher Tati** é uma plataforma de aprendizado de inglês que coloca uma professora de IA — chamada Tati — à disposição do aluno 24 horas por dia, 7 dias por semana. A plataforma combina:

- **Conversação por texto e voz** com uma IA adaptada ao nível do aluno (CEFR A1–C2)
- **Gamificação completa** com XP, níveis, streaks, troféus e ranking
- **Conteúdo pedagógico estruturado** com módulos, quizzes e simulações de situações reais
- **Relatórios de progresso** gerados pela própria IA ao final de cada sessão
- **RAG (Retrieval-Augmented Generation)** com base de conhecimento própria da plataforma

### 1.3 Público-Alvo

| Segmento | Perfil | Necessidade Principal |
|----------|--------|----------------------|
| Estudantes de inglês | 18–45 anos, nível A1–B2, acesso por mobile/desktop | Praticar conversação no próprio ritmo |
| Profissionais | 25–50 anos, nível B1–C1, foco em inglês de negócios | Fluência para reuniões e apresentações |
| Assinantes premium | Qualquer perfil, dispostos a pagar R$49–R$99/mês | Acesso ilimitado a todos os recursos |

### 1.4 Proposta de Valor

> *"Pratique inglês toda hora com uma professora de IA que conhece seu nível, lembra do que você errou e nunca te julga."*

**Diferenciadores:**

- Avatar animado da professora com síntese de voz de alta qualidade (ElevenLabs + Edge TTS)
- Adaptação automática ao nível CEFR do aluno em cada resposta
- Feedback de pronúncia e gramática integrado ao fluxo natural de conversa
- Modo voz totalmente funcional (STT via Whisper + TTS)
- Relatórios PDF personalizados com exercícios gerados pela própria IA

---

## 2. Objetivos e Métricas de Sucesso

### 2.1 Objetivos de Negócio

| Objetivo | Prazo | Meta |
|----------|-------|------|
| Lançar MVP funcional com pagamento | M+3 | 1ª cobrança processada |
| Atingir 200 usuários ativos pagantes | M+6 | MRR de R$10.000 |
| Reter 60% dos assinantes no 2º mês | M+6 | Churn < 40% |
| Atingir NPS ≥ 50 | M+9 | — |

### 2.2 KPIs de Produto

| KPI | Definição | Meta |
|-----|-----------|------|
| **DAU/MAU** | Usuários ativos diários / mensais | ≥ 30% |
| **Mensagens/sessão** | Média de mensagens por sessão de chat | ≥ 10 |
| **Streak médio** | Dias consecutivos de prática | ≥ 3 dias |
| **Conversão free→paid** | % usuários que assinam após trial | ≥ 15% |
| **Tempo na plataforma** | Minutos médios por sessão | ≥ 8 minutos |
| **Taxa de conclusão de quiz** | Quizzes iniciados vs. finalizados | ≥ 70% |
| **Latência de resposta** | Tempo para primeiro token LLM | < 1,5s (P95) |

### 2.3 KPIs Técnicos

| KPI | Meta |
|-----|------|
| Uptime da API | ≥ 99,5% |
| Tempo de resposta do WebSocket (primeiro token) | < 1,5s |
| Taxa de sucesso de transcrição STT | ≥ 95% |
| Taxa de sucesso de pagamento Asaas | ≥ 98% |

---

## 3. Personas e Casos de Uso

### 3.1 Persona 1 — Ana (Aluna Iniciante)

**Perfil:** 28 anos, recepcionista, nível A2, nunca teve aula formal. Quer aprender inglês para viajar.

**User Stories:**

- Como Ana, quero me cadastrar com e-mail e senha para criar minha conta sem complicações.
- Como Ana, quero responder um onboarding rápido para que a Tati saiba meu nível e meus objetivos.
- Como Ana, quero iniciar uma conversa em texto com a Tati e receber respostas simples e diretas, adequadas ao meu nível.
- Como Ana, quero ouvir a Tati falar em inglês para treinar minha compreensão auditiva.
- Como Ana, quero ver meu progresso de XP e meu streak para me sentir motivada a voltar todos os dias.
- Como Ana, quero receber um relatório em PDF com os erros da sessão para estudar depois.

### 3.2 Persona 2 — Carlos (Profissional Intermediário)

**Perfil:** 35 anos, gerente de projetos, nível B1, precisa apresentar em inglês para clientes internacionais.

**User Stories:**

- Como Carlos, quero praticar simulações de reuniões de negócios para ganhar confiança.
- Como Carlos, quero usar o modo voz para praticar a fala sem digitar.
- Como Carlos, quero receber feedback de pronúncia e vocabulário.
- Como Carlos, quero acessar módulos temáticos de inglês corporativo.
- Como Carlos, quero ver minha posição no ranking para saber como estou em relação a outros alunos.
- Como Carlos, quero assinar um plano mensal de forma simples via PIX ou cartão.

### 3.3 Persona 3 — Admin da Plataforma

**Perfil:** Equipe técnica/pedagógica do Teacher Tati.

**User Stories:**

- Como admin, quero ver métricas de uso, número de usuários e receita no painel administrativo.
- Como admin, quero gerenciar usuários (visualizar, ativar, desativar contas).
- Como admin, quero gerenciar módulos e quizzes da plataforma.
- Como admin, quero visualizar e editar o conteúdo RAG (base de documentos da Tati).
- Como admin, quero ver logs de erros e alertas críticos.
- Como admin, quero conceder ou revogar acesso premium manualmente.

---

## 4. Escopo do Produto

### 4.1 Dentro do Escopo (MVP — v1.0)

- Cadastro e autenticação de usuários (e-mail/senha + Google OAuth)
- Onboarding de nível e objetivos
- Chat em tempo real via WebSocket com a Tati (texto e voz)
- Transcrição de áudio (STT) via Whisper Large V3 Turbo
- Síntese de voz (TTS) via Edge TTS com fallback gTTS
- Sistema RAG com ChromaDB + HuggingFace embeddings
- Sistema de XP, níveis CEFR (A1–C2), streaks e troféus
- Ranking mensal de alunos
- Módulos de conteúdo e quizzes
- Simulações de situações reais
- Geração de relatórios PDF de sessão
- Sistema de pagamento via Asaas (PIX, Boleto, Cartão)
- Grace period de 5 dias úteis após vencimento
- Painel administrativo completo
- Caderno de vocabulário pessoal
- Metas de estudo personalizadas
- Desafios de pronúncia
- Sistema de notificações in-app e e-mail
- Dashboard do aluno com progresso e histórico
- Perfil do aluno editável

### 4.2 Fora do Escopo (MVP)

- App mobile nativo (iOS/Android) — v2.0
- Integração com LMS externos (Moodle, Hotmart) — v2.0
- Videoaula com avatar 3D — v3.0
- Correção de redação assíncrona — v1.2
- Turmas e salas de aula virtuais — v2.0
- Integração com Google Classroom — v2.0
- Certificados de conclusão — v1.2
- Marketplace de cursos — v3.0

---

## 5. Arquitetura Técnica

### 5.1 Visão Geral da Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Backend** | FastAPI (Python 3.12) | Alta performance assíncrona, suporte nativo a WebSockets, tipagem com Pydantic |
| **Frontend** | Vanilla JS + HTML5 + CSS3 | Zero dependências de build, carregamento imediato, SPA-style via fetch/WebSocket |
| **Banco de Dados** | PostgreSQL via Supabase | Escalabilidade, JSONB para dados flexíveis, Row-Level Security nativa |
| **Cache/Rate Limit** | Upstash Redis | Redis serverless, sem custo de infraestrutura própria |
| **LLM Principal** | Groq (Llama 3.3 70B) | Ultra-baixa latência (< 500ms para primeiro token), custo viável |
| **LLM Alternativo** | Anthropic Claude 3.5 Sonnet | Qualidade superior para relatórios e análises complexas |
| **LLM Alternativo** | Google Gemini 2.0 Flash | Backup de baixo custo |
| **STT** | Whisper Large V3 Turbo (via Groq) | Alta precisão multi-idioma, integrado ao provider já usado |
| **TTS Principal** | Edge TTS (Microsoft) | Gratuito, alta qualidade, voz JennyNeural em inglês |
| **TTS Fallback** | gTTS (Google) | Fallback universal sem custo adicional |
| **RAG Vector Store** | ChromaDB | Persistência local/remota, integração nativa com LangChain |
| **Embeddings** | HuggingFace (sentence-transformers) | Sem custo por embedding, funciona offline |
| **Pagamentos** | Asaas API | Gateway brasileiro com suporte a PIX, Boleto e Cartão |
| **Monitoramento** | Sentry | Rastreamento de erros em produção |
| **E-mail** | Resend / SMTP Gmail | Transacional para confirmações e relatórios |

### 5.2 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                            │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │ index.html│ │ chat.html│  │dashboard │  │  admin panel     │  │
│   │(Landing) │  │(WebSocket)│  │ .html    │  │  (dashboard.html)│  │
│   └─────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘  │
└─────────┼─────────────┼─────────────┼────────────────┼─────────────┘
          │  HTTPS/WSS  │             │                │
          ▼             ▼             ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FastAPI Application                             │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                        Middleware Stack                       │  │
│   │   CORS │ RateLimiter (Upstash) │ Auth (JWT) │ Sentry        │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐  │
│   │  /auth      │  │  /ai        │  │ /users   │  │ /payments │  │
│   │  router     │  │  WebSocket  │  │ router   │  │ router    │  │
│   └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └─────┬─────┘  │
│          │                │               │               │         │
│   ┌──────▼────────────────▼───────────────▼───────────────▼──────┐  │
│   │                    Services Layer                             │  │
│   │  llm.py │ rag_search.py │ xp_system.py │ asaas.py           │  │
│   │  trophy_service.py │ streaks.py │ prompt_builder.py          │  │
│   └──────┬────────────────┬───────────────────────────────────────┘  │
└──────────┼────────────────┼────────────────────────────────────────┘
           │                │
    ┌──────▼──────┐  ┌──────▼──────────────────────────────┐
    │  Supabase   │  │         Serviços Externos            │
    │  PostgreSQL │  │  Groq │ Anthropic │ Gemini │ Asaas  │
    │  (RLS ON)   │  │  ElevenLabs │ Edge TTS │ Resend    │
    └─────────────┘  └──────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  ChromaDB   │
    │  (local)    │
    └─────────────┘
```

### 5.3 Fluxo de Ciclo de Vida de uma Mensagem (WebSocket)

```mermaid
sequenceDiagram
    participant U as Usuário (Frontend)
    participant WS as WebSocket Router
    participant ACL as Verificação de Acesso
    participant LLM as LLM Service
    participant RAG as RAG Search
    participant PB as Prompt Builder
    participant DB as Supabase
    participant XP as XP + Trophy System
    participant TTS as TTS Service

    U->>WS: Conecta via WSS (token JWT na query)
    WS->>WS: Valida token JWT
    U->>WS: Envia payload {type: "message", content: ..., conv_id: ...}

    alt Payload é áudio (base64)
        WS->>LLM: transcribe_audio(audio_bytes)
        LLM-->>WS: texto transcrito
    end

    WS->>ACL: Verifica acesso (is_premium_active, free_messages, grace_period)
    
    alt Acesso negado
        WS-->>U: {type: "error", code: 402, message: "Limite atingido"}
    else Acesso permitido
        WS->>DB: save_message(role=user, content=texto)
        WS->>RAG: obter_contexto_rag(texto)
        RAG-->>WS: contexto relevante (chunks)
        WS->>DB: load_history(conv_id, limit=20)
        DB-->>WS: histórico de mensagens
        WS->>PB: build_effective_prompt(profile, contexto_rag, custom_prompt)
        PB-->>WS: system_prompt montado
        WS->>LLM: stream_llm(system, history)
        
        loop Streaming de tokens
            LLM-->>U: {type: "token", content: "..."}
        end
        
        WS-->>U: {type: "done", full_text: "..."}
        WS->>DB: save_message(role=assistant, content=full_text)
        
        par Pós-processamento assíncrono
            WS->>TTS: text_to_speech(clean_text)
            TTS-->>U: {type: "audio", data: base64}
        and
            WS->>XP: award_xp(username, 10, "message_sent")
            XP->>DB: Atualiza xp_data no usuário
            XP->>XP: check_chat_trophies(username)
        end
    end
```

### 5.4 Fluxo de Autenticação

```mermaid
flowchart TD
    A[Usuário acessa a plataforma] --> B{Tem token JWT válido?}
    B -->|Não| C[Redireciona para index.html]
    C --> D{Tipo de login}
    D -->|E-mail/Senha| E[POST /auth/login]
    D -->|Google OAuth| F[GET /auth/google/login]
    E --> G{Credenciais válidas?}
    G -->|Não| H[Retorna 401 - Credenciais inválidas]
    G -->|Sim| I[Gera JWT + Refresh Token]
    F --> J[Callback Google OAuth]
    J --> I
    I --> K[Salva token no localStorage]
    K --> L{Role do usuário}
    L -->|student| M[Redireciona dashboard.html]
    L -->|staff/admin| N[Redireciona admin panel]
    B -->|Sim| L
    
    M --> O[Carrega perfil + XP + agentes]
    N --> P[Carrega métricas + gestão]
```

### 5.5 Fluxo do Sistema RAG

```mermaid
flowchart TD
    subgraph Ingestão de Documentos
        A1[Documentos PDF/MD no Google Drive] --> A2[GoogleDriveLoader]
        A2 --> A3[RecursiveCharacterTextSplitter]
        A3 --> A4["Chunks: 1000 chars, overlap: 200"]
        A4 --> A5[HuggingFaceEmbeddings]
        A5 --> A6[ChromaDB - persistência local]
    end

    subgraph Busca em Runtime
        B1[Mensagem do usuário] --> B2[HuggingFaceEmbeddings]
        B2 --> B3[ChromaDB similarity_search]
        B3 --> B4["Top-K chunks relevantes (k=3)"]
        B4 --> B5[Injeção no system prompt]
        B5 --> B6[LLM gera resposta contextualizada]
    end
```

### 5.6 Estratégia de Rotação de Chaves (Key Rotation)

O sistema implementa fallback automático entre múltiplas chaves de API para os providers Groq e ElevenLabs:

```
Tentativa com chave_1
    └── Sucesso → retorna resultado
    └── Erro 401 ou 429 → tenta chave_2
        └── Sucesso → retorna resultado
        └── Erro 401 ou 429 → tenta chave_3
            └── Sucesso → retorna resultado
            └── Todas falharam → retorna GroqKeyError
```

**Erros tratados:** `invalid_api_key` (401), `rate_limit_exceeded` (429), `quota_exceeded` (429).

---

## 6. Estrutura de Módulos (Backend)

### 6.1 Mapa de Diretórios do Backend

```
backend/
├── core/
│   ├── config.py          # Settings via Pydantic BaseSettings + .env
│   ├── security.py        # JWT encode/decode, hash de senha
│   ├── rate_limiter.py    # Middleware de rate limit com Upstash Redis
│   └── sentry_config.py   # Inicialização do Sentry
│
├── routers/
│   ├── deps.py            # Dependências compartilhadas (get_current_user, require_staff)
│   ├── auth.py            # Login, registro, refresh, Google OAuth
│   ├── validation.py      # Validação de CPF/CNPJ para pagamentos
│   ├── notifications.py   # Notificações in-app e push
│   ├── challenges.py      # Desafios de pronúncia
│   ├── simulation.py      # Simulações de situações reais
│   │
│   ├── ai/
│   │   ├── chat.py        # WebSocket de chat + endpoints REST de histórico
│   │   └── avatar.py      # Endpoints de animação do avatar
│   │
│   ├── activities/
│   │   ├── modules.py     # CRUD de módulos pedagógicos
│   │   ├── quizzes.py     # CRUD e execução de quizzes
│   │   ├── submissions.py # Submissões e correção de exercícios
│   │   ├── ranking.py     # Ranking mensal de alunos
│   │   └── trophies.py    # Listagem de troféus
│   │
│   ├── admin/
│   │   └── dashboard.py   # Métricas, gestão de usuários, conteúdo
│   │
│   ├── payments/
│   │   └── asaas.py       # Assinatura, webhook, QR Code PIX
│   │
│   └── users/
│       ├── profile.py     # Leitura e edição de perfil
│       ├── progress.py    # Progresso e relatórios de sessão
│       ├── xp.py          # XP endpoints REST
│       ├── streaks.py     # Streaks e histórico de estudos
│       ├── vocabulary.py  # Caderno de vocabulário
│       ├── goals.py       # Metas de estudo
│       ├── onboarding.py  # Fluxo de onboarding
│       ├── daily_summary.py # Resumo diário
│       └── permissions.py # Verificação de acesso e grace period
│
├── services/
│   ├── database.py        # Cliente Supabase singleton
│   ├── llm.py             # Stream LLM, STT, TTS, rotação de chaves
│   ├── rag.py             # Ingestão de documentos no ChromaDB
│   ├── rag_search.py      # Busca semântica em runtime
│   ├── prompt_builder.py  # Construção do system prompt adaptativo
│   ├── history.py         # CRUD de conversas e mensagens
│   ├── xp_system.py       # Cálculo de XP e níveis
│   ├── trophy_service.py  # Concessão e verificação de troféus
│   ├── streaks.py         # Cálculo e persistência de streaks
│   ├── asaas.py           # Integração HTTP com API Asaas
│   ├── email.py           # Envio de e-mails transacionais
│   ├── exercise_generator.py # Geração de exercícios via LLM
│   ├── simulation.py      # Lógica de simulações
│   ├── progress_report.py # Relatórios de progresso
│   ├── pdf_generator.py   # Geração de PDFs com fpdf2/ReportLab
│   ├── file_gen.py        # Geração de documentos DOCX
│   ├── ranking.py         # Lógica de ranking mensal
│   ├── notifications.py   # Lógica de notificações
│   ├── study_goals.py     # Gestão de metas
│   ├── weekly_plan.py     # Plano semanal de estudos
│   ├── upstash.py         # Cache Redis (Upstash)
│   ├── geolocation.py     # Detecção de localização
│   ├── document_validator.py # Validação de CPF/CNPJ
│   └── pronunciation_challenge.py # Avaliação de pronúncia
│
├── migrations/
│   ├── 001_consolidated.sql
│   ├── 002_quizzes_trophies.sql
│   └── ...
│
├── assets/
│   └── avatar/            # Imagens do avatar da Tati
│
├── data/
│   └── chroma_db/         # Persistência do ChromaDB
│
├── tests/
│   └── run_all_tests.py
│
├── main.py                # Ponto de entrada FastAPI
└── requirements.txt
```

### 6.2 Responsabilidades por Módulo

| Módulo | Responsabilidade |
|--------|-----------------|
| `core/config.py` | Centraliza todas as configurações via variáveis de ambiente com validação Pydantic |
| `core/security.py` | Hashing bcrypt de senhas, geração e validação de tokens JWT |
| `core/rate_limiter.py` | Middleware de rate limit por IP e por usuário usando Upstash Redis |
| `routers/auth.py` | Registro, login por e-mail/senha, login Google OAuth, refresh token |
| `routers/ai/chat.py` | WebSocket principal de chat, histórico de conversas, endpoints TTS |
| `routers/activities/` | Módulos pedagógicos, quizzes, submissões, ranking |
| `routers/admin/` | Painel administrativo: métricas, gestão de usuários, conteúdo RAG |
| `routers/payments/` | Criação de assinatura, webhook Asaas, QR Code PIX |
| `services/llm.py` | Abstração de LLM com rotação de chaves, STT Whisper, TTS multi-provider |
| `services/rag_search.py` | Busca semântica em runtime com ChromaDB |
| `services/prompt_builder.py` | Construção do system prompt adaptado ao nível CEFR e perfil do aluno |
| `services/xp_system.py` | Cálculo e atualização de XP, mapeamento XP → nível CEFR |
| `services/trophy_service.py` | Concessão de troféus com validação de unicidade |

---

## 7. Modelagem de Dados

### 7.1 Diagrama ER Simplificado

```mermaid
erDiagram
    users {
        text username PK
        text email UK
        text password_hash
        text name
        text role
        text level
        text focus
        boolean is_premium_active
        boolean is_exempt
        text plan_type
        text cpf_cnpj
        text phone
        int free_messages_used
        int preferred_due_day
        jsonb xp_data
        jsonb streak_data
        jsonb vocabulary
        jsonb study_goals
        jsonb pronunciation_challenges
        jsonb profile
        timestamp created_at
        timestamp updated_at
    }

    messages {
        uuid id PK
        text username FK
        uuid conversation_id FK
        text role
        text content
        text audio_b64
        timestamp created_at
    }

    conversations {
        uuid id PK
        text username FK
        text title
        timestamp created_at
        timestamp updated_at
    }

    subscriptions {
        uuid id PK
        text username FK
        text asaas_subscription_id
        text asaas_customer_id
        text status
        text plan_type
        date expires_at
        date grace_period_end
        timestamp created_at
        timestamp updated_at
    }

    trophies {
        uuid id PK
        text name UK
        text description
        text icon
        text category
        timestamp created_at
    }

    user_trophies {
        uuid id PK
        text username FK
        uuid trophy_id FK
        timestamp earned_at
    }

    modules {
        uuid id PK
        text title
        text description
        text level
        text category
        int order_index
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    lessons {
        uuid id PK
        uuid module_id FK
        text title
        text content_md
        int order_index
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    quizzes {
        uuid id PK
        uuid module_id FK
        text title
        text description
        text level
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    quiz_questions {
        uuid id PK
        uuid quiz_id FK
        text question_text
        jsonb options
        text correct_answer
        text explanation
        int order_index
    }

    quiz_attempts {
        uuid id PK
        text username FK
        uuid quiz_id FK
        int score
        int total_questions
        jsonb answers
        boolean completed
        timestamp created_at
    }

    simulations {
        uuid id PK
        text username FK
        text scenario
        text level
        jsonb messages
        text feedback
        boolean completed
        timestamp created_at
    }

    notifications {
        uuid id PK
        text username FK
        text type
        text title
        text body
        boolean is_read
        timestamp created_at
    }

    study_sessions {
        uuid id PK
        text username FK
        date session_date
        int messages_count
        int xp_earned
        int duration_minutes
        timestamp created_at
    }

    users ||--o{ messages : "envia"
    users ||--o{ conversations : "possui"
    conversations ||--o{ messages : "contém"
    users ||--o{ subscriptions : "possui"
    users ||--o{ user_trophies : "conquista"
    trophies ||--o{ user_trophies : "referenciada em"
    users ||--o{ quiz_attempts : "realiza"
    quizzes ||--o{ quiz_attempts : "tem"
    modules ||--o{ lessons : "contém"
    modules ||--o{ quizzes : "contém"
    quiz_questions }o--|| quizzes : "pertence a"
    users ||--o{ simulations : "participa"
    users ||--o{ notifications : "recebe"
    users ||--o{ study_sessions : "registra"
```

### 7.2 Detalhamento das Tabelas Principais

#### Tabela `users`

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| `username` | TEXT | PK | Identificador único do usuário |
| `email` | TEXT | UNIQUE, NOT NULL | E-mail de acesso |
| `password_hash` | TEXT | | Hash bcrypt da senha |
| `name` | TEXT | | Nome completo |
| `role` | TEXT | DEFAULT 'student' | 'student' \| 'staff' \| 'admin' |
| `level` | TEXT | DEFAULT 'A1' | Nível CEFR atual |
| `focus` | TEXT | | Foco de aprendizado (business, travel, etc.) |
| `is_premium_active` | BOOLEAN | DEFAULT false | Acesso premium ativo |
| `is_exempt` | BOOLEAN | DEFAULT false | Isento de pagamento (staff/teste) |
| `plan_type` | TEXT | | 'basic' \| 'full' \| null |
| `cpf_cnpj` | TEXT | | Documento para pagamento |
| `phone` | TEXT | | Telefone para pagamento |
| `free_messages_used` | INTEGER | DEFAULT 0 | Contador de mensagens grátis |
| `preferred_due_day` | INTEGER | DEFAULT 10 | Dia de vencimento preferido |
| `xp_data` | JSONB | DEFAULT '{}' | XP, nível, progresso, milestones |
| `streak_data` | JSONB | DEFAULT '{}' | Streak atual, maior streak, datas |
| `vocabulary` | JSONB | DEFAULT '[]' | Caderno de vocabulário pessoal |
| `study_goals` | JSONB | DEFAULT '{}' | Metas de estudo |
| `pronunciation_challenges` | JSONB | DEFAULT '[]' | Histórico de desafios |
| `profile` | JSONB | DEFAULT '{}' | Avatar, bio, configurações |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Data de criação |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Última atualização |

**Estrutura do `xp_data` JSONB:**
```json
{
  "xp": 1250,
  "level": "B1",
  "level_progress": 42,
  "xp_to_next": 1250,
  "total_xp_earned": 3800,
  "milestones": ["big_earner", "first_week"],
  "level_up": false,
  "level_up_at": null
}
```

**Estrutura do `streak_data` JSONB:**
```json
{
  "current_streak": 7,
  "longest_streak": 14,
  "last_study_date": "2026-04-24",
  "streak_frozen": false,
  "total_study_days": 45,
  "study_dates": ["2026-04-18", "2026-04-19", "..."]
}
```

#### Tabela `subscriptions`

| Campo | Tipo | Constraint | Descrição |
|-------|------|-----------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | ID da assinatura |
| `username` | TEXT | FK → users(username) | Usuário assinante |
| `asaas_subscription_id` | TEXT | UNIQUE | ID da assinatura no Asaas |
| `asaas_customer_id` | TEXT | | ID do cliente no Asaas |
| `status` | TEXT | | 'active' \| 'overdue' \| 'cancelled' \| 'grace' |
| `plan_type` | TEXT | | 'basic' \| 'full' |
| `billing_type` | TEXT | | 'PIX' \| 'BOLETO' \| 'CREDIT_CARD' |
| `expires_at` | DATE | | Data de expiração da assinatura |
| `grace_period_end` | DATE | | Fim do período de carência |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## 8. Especificação de Endpoints e Rotas

### 8.1 Autenticação (`/auth`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/register` | Cadastro com e-mail/senha | Não |
| POST | `/auth/login` | Login, retorna JWT | Não |
| GET | `/auth/google/login` | Inicia fluxo OAuth Google | Não |
| GET | `/auth/google/callback` | Callback OAuth, retorna JWT | Não |
| POST | `/auth/refresh` | Renova JWT via refresh token | Não |
| GET | `/auth/me` | Dados do usuário logado | Sim |
| POST | `/auth/logout` | Invalida refresh token | Sim |
| POST | `/auth/forgot-password` | Envia e-mail de reset | Não |
| POST | `/auth/reset-password` | Redefine senha via token | Não |

**POST /auth/register — Request Body:**
```json
{
  "email": "ana@email.com",
  "password": "MinhaS3nha!",
  "name": "Ana Silva"
}
```

**POST /auth/login — Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1296000,
  "user": {
    "username": "ana.silva",
    "email": "ana@email.com",
    "role": "student",
    "level": "A1"
  }
}
```

### 8.2 Chat e IA (`/ai`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| WebSocket | `/ai/chat/ws` | Chat em tempo real com Tati | Sim (JWT query param) |
| GET | `/ai/chat/conversations` | Lista conversas do usuário | Sim |
| POST | `/ai/chat/conversations` | Cria nova conversa | Sim |
| DELETE | `/ai/chat/conversations/{id}` | Deleta conversa | Sim |
| PATCH | `/ai/chat/conversations/{id}` | Renomeia conversa | Sim |
| GET | `/ai/chat/conversations/{id}/messages` | Mensagens de uma conversa | Sim |
| POST | `/ai/tts` | Converte texto em áudio | Sim |
| GET | `/ai/avatar/frame` | Retorna frame atual do avatar | Sim |

**WebSocket `/ai/chat/ws` — Mensagem de entrada:**
```json
{
  "type": "message",
  "content": "Hello Tati, let's practice!",
  "conv_id": "uuid-da-conversa",
  "audio": null,
  "filename": null,
  "use_rag": true
}
```

**WebSocket — Eventos de saída:**
```json
{"type": "token", "content": "Hello"}
{"type": "token", "content": "! How"}
{"type": "done", "full_text": "Hello! How are you today?"}
{"type": "audio", "data": "base64..."}
{"type": "xp", "amount": 10, "total": 1260}
{"type": "trophy", "name": "Primeira Mensagem", "icon": "🏆"}
{"type": "error", "code": 402, "message": "Limite de mensagens atingido"}
```

### 8.3 Usuários (`/users`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/users/profile` | Perfil completo do usuário | Sim |
| PATCH | `/users/profile` | Atualiza perfil | Sim |
| GET | `/users/progress` | Dados de progresso e XP | Sim |
| GET | `/users/xp" | XP detalhado | Sim |
| GET | `/users/streaks` | Dados de streak | Sim |
| POST | `/users/streaks/study` | Registra sessão de estudo | Sim |
| GET | `/users/vocabulary` | Caderno de vocabulário | Sim |
| POST | `/users/vocabulary` | Adiciona palavra | Sim |
| DELETE | `/users/vocabulary/{word}` | Remove palavra | Sim |
| GET | `/users/goals` | Metas de estudo | Sim |
| POST | `/users/goals` | Cria meta | Sim |
| PATCH | `/users/goals/{id}` | Atualiza meta | Sim |
| GET | `/users/onboarding` | Status do onboarding | Sim |
| POST | `/users/onboarding` | Salva dados do onboarding | Sim |
| GET | `/users/daily-summary` | Resumo diário | Sim |
| GET | `/users/permissions` | Status de acesso e limites | Sim |

### 8.4 Atividades (`/activities`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/activities/modules` | Lista módulos disponíveis | Sim |
| GET | `/activities/modules/{id}` | Detalhes de um módulo | Sim |
| GET | `/activities/modules/{id}/lessons` | Lições de um módulo | Sim |
| GET | `/activities/quizzes` | Lista quizzes | Sim |
| GET | `/activities/quizzes/{id}` | Detalhes do quiz | Sim |
| POST | `/activities/quizzes/{id}/start` | Inicia tentativa de quiz | Sim |
| POST | `/activities/quizzes/{id}/submit` | Submete resposta | Sim |
| GET | `/activities/ranking` | Ranking mensal | Sim |
| GET | `/activities/trophies` | Troféus do usuário | Sim |
| GET | `/activities/trophies/all` | Todos os troféus (com status) | Sim |
| POST | `/activities/submissions` | Submete exercício gerado por IA | Sim |

### 8.5 Pagamentos (`/payments`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/payments/subscribe` | Cria assinatura Asaas | Sim |
| GET | `/payments/subscription` | Status da assinatura | Sim |
| DELETE | `/payments/subscription` | Cancela assinatura | Sim |
| GET | `/payments/pix-qr` | QR Code PIX da cobrança | Sim |
| GET | `/payments/history` | Histórico de pagamentos | Sim |
| POST | `/payments/webhook/asaas` | Webhook Asaas (sem auth JWT) | Token Header |
| PATCH | `/payments/due-date` | Altera dia de vencimento | Sim |
| POST | `/validate/document` | Valida CPF/CNPJ | Sim |

### 8.6 Administração (`/admin`)

| Método | Rota | Descrição | Auth Staff |
|--------|------|-----------|-----------|
| GET | `/admin/dashboard` | Métricas gerais | Sim |
| GET | `/admin/users` | Lista usuários | Sim |
| GET | `/admin/users/{username}` | Detalhes de usuário | Sim |
| PATCH | `/admin/users/{username}` | Edita usuário (premium, role) | Sim |
| GET | `/admin/modules` | Lista módulos (admin view) | Sim |
| POST | `/admin/modules` | Cria módulo | Sim |
| PATCH | `/admin/modules/{id}` | Edita módulo | Sim |
| DELETE | `/admin/modules/{id}` | Remove módulo | Sim |
| GET | `/admin/rag/documents` | Lista documentos no ChromaDB | Sim |
| POST | `/admin/rag/sync` | Re-sincroniza ChromaDB com Drive | Sim |
| GET | `/admin/logs` | Logs recentes de erros | Sim |

### 8.7 Outros

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/simulation/start` | Inicia simulação de situação | Sim |
| POST | `/simulation/message` | Envia mensagem na simulação | Sim |
| GET | `/simulation/history` | Histórico de simulações | Sim |
| GET | `/challenges/pronunciation` | Lista desafios de pronúncia | Sim |
| POST | `/challenges/pronunciation/submit` | Submete tentativa de pronúncia | Sim |
| GET | `/notifications` | Lista notificações | Sim |
| PATCH | `/notifications/{id}/read` | Marca como lida | Sim |

---

## 9. Integração com IA

### 9.1 Arquitetura de LLM

O sistema implementa uma camada de abstração (`services/llm.py`) que permite trocar o provider de LLM sem alterar o código do router.

```python
# Hierarquia de providers configurada em .env
llm_provider: str = 'groq'  # 'groq' | 'anthropic' | 'gemini' | 'openai'
```

**Justificativa da escolha do Groq como primário:** A Groq oferece latência de inferência < 200ms para o Llama 3.3 70B, o que é crítico para a experiência de streaming de chat. O custo é 10–20× menor que o Claude/GPT-4 para o volume de tokens esperado.

**Justificativa do Claude como secundário:** Para geração de relatórios PDF, análise de progresso e contextos que exigem raciocínio complexo, o Claude 3.5 Sonnet oferece qualidade superior.

### 9.2 Estratégia de RAG

#### Ingestão (offline/periódica)

```
Fonte de documentos:
├── Google Drive (PDFs pedagógicos, materiais de curso)
└── Uploads manuais via admin panel

Pipeline:
1. GoogleDriveLoader → carrega documentos do Drive
2. RecursiveCharacterTextSplitter
   └── chunk_size: 1000 caracteres
   └── chunk_overlap: 200 caracteres (20% de overlap garante contexto entre chunks)
3. HuggingFaceEmbeddings (modelo: sentence-transformers/all-MiniLM-L6-v2)
   └── Justificativa: modelo leve (80MB), boa performance em inglês,
       sem custo por embedding, funciona offline
4. ChromaDB.add_documents() com persistência local em backend/data/chroma_db/
```

**Justificativa do ChromaDB:** Funciona com persistência local em arquivo (sem servidor separado), integração nativa com LangChain, suporte a metadados para filtrar por nível/tópico, e pode ser migrado para servidor remoto sem mudar o código.

#### Busca em Runtime

```python
# rag_search.py
async def obter_contexto_rag(query: str, k: int = 3) -> str:
    vectorstore = Chroma(
        persist_directory=CHROMA_PATH,
        embedding_function=HuggingFaceEmbeddings()
    )
    docs = vectorstore.similarity_search(query, k=k)
    return '\n\n'.join([doc.page_content for doc in docs])
```

**Parâmetros de busca:**
- `k=3`: retorna os 3 chunks mais relevantes
- Threshold de similaridade não aplicado (retorna sempre os k mais próximos)
- Contexto injetado no system prompt apenas se `use_rag=True` na mensagem

### 9.3 Construção do System Prompt (Prompt Builder)

O `prompt_builder.py` monta um prompt dinâmico em camadas:

```
system_prompt = [
    BASE_SYSTEM_PROMPT,          # Personalidade da Tati (config.py)
    LEVEL_ADAPTATION_RULES,      # Regras CEFR do nível do aluno
    PROFILE_INSTRUCTION,         # Foco e objetivos do aluno
    RAG_CONTEXT (se disponível), # Chunks relevantes do ChromaDB
    RAG_BEHAVIOR_RULES,          # Regras de uso do contexto RAG
    CUSTOM_PROMPT (se definido), # Instruções personalizadas do admin
]
```

### 9.4 Gerenciamento de Contexto e Histórico

- Histórico carregado via `services/history.py`: últimas **20 mensagens** da conversa ativa
- Cada conversa tem um UUID único e título auto-gerado pelo LLM após a 2ª mensagem
- Mensagens persistidas em `messages` com `conversation_id` para isolamento
- Áudio das mensagens salvo como base64 no campo `audio_b64` para replay

### 9.5 Estratégia de Cache de Tokens

**Cache via Upstash Redis (`services/upstash.py`):**

| Dado em Cache | TTL | Chave |
|---------------|-----|-------|
| Perfil do usuário | 5 min | `profile:{username}` |
| XP data | 2 min | `xp:{username}` |
| Streak data | 5 min | `streak:{username}` |
| Troféus do usuário | 10 min | `trophies:{username}` |
| Status de acesso | 1 min | `access:{username}` |
| Ranking mensal | 5 min | `ranking:monthly` |

**Invalidação:** Ao atualizar XP, streak ou troféus, o serviço correspondente deleta as chaves relevantes via `cache_delete()`.

### 9.6 TTS e STT

#### STT (Speech-to-Text)
- **Modelo:** Whisper Large V3 Turbo via Groq API
- **Entrada:** áudio em base64 (decodificado no backend)
- **Formatos suportados:** WAV, MP3, WebM, OGG
- **Fallback:** Nenhum — se Whisper falhar, retorna erro descritivo

#### TTS (Text-to-Speech)
- **Primário:** Microsoft Edge TTS — voz `en-US-JennyNeural`
  - Gratuito, qualidade neuronal, latência < 1s para textos curtos
- **Fallback:** gTTS (Google) — voz genérica, menor qualidade
- **Pré-processamento:** Remoção de emojis, asteriscos, seções de feedback e fontes do texto antes da síntese

### 9.7 Abstração Multi-Provider

Para adicionar um novo provider de LLM:

1. Adicionar chaves no `core/config.py` como atributos de `Settings`
2. Implementar a função `async def _stream_novo_provider(system, history, max_tokens) -> AsyncIterator[str]`
3. Adicionar o caso no switch de `stream_llm()`:
   ```python
   elif provider == 'novo_provider':
       async for token in _stream_novo_provider(system, history, max_tokens):
           yield token
   ```
4. Atualizar `llm_provider` no `.env`

---

## 10. Sistema de Gamificação

### 10.1 Estrutura de XP e Níveis CEFR

| Nível | XP Mínimo | XP Máximo | Label PT-BR |
|-------|-----------|-----------|-------------|
| A1 | 0 | 499 | Iniciante |
| A2 | 500 | 1.199 | Elementar |
| B1 | 1.200 | 2.499 | Intermediário |
| B2 | 2.500 | 3.999 | Intermediário Superior |
| C1 | 4.000 | 5.999 | Avançado |
| C2 | 6.000 | ∞ | Domínio Total |

### 10.2 Tabela de Recompensas XP

| Evento | XP | Observação |
|--------|-----|-----------|
| Mensagem enviada | +10 | Por mensagem do usuário |
| Resposta correta em quiz | +25 | Por questão correta |
| Nova palavra no vocabulário | +15 | Adição única por palavra |
| Simulação concluída | +50 | Ao marcar simulação como completa |
| Meta de estudo atingida | +30 | Ao concluir meta |
| Primeiro login do dia | +100 | Uma vez por dia |
| Streak de 7 dias | +50 | Bônus de streak |
| Streak de 30 dias | +150 | Bônus de streak |

### 10.3 Troféus Disponíveis

| Nome | Gatilho | Categoria |
|------|---------|-----------|
| Primeira Mensagem | 1 mensagem enviada | Chat |
| 100 Mensagens | 100 mensagens enviadas | Chat |
| 500 Mensagens | 500 mensagens enviadas | Chat |
| Primeiro Dia | Streak de 1 dia | Streak |
| Ofensiva de 3 Dias | Streak de 3 dias | Streak |
| Ofensiva de 7 Dias | Streak de 7 dias | Streak |
| Ofensiva de 14 Dias | Streak de 14 dias | Streak |
| Ofensiva de 30 Dias | Streak de 30 dias | Streak |
| Primeiro Quiz | Completar 1 quiz | Aprendizado |
| Mestre dos Quizzes | Completar 10 quizzes | Aprendizado |
| Vocabularista | 50 palavras no caderno | Vocabulário |
| Simulador | Completar 1 simulação | Prática |
| Nível A2 | Atingir 500 XP | Progresso |
| Nível B1 | Atingir 1200 XP | Progresso |
| Nível B2 | Atingir 2500 XP | Progresso |

### 10.4 Sistema de Streak

- **Streak incrementado** quando o usuário envia ao menos 1 mensagem em um dia
- **Streak congelado** (`streak_frozen: true`): um freeze consumido permite pular 1 dia sem quebrar o streak
- **Streak zerado** se nenhuma sessão for registrada por mais de 1 dia (sem freeze ativo)
- **Feriados nacionais** não quebram o streak (lista definida em `permissions.py`)

### 10.5 Ranking Mensal

- Baseado no XP total acumulado no mês corrente
- Atualizado em tempo real após cada sessão de estudo
- Top 50 exibidos publicamente
- Posição do usuário logado sempre exibida (mesmo fora do top 50)
- Cache de 5 minutos no Redis para reduzir queries

---

## 11. Sistema de Pagamentos e Acesso

### 11.1 Planos Disponíveis

| Plano | Preço | Benefícios |
|-------|-------|-----------|
| **Gratuito** | R$0 | 5 mensagens totais com a Tati |
| **Básico** | R$49/mês | Mensagens ilimitadas com a Tati, acesso a módulos e quizzes |
| **Completo** | R$99/mês | Tudo do Básico + simulações, PDF ilimitado, relatórios avançados |

### 11.2 Lógica de Controle de Acesso

```python
def check_access(user: dict) -> AccessResult:
    # 1. Usuários especiais (staff/admin) sempre têm acesso
    if user['username'] in SPECIAL_USERS or user['is_exempt']:
        return ALLOW
    
    # 2. Antes da data de início do modelo pago (PAID_START)
    if date.today() < PAID_START:
        return ALLOW
    
    # 3. Assinatura ativa
    if user['is_premium_active'] and subscription is not None:
        if subscription['expires_at'] >= date.today():
            return ALLOW
    
    # 4. Grace period (5 dias úteis após vencimento)
    if subscription and subscription['status'] == 'overdue':
        grace_end = calc_grace_period(subscription['expires_at'])
        if date.today() <= grace_end:
            return ALLOW_GRACE
    
    # 5. Mensagens gratuitas (pré-assinatura)
    if user['free_messages_used'] < FREE_MSG_LIMIT:
        return ALLOW_FREE
    
    # 6. Acesso negado
    return DENY_402
```

### 11.3 Grace Period

- Calculado como **5 dias úteis** após a data de vencimento
- Considera feriados nacionais fixos definidos em `FERIADOS_FIXOS`
- Implementado em `permissions.py` via `calc_due_date()` e `nth_business_day()`

### 11.4 Webhooks Asaas

| Evento | Ação no sistema |
|--------|----------------|
| `PAYMENT_CONFIRMED` | Ativa `is_premium_active`, define `expires_at`, status → 'active' |
| `PAYMENT_OVERDUE` | Status → 'overdue', inicia cálculo do grace period |
| `PAYMENT_DELETED` | Status → 'cancelled', desativa `is_premium_active` |
| `PAYMENT_RECEIVED` | Idêntico ao CONFIRMED (redundância de segurança) |
| `SUBSCRIPTION_DELETED` | Remove assinatura, desativa acesso premium |

**Segurança do Webhook:** Validação via header `asaas-access-token` comparado com `ASAAS_WEBHOOK_TOKEN` do `.env`.

### 11.5 Tipos de Cobrança Suportados

- **PIX:** QR Code dinâmico gerado via Asaas, expiração configurável
- **Boleto:** Gerado automaticamente com linha digitável
- **Cartão de Crédito:** Tokenização via Asaas (dados nunca passam pelo backend)

---

## 12. Design System e Frontend

### 12.1 Estrutura do Frontend

O frontend é uma **SPA-style em Vanilla JS** sem build step ou framework, servido via servidor HTTP estático.

```
frontend/
├── index.html          # Landing page (pública)
├── dashboard.html      # Dashboard do aluno
├── chat.html           # Interface de chat
├── activities.html     # Módulos e quizzes
├── quiz.html           # Tela de quiz
├── simulation.html     # Simulações
├── achievements.html   # Troféus e conquistas
├── competitions.html   # Ranking
├── progress.html       # Progresso e relatórios
├── profile.html        # Perfil do aluno
├── profile_activities.html # Atividades do perfil
├── goals.html          # Metas de estudo
├── payment.html        # Tela de assinatura
├── receipt.html        # Comprovante de pagamento
├── settings.html       # Configurações
│
├── css/
│   └── styles.css      # Design system global
│
└── js/
    ├── api.js           # Wrapper HTTP (fetch + JWT)
    ├── auth.js          # Login, registro, OAuth
    ├── chat.js          # WebSocket, streaming, áudio
    ├── chat_footer.js   # Controles do rodapé do chat
    ├── dashboard.js     # Dashboard principal
    ├── activities_ui.js # Renderização de módulos/quizzes
    ├── quiz.js          # Lógica de quiz
    ├── simulation.js    # Lógica de simulações
    ├── achievements.js  # Troféus
    ├── competitions.js  # Ranking
    ├── progress.js      # Gráficos de progresso
    ├── profile.js       # Perfil e edição
    ├── profile_activities.js
    ├── payment.js       # Assinatura e pagamento
    ├── goals.js         # Metas
    ├── settings.js      # Configurações
    ├── notifications.js # Sistema de notificações
    ├── onboarding.js    # Fluxo de onboarding
    ├── admin_modules.js # Admin: gestão de módulos
    ├── progress_bradge.js # Badges de progresso
    ├── script.js        # Utilitários globais
    └── i18n.js          # Internacionalização (pt-BR)
```

### 12.2 Tokens de Design (CSS Custom Properties)

```css
:root {
  /* Cores primárias */
  --color-primary: #6C63FF;         /* Roxo principal */
  --color-primary-dark: #4F46E5;    /* Roxo escuro (hover) */
  --color-primary-light: #EEF2FF;   /* Roxo claro (background) */
  
  /* Cores de status */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Neutros */
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-bg: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  
  /* Tipografia */
  --font-primary: 'Inter', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  
  /* Espaçamento */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  
  /* Bordas */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
  
  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.10);
}
```

### 12.3 Componentes Principais da Interface

#### Chat Interface
- **Área de mensagens:** Scroll infinito, bolhas distintas para usuário/Tati, suporte a Markdown
- **Avatar animado:** 9 frames de expressão (normal, ouvindo, surpresa, piscando, etc.)
- **Barra de entrada:** Campo de texto, botão de microfone (toggle STT), botão de envio
- **Rodapé de ações:** Botões de "Resumo", "Vocabulário", "Modo Voz"
- **Indicador de streaming:** Cursor piscando enquanto Tati responde
- **Player de áudio:** Inline nas mensagens da Tati

#### Dashboard do Aluno
- **Cards de progresso:** XP atual, nível CEFR, streak, total de mensagens
- **Barra de progresso de nível:** Visual da progressão A1→C2
- **Acesso rápido ao chat:** CTA proeminente
- **Últimas atividades:** Feed de ações recentes
- **Troféus recentes:** Grid de conquistas desbloqueadas

#### Onboarding Flow
1. Boas-vindas com apresentação da Tati
2. Seleção de nível atual (A1/A2/B1/B2/C1/C2)
3. Seleção de objetivo (viagem, negócios, estudo, entretenimento)
4. Seleção de foco (conversação, vocabulário, gramática, pronúncia)
5. Primeira mensagem sugerida para quebrar o gelo

---

## 13. Requisitos Não-Funcionais

### 13.1 Segurança

| Requisito | Implementação |
|-----------|---------------|
| Autenticação stateless | JWT com expiração de 15 dias (configurável) |
| Senhas | Hash bcrypt com work factor 12 |
| Webhook Asaas | Validação de token no header HTTP |
| HTTPS | TLS obrigatório em produção (Nginx/Caddy como reverse proxy) |
| CORS | Lista de origens permitidas configurada em `main.py` |
| Rate Limiting | 100 req/min por IP para endpoints REST; 60 msg/min por usuário no WebSocket |
| Injeção de prompt | Sanitização de conteúdo de usuário antes de inserir no system prompt |
| Dados sensíveis | CPF/CNPJ e dados de cartão nunca armazenados em log |
| Row-Level Security | Habilitado no Supabase para tabelas sensíveis |

### 13.2 Performance

| Requisito | Meta |
|-----------|------|
| Latência do primeiro token LLM | < 1,5s (P95) |
| Tempo de resposta REST endpoints | < 200ms (P95) |
| Tempo de conexão WebSocket | < 500ms |
| Latência TTS (Edge TTS) | < 1,5s para textos ≤ 100 chars |
| Throughput WebSocket | 100 conexões simultâneas por instância |
| Cache hit rate (Redis) | ≥ 60% para dados de perfil |

### 13.3 LGPD (Lei Geral de Proteção de Dados)

| Obrigação | Implementação |
|-----------|---------------|
| Consentimento | Checkbox obrigatório no cadastro com link para Política de Privacidade |
| Direito ao esquecimento | Endpoint `DELETE /users/me` remove dados pessoais |
| Portabilidade | Endpoint `GET /users/export` retorna JSON com todos os dados do usuário |
| Minimização | Coleta apenas dados necessários para o serviço |
| Notificação de breach | Processo definido no plano de incidentes |

### 13.4 Escalabilidade e Disponibilidade

- **Supabase:** Gerencia conexões de banco de dados com pooling automático (PgBouncer)
- **Upstash Redis:** Serverless, sem limite de conexões
- **ChromaDB:** Atualmente local; migrar para servidor remoto em produção com volume montado
- **FastAPI:** Stateless, escalável horizontalmente com múltiplas instâncias + load balancer
- **WebSocket:** Sticky sessions necessárias para multi-instância (nginx upstream com ip_hash)

---

## 14. Roadmap de Desenvolvimento em Fases

### Fase 1 — MVP Core (Semanas 1–4)

**Objetivo:** Plataforma funcional com chat, gamificação básica e pagamento.

#### Sprint 1 (Semana 1–2) — Fundação

- [X] **Setup do projeto**
  - [X] Criar repositório Git com estrutura de diretórios definida neste PRD
  - [X] Configurar ambiente virtual Python 3.12 e `requirements.txt`
  - [X] Criar arquivo `.env.example` com todas as variáveis listadas na seção 16
  - [X] Configurar Supabase: criar projeto, habilitar RLS nas tabelas principais
  - [X] Executar migration `001_consolidated.sql` no Supabase SQL Editor
  - [X] Configurar Sentry DSN no `.env` e testar integração

- [X] **Autenticação (routers/auth.py)**
  - [X] Implementar `POST /auth/register` com validação de e-mail único e hash bcrypt
  - [X] Implementar `POST /auth/login` retornando JWT com payload `{username, email, role}`
  - [X] Implementar `GET /auth/me` protegido por `get_current_user`
  - [X] Implementar `GET /auth/google/login` e `GET /auth/google/callback` (OAuth 2.0)
  - [X] Implementar `POST /auth/forgot-password` com envio de e-mail via Resend
  - [X] Implementar `POST /auth/reset-password` com validação de token de reset
  - [X] Testar fluxo completo: registro → login → token → /me

- [X] **Core Services**
  - [X] Implementar `services/database.py` com singleton do cliente Supabase
  - [X] Implementar `core/security.py`: `hash_password()`, `verify_password()`, `create_token()`, `decode_token()`
  - [X] Implementar `core/rate_limiter.py` com middleware Upstash Redis
  - [X] Implementar `routers/deps.py`: `get_current_user`, `require_staff`

#### Sprint 2 (Semana 2–3) — Chat e IA

- [X] **WebSocket de Chat (routers/ai/chat.py)**
  - [X] Implementar conexão WebSocket com autenticação via token JWT na query string
  - [X] Implementar recebimento de mensagem de texto e envio de tokens em streaming
  - [X] Implementar recebimento de áudio base64 e transcrição via Whisper (`transcribe_audio`)
  - [X] Implementar verificação de acesso (paywall) antes de processar cada mensagem
  - [X] Implementar contagem e decremento de `free_messages_used`
  - [X] Implementar envio de evento `{type: "error", code: 402}` quando limite atingido
  - [X] Implementar persistência de mensagens via `services/history.py`
  - [X] Implementar streaming de resposta da Tati token a token para o frontend
  - [X] Implementar pós-processamento: salvar resposta completa + disparar XP + TTS

- [X] **LLM Service (services/llm.py)**
  - [X] Implementar `stream_llm()` com suporte ao provider Groq (Llama 3.3 70B)
  - [X] Implementar rotação automática de chaves Groq (até 6 chaves configuráveis)
  - [X] Implementar detecção de erros 401/429 para triggerar rotação
  - [X] Implementar `transcribe_audio()` via Groq Whisper Large V3 Turbo
  - [X] Implementar `text_to_speech()` com Edge TTS primário e gTTS como fallback
  - [X] Implementar `_clean_tts_text()` para remover seções de feedback antes da síntese

- [X] **Prompt Builder (services/prompt_builder.py)**
  - [X] Implementar `build_effective_prompt()` compondo: base prompt + regras de nível + perfil
  - [X] Implementar `_LEVEL_RULES` para os 4 perfis: Beginner, Pre-Intermediate, Intermediate, Advanced
  - [X] Implementar injeção de contexto RAG no system prompt (quando disponível)

- [X] **Histórico de Conversas (services/history.py)**
  - [X] Implementar `create_conversation()`: cria registro na tabela `conversations`
  - [X] Implementar `list_conversations()`: lista conversas do usuário (mais recentes primeiro)
  - [X] Implementar `load_history()`: retorna últimas 20 mensagens de uma conversa
  - [X] Implementar `save_message()`: persiste mensagem com `role`, `content`, `audio_b64`
  - [X] Implementar `auto_title()`: chama LLM para gerar título após a 2ª mensagem
  - [X] Implementar `rename_conversation()` e `delete_conversation()`
  - [X] Expor endpoints REST em `routers/ai/chat.py` para CRUD de conversas

#### Sprint 3 (Semana 3–4) — Gamificação e Pagamento

- [X] **Sistema de XP (services/xp_system.py)**
  - [X] Implementar `award_xp(username, amount, reason)`: atualiza `xp_data` no Supabase
  - [X] Implementar `calculate_level(xp)`: mapeamento XP → nível CEFR
  - [X] Implementar cálculo de `level_progress` (%) dentro do nível atual
  - [X] Implementar detecção de `level_up` e campos `level_up_from/to/at`
  - [X] Implementar `get_leaderboard(limit=50)`: ranking por XP
  - [X] Expor `GET /users/xp` e `GET /activities/ranking` no respectivo router
  - [X] Invalidar cache Redis ao atualizar XP

- [X] **Sistema de Troféus (services/trophy_service.py)**
  - [X] Implementar `award_trophy(username, trophy_name)`: insere em `user_trophies` com constraint UNIQUE
  - [X] Implementar `check_chat_trophies()`: verifica troféus de 1/100/500 mensagens
  - [X] Implementar `check_streak_trophies()`: verifica troféus de 1/3/7/14/30 dias
  - [X] Implementar `check_level_trophies()`: verifica troféus de nível (A2, B1, B2)
  - [X] Popular tabela `trophies` com INSERT SQL de todos os troféus listados na seção 10.3
  - [X] Expor `GET /activities/trophies` e `GET /activities/trophies/all`

- [X] **Sistema de Streaks (services/streaks.py)**
  - [X] Implementar `register_study_session(username)`: atualiza `streak_data` no Supabase
  - [X] Implementar lógica de incremento, manutenção e zeragem do streak
  - [X] Implementar `is_business_day()` e `FERIADOS_FIXOS` para não quebrar streak em feriados
  - [X] Expor `GET /users/streaks` e `POST /users/streaks/study`

- [X] **Pagamentos (services/asaas.py + routers/payments/asaas.py)**
  - [X] Implementar `create_customer()`: cadastra cliente no Asaas via HTTP
  - [X] Implementar `create_subscription()`: cria assinatura recorrente PIX/BOLETO/CARTÃO
  - [X] Implementar `get_pix_qr_code()`: busca QR Code da cobrança pendente
  - [X] Implementar `cancel_subscription()`: cancela via API Asaas
  - [X] Implementar `POST /payments/webhook/asaas`: processar PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED
  - [X] Implementar `validate_document_auto()` para CPF/CNPJ em `services/document_validator.py`
  - [X] Testar webhook com Asaas sandbox

---

### Fase 2 — Conteúdo e Progresso (Semanas 5–7)

**Objetivo:** Adicionar módulos pedagógicos, RAG completo e relatórios.

#### Sprint 4 (Semana 5) — RAG e Onboarding

- [X] **RAG Pipeline (services/rag.py)**
  - [X] Implementar `autenticar_google()`: auth OAuth para Google Drive
  - [X] Implementar `sincronizar_drive()`: carrega PDFs via GoogleDriveLoader
  - [X] Implementar `salvar_no_banco()`: split em chunks + HuggingFace embeddings + ChromaDB
  - [X] Implementar `services/rag_search.py`: `obter_contexto_rag(query, k=3)` com ChromaDB
  - [X] Expor `POST /admin/rag/sync` para re-sincronização manual
  - [X] Expor `GET /admin/rag/documents` para listar documentos indexados

- [X] **Onboarding (routers/users/onboarding.py)**
  - [X] Implementar `GET /users/onboarding`: retorna status do onboarding
  - [X] Implementar `POST /users/onboarding`: salva nível, objetivo, foco
  - [X] Criar flow de onboarding no frontend (`onboarding.js`): 5 passos
  - [X] Integrar nível selecionado com `prompt_builder.py` para adaptar respostas da Tati

#### Sprint 5 (Semana 6) — Módulos e Quizzes

- [X] **Módulos Pedagógicos (routers/activities/modules.py)**
  - [X] Implementar CRUD completo de módulos: `GET /activities/modules`, `POST`, `PATCH`, `DELETE`
  - [X] Implementar `GET /activities/modules/{id}/lessons` para listar lições
  - [X] Popular banco com 10 módulos iniciais (Greetings, Daily Routine, Business English, etc.)
  - [X] Filtrar módulos por nível CEFR do aluno logado

- [X] **Quizzes (routers/activities/quizzes.py)**
  - [X] Implementar `GET /activities/quizzes` com filtro por módulo e nível
  - [X] Implementar `POST /activities/quizzes/{id}/start`: cria `quiz_attempt` com status 'in_progress'
  - [X] Implementar `POST /activities/quizzes/{id}/submit`: valida resposta, atualiza score, concede XP
  - [X] Implementar `services/exercise_generator.py`: gera novas questões via LLM para variação
  - [X] Popular banco com 5 quizzes por módulo

#### Sprint 6 (Semana 7) — Relatórios e Progresso

- [X] **Geração de Relatórios PDF (services/pdf_generator.py)**
  - [X] Implementar `generate_session_report(username, conv_id)`: chama LLM para análise da sessão
  - [X] Implementar geração de PDF com fpdf2: cabeçalho, resumo, erros, exercícios sugeridos
  - [X] Expor `POST /users/progress/report/{conv_id}` para gerar e baixar PDF
  - [X] Expor `GET /users/progress` com dados agregados de XP, sessões, vocabulário

- [X] **Dashboard do Aluno (frontend: dashboard.js)**
  - [X] Renderizar cards de XP, streak, nível e total de mensagens
  - [X] Implementar barra de progresso de nível com animação de fill
  - [X] Renderizar feed de troféus recentes (últimos 5)
  - [X] Renderizar ranking rápido (posição do usuário e top 3)
  - [X] CTA de "Iniciar Prática" que abre chat ou continua última conversa

---

### Fase 3 — Recursos Avançados (Semanas 8–10)

**Objetivo:** Simulações, notificações, painel admin completo.

#### Sprint 7 (Semana 8) — Simulações e Desafios

- [X] **Simulações (services/simulation.py + routers/simulation.py)**
  - [X] Implementar `POST /simulation/start` com seleção de cenário (entrevista, restaurante, viagem)
  - [X] Implementar `POST /simulation/message` com contexto de simulação no system prompt
  - [X] Implementar `GET /simulation/history` com lista de simulações realizadas
  - [X] Implementar feedback automático ao finalizar simulação (+50 XP)
  - [X] Criar 5 cenários iniciais de simulação

- [X] **Desafios de Pronúncia (services/pronunciation_challenge.py)**
  - [X] Implementar `GET /challenges/pronunciation`: lista desafios por nível
  - [X] Implementar `POST /challenges/pronunciation/submit`: avalia áudio com Whisper, compara com texto esperado
  - [X] Calcular score de similaridade e salvar em `pronunciation_challenges` JSONB
  - [X] Criar 20 frases desafio por nível CEFR

#### Sprint 8 (Semana 9) — Painel Admin e Notificações

- [X] **Painel Administrativo (routers/admin/dashboard.py)**
  - [X] Implementar `GET /admin/dashboard`: total de usuários, usuários ativos (7d), MRR estimado
  - [X] Implementar `GET /admin/users`: lista paginada com filtros por role e status premium
  - [X] Implementar `PATCH /admin/users/{username}`: editar `is_premium_active`, `role`, `is_exempt`
  - [X] Implementar gestão de módulos (CRUD completo via admin)
  - [X] Implementar `GET /admin/logs`: últimos 50 erros do Sentry via API

- [X] **Notificações (services/notifications.py)**
  - [X] Implementar criação de notificações in-app para: nível up, troféu conquistado, streak em risco
  - [X] Implementar `GET /notifications` e `PATCH /notifications/{id}/read`
  - [X] Implementar e-mail de lembrete diário para usuários sem sessão há > 2 dias
  - [X] Implementar e-mail de cobrança vencendo (3 dias antes do vencimento)
  - [X] Implementar notificações de ofensiva com scheduler (`19:00` lembrete / `09:00` streak quebrada) via `services/notification_scheduler.py`
  - [X] Implementar push subscription Web Push (`/notifications/config`, `/notifications/subscribe`, `/notifications/unsubscribe`) com VAPID
  - [X] Implementar envio automático de notificação a cada troféu conquistado em `award_trophy()`
  - [X] Implementar renderização de notificações na área de Atividades com tradução por idioma do app (`pt-BR`, `en-US`, `en-UK`)

#### Sprint 9 (Semana 10) — Polimento e Deploy

- [X] **Perfil e Configurações**
  - [X] Implementar `PATCH /users/profile`: atualizar nome, avatar_url, bio
  - [X] Implementar `GET/POST /users/goals`: metas de minutos/dia ou mensagens/semana
  - [X] Implementar `GET /users/vocabulary` e CRUD de palavras
  - [X] Criar tela de configurações com troca de nível manual, foco e modo voz on/off

- [ ] **Deploy e Infraestrutura**
  - [ ] Configurar servidor de produção (Ubuntu 22.04 mínimo)
  - [ ] Configurar Nginx como reverse proxy com SSL (Let's Encrypt / Certbot)
  - [ ] Configurar Gunicorn + Uvicorn workers para FastAPI
  - [ ] Configurar variáveis de ambiente em produção (não versionar `.env`)
  - [ ] Configurar backup periódico do ChromaDB
  - [ ] Testar webhook Asaas em produção com cobrança real
  - [ ] Executar checklist de segurança: CORS, rate limiting, headers HTTP

---

### Fase 4 — Otimização e v1.1 (Semanas 11–13)

- [X] Implementar `services/weekly_plan.py`: plano de estudos semanal gerado por IA
- [X] Implementar `GET /users/progress/daily-summary`: resumo automático do dia
- [X] Implementar Vocabulário Inteligente: detectar palavras novas na conversa e oferecer adição ao caderno
- [X] Implementar modo escuro no design system
- [X] Implementar explicações de quiz no idioma do app (`pt-BR`, `en-US`, `en-UK`) com fallback automático quando conteúdo antigo vier em idioma incorreto
- [X] Implementar status de exercícios personalizados gerados por IA (`pending`, `done`, `corrected`) com atualização automática no fluxo do aluno
- [X] Remover opção de criação manual de exercício personalizado pelo aluno na tela de atividades
- [X] Ajustar responsividade da experiência de quiz (`quiz.html`) para mobile, tablet e desktop
- [X] Implementar versão instalável via navegador (PWA: `manifest.json`, `sw.js`, prompt de instalação e cache offline básico)
- [ ] Otimizar queries do Supabase com índices adicionais nas tabelas de maior volume
- [ ] Implementar paginação em `list_conversations` e `ranking`
- [ ] Adicionar suporte a Google OAuth no mobile (deferred deep links)
- [X] Implementar `GET /users/export` para portabilidade de dados (LGPD)
- [X] Implementar `DELETE /users/me` para direito ao esquecimento (LGPD)
- [ ] Adicionar suporte a ElevenLabs TTS como opção premium

---

### Fase 5 — Evoluções de Quiz e PWA (Semanas 14–15)

**Objetivo:** consolidar personalização pedagógica, consistência multilíngue do quiz e distribuição web instalável.

#### Sprint 10 (Semana 14) — Internacionalização e Status Pedagógico

- [X] **Internacionalização de Explicações de Quiz**
  - [X] Normalizar `Accept-Language` para `pt-BR`, `en-US`, `en-UK`
  - [X] Regerar explicação automaticamente quando o idioma salvo não corresponder ao idioma ativo do app
  - [X] Cobrir comportamento com testes unitários de idioma

- [X] **Status do Ciclo de Exercício Personalizado**
  - [X] Definir ciclo de status: `pending` (gerado), `done` (aberto/iniciado), `corrected` (submetido e corrigido)
  - [X] Persistir status por usuário em `user_exercise_attempts` para quizzes personalizados
  - [X] Refletir status no payload de módulos/atividades para renderização no frontend

#### Sprint 11 (Semana 15) — UX de Atividades e PWA

- [X] **Refino de UX em Atividades e Quiz**
  - [X] Exibir badge de status no `quiz.html` com estilos visuais para cada estado
  - [X] Exibir status no card de prática personalizada (`pending`, `done`, `corrected`)
  - [X] Remover card/modal de criação manual de exercício personalizado para alunos
  - [X] Aplicar media queries adicionais para responsividade completa do quiz em telas pequenas e médias
  - [X] Corrigir layout da abertura de atividade em `quiz.html` para renderização consistente sem dependência de framework externo

- [X] **PWA Instalável**
  - [X] Publicar `frontend/manifest.json` com ícones e metadados de instalação
  - [X] Publicar `frontend/sw.js` com cache estático/runtime e fallback offline de navegação
  - [X] Registrar Service Worker em runtime (`frontend/js/pwa.js`)
  - [X] Implementar prompt de instalação via `beforeinstallprompt` com CTA de instalação
  - [X] Consolidar artefatos de suporte e documentação em `pwa/` (`build-pwa.sh`, geradores de ícones, testes e guias)

**Critérios de aceite da Fase 5:**
- Explicação do quiz acompanha o idioma ativo da interface sem regressão para conteúdo legado.
- Exercícios personalizados mostram progressão de status de ponta a ponta.
- Tela de quiz mantém usabilidade em mobile (botão principal full-width, header adaptado, espaçamento de footer fixo).
- App pode ser instalado no navegador compatível (Chrome/Edge/Samsung Internet) quando servido em HTTPS ou localhost.
- Arquivos de suporte ao PWA ficam centralizados em `pwa/`, sem espalhar scripts e documentos na raiz.

---

### Fase 6 — Melhorias de UX e IA (Sprint Extra - Abril 2026)

**Objetivo:** Aprimorar a fluidez da conversa e introduzir recursos de prática ativa com podcasts e teleprompter.

#### Sprint 12 (Extra) — Teleprompter, Podcast e Correções Críticas

- [X] **Teleprompter com Reconhecimento de Voz**
  - [X] Implementar overlay de Teleprompter no chat com timer.
  - [X] Integrar Web Speech API para exibir texto em tempo real durante a gravação.
- [X] **Correção de Fluxo STT (Mensagem do Usuário)**
  - [X] Garantir que a transcrição apareça imediatamente após o envio do áudio.
  - [X] Implementar placeholder "🎤 Transcrevendo..." para feedback instantâneo.
- [X] **Persistência de Componentes de Relatório (PDF)**
  - [X] Corrigir bug que sumia o botão de baixar PDF ao recarregar a conversa.
  - [X] Garantir que o card de material de estudo seja renderizado corretamente no histórico.
- [X] **Sugestões de Podcasts Personalizadas**
  - [X] Atualizar `prompt_builder.py` para incluir lógica de sugestão de podcasts baseada no nível CEFR.
  - [X] Instruir a IA a propor exercícios de pronúncia e escuta ativa.
- [X] **Ajuste de Trigger de Resumo**
  - [X] Corrigir lógica do botão de resumo para aparecer após 3 mensagens do usuário (conforme PRD original).

---

## 15. Estrutura de Diretórios do Projeto

```
teacher-tati/
│
├── backend/
│   ├── .env                        # ← Não versionar! Usar .env.example
│   ├── .env.example
│   ├── main.py                     # Ponto de entrada FastAPI
│   ├── requirements.txt
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── rate_limiter.py
│   │   └── sentry_config.py
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── deps.py
│   │   ├── auth.py
│   │   ├── validation.py
│   │   ├── notifications.py
│   │   ├── challenges.py
│   │   ├── simulation.py
│   │   ├── ai/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py
│   │   │   └── avatar.py
│   │   ├── activities/
│   │   │   ├── __init__.py
│   │   │   ├── modules.py
│   │   │   ├── quizzes.py
│   │   │   ├── submissions.py
│   │   │   ├── ranking.py
│   │   │   └── trophies.py
│   │   ├── admin/
│   │   │   ├── __init__.py
│   │   │   └── dashboard.py
│   │   ├── payments/
│   │   │   ├── __init__.py
│   │   │   └── asaas.py
│   │   └── users/
│   │       ├── __init__.py
│   │       ├── profile.py
│   │       ├── progress.py
│   │       ├── xp.py
│   │       ├── streaks.py
│   │       ├── vocabulary.py
│   │       ├── goals.py
│   │       ├── onboarding.py
│   │       ├── daily_summary.py
│   │       └── permissions.py
│   │
│   ├── services/
│   │   ├── database.py
│   │   ├── llm.py
│   │   ├── rag.py
│   │   ├── rag_search.py
│   │   ├── prompt_builder.py
│   │   ├── history.py
│   │   ├── xp_system.py
│   │   ├── trophy_service.py
│   │   ├── streaks.py
│   │   ├── asaas.py
│   │   ├── email.py
│   │   ├── exercise_generator.py
│   │   ├── simulation.py
│   │   ├── progress_report.py
│   │   ├── pdf_generator.py
│   │   ├── file_gen.py
│   │   ├── ranking.py
│   │   ├── notifications.py
│   │   ├── study_goals.py
│   │   ├── weekly_plan.py
│   │   ├── upstash.py
│   │   ├── geolocation.py
│   │   ├── document_validator.py
│   │   └── pronunciation_challenge.py
│   │
│   ├── migrations/
│   │   ├── 001_consolidated.sql
│   │   ├── 002_quizzes_trophies.sql
│   │   ├── 003_ranking_trophies_study.sql
│   │   ├── 004_fix_schema.sql
│   │   ├── 005_simulations_table.sql
│   │   ├── 006_exercises_status_isolation.sql
│   │   ├── 007_notifications_onboarding.sql
│   │   └── 008_fix_schema_attempts.sql
│   │
│   ├── assets/
│   │   └── avatar/
│   │       ├── avatar_tati_normal.png
│   │       ├── avatar_tati_ouvindo.png
│   │       ├── avatar_tati_aberta.png
│   │       ├── avatar_tati_bem_aberta.png
│   │       ├── avatar_tati_meio.png
│   │       ├── tati_piscando.png
│   │       ├── tati_surpresa.png
│   │       ├── frame_A.png
│   │       ├── frame_B.png
│   │       ├── frame_C.png
│   │       ├── frame_D.png
│   │       ├── frame_E.png
│   │       ├── frame_F.png
│   │       └── sem_foto.png
│   │
│   └── data/
│       └── chroma_db/              # Persistência ChromaDB (não versionar)
│
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── chat.html
│   ├── activities.html
│   ├── quiz.html
│   ├── simulation.html
│   ├── achievements.html
│   ├── competitions.html
│   ├── progress.html
│   ├── profile.html
│   ├── profile_activities.html
│   ├── goals.html
│   ├── payment.html
│   ├── receipt.html
│   ├── settings.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── chat_footer.js
│   │   ├── dashboard.js
│   │   ├── activities_ui.js
│   │   ├── quiz.js
│   │   ├── simulation.js
│   │   ├── achievements.js
│   │   ├── competitions.js
│   │   ├── progress.js
│   │   ├── profile.js
│   │   ├── profile_activities.js
│   │   ├── payment.js
│   │   ├── goals.js
│   │   ├── settings.js
│   │   ├── notifications.js
│   │   ├── onboarding.js
│   │   ├── admin_modules.js
│   │   ├── progress_bradge.js
│   │   ├── script.js
│   │   └── i18n.js
│   └── img/
│       └── (imagens estáticas)
│
â”œâ”€â”€ pwa/
â”‚   â”œâ”€â”€ build-pwa.sh
â”‚   â”œâ”€â”€ create-pwa-icons.js
â”‚   â”œâ”€â”€ create-pwa-icons-png.py
â”‚   â”œâ”€â”€ generate-icons.js
â”‚   â”œâ”€â”€ test-pwa.py
â”‚   â”œâ”€â”€ PWA_SETUP.md
â”‚   â””â”€â”€ PWA_IMPLEMENTATION.md
â”‚
├── .gitignore
└── README.md
```

---

## 16. Variáveis de Ambiente

```bash
# =============================================================================
# .env.example — Teacher Tati
# Copiar para .env e preencher com valores reais
# NUNCA versionar o arquivo .env
# =============================================================================

# --- Servidor ---
PORT=8000
DEBUG=false

# --- Autenticação JWT ---
JWT_SECRET_KEY=seu-segredo-super-secreto-de-pelo-menos-32-caracteres
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=21600

# --- Google OAuth (para login social) ---
GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-google-client-secret
GOOGLE_REDIRECT_URI=https://seudominio.com/auth/google/callback

# --- Supabase ---
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# --- LLM Provider ---
# 'groq' | 'anthropic' | 'gemini' | 'openai'
LLM_PROVIDER=groq

# --- Groq (LLM Principal + STT) ---
# Suporta até 6 chaves para rotação automática
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY_1=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY_2=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY_3=
GROQ_API_KEY_4=
GROQ_API_KEY_5=

# --- Anthropic Claude (LLM Secundário) ---
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# --- Google Gemini (LLM Terciário) ---
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-2.0-flash

# --- OpenAI (opcional, TTS alternativo) ---
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# --- ElevenLabs TTS (opcional, premium) ---
ELEVENLABS_API_KEY=
ELEVENLABS_API_KEY_1=
ELEVENLABS_API_KEY_2=
ELEVENLABS_API_KEY_3=
VOICE_ID=9BWTSay5S4Btt9P88fC2

# --- Google Drive (RAG) ---
GOOGLE_CLIENT_ID_DRIVE=seu-client-id-drive.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET_DRIVE=seu-client-secret-drive
GOOGLE_PROJECT_ID=seu-projeto-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_DRIVE_FOLDER_ID=1xxxxxxxxxxxxxxxxxxxxxxxxxxx

# --- Upstash Redis (Cache + Rate Limit) ---
UPSTASH_REDIS_REST_URL=https://xxxxxxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# --- E-mail ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app-gmail
SMTP_FROM=Teacher Tati <no-reply@seudominio.com>
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# --- Asaas Pagamentos ---
API_ASAAS=sua-chave-api-asaas
# 'sandbox' para testes, 'production' para produção
ASAAS_ENVIRONMENT=sandbox
ASAAS_WEBHOOK_TOKEN=seu-token-secreto-do-webhook

# --- Monitoramento ---
SENTRY_DSN=https://xxxxxxxxxxxx@o.sentry.io/xxxxxxxx
```

---

## 17. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Rate limit do Groq em horários de pico | Alta | Alto | Rotação de 6 chaves configurada; fallback para Claude/Gemini |
| R2 | ChromaDB corrompido em produção | Média | Alto | Backup diário do diretório `data/chroma_db/`; script de re-sync do Drive |
| R3 | Webhook Asaas não recebido (falha de rede) | Média | Alto | Polling periódico de assinaturas vencidas como verificação secundária |
| R4 | Custos de LLM acima do esperado | Média | Médio | Limitar `max_tokens` por mensagem; usar Groq (mais barato) como primário |
| R5 | Latência alta no TTS Edge TTS | Baixa | Médio | Fallback imediato para gTTS; processar TTS em background, não bloqueando o chat |
| R6 | Perda de contexto em conversas longas | Média | Médio | Janela de contexto limitada a 20 mensagens; implementar summarização em v1.1 |
| R7 | Supabase fora do ar | Baixa | Crítico | Plan Pro do Supabase com SLA 99.9%; monitorar via Sentry |
| R8 | Injeção de prompt malicioso pelo usuário | Média | Alto | Sanitizar input; não incluir conteúdo de usuário diretamente no system prompt |
| R9 | LGPD — dados sensíveis expostos | Baixa | Alto | RLS no Supabase; nunca logar CPF/cartão; endpoint de export/exclusão |
| R10 | Crescimento acima da capacidade do SQLite (N/A) | — | — | Projeto usa Supabase (PostgreSQL); não há limitação de SQLite |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **CEFR** | Common European Framework of Reference for Languages. Sistema de 6 níveis (A1–C2) que padroniza a avaliação de proficiência em idiomas. |
| **RAG** | Retrieval-Augmented Generation. Técnica que combina busca semântica em documentos com geração de texto por LLM, permitindo que a IA use conhecimento externo sem ser re-treinada. |
| **STT** | Speech-to-Text. Conversão de áudio em texto. Na plataforma, realizado pelo Whisper Large V3 Turbo via Groq. |
| **TTS** | Text-to-Speech. Conversão de texto em áudio. Na plataforma, realizado pelo Edge TTS (Microsoft) com fallback gTTS. |
| **Streak** | Sequência de dias consecutivos de prática. Quebrado quando o usuário não realiza nenhuma sessão em um dia corrido. |
| **XP** | Experience Points. Pontos de experiência acumulados por ações na plataforma (mensagens, quizzes, etc.), usados para determinar o nível CEFR do aluno. |
| **LLM** | Large Language Model. Modelo de linguagem de grande escala (ex: Llama 3.3, Claude 3.5). |
| **Groq** | Provedor de inferência de LLM com hardware especializado (LPU), oferecendo latências muito baixas. |
| **ChromaDB** | Vector database local/gerenciado para armazenar embeddings de documentos usados no RAG. |
| **HuggingFace Embeddings** | Modelos de embeddings de texto open-source da HuggingFace, usados para transformar texto em vetores para busca semântica. |
| **Grace Period** | Período de carência de 5 dias úteis após o vencimento da assinatura, durante o qual o usuário mantém acesso à plataforma. |
| **Paywall** | Barreira de acesso que exige assinatura paga para continuar usando o serviço após o limite gratuito. |
| **Asaas** | Gateway de pagamento brasileiro com suporte a PIX, Boleto e Cartão de Crédito. |
| **Webhook** | Notificação HTTP enviada de forma assíncrona por um serviço externo (Asaas) para informar eventos de pagamento. |
| **WebSocket** | Protocolo de comunicação bidirecional persistente usado para o streaming de tokens do LLM em tempo real. |
| **JWT** | JSON Web Token. Token de autenticação stateless com payload assinado, usado para autenticar chamadas à API. |
| **Upstash Redis** | Serviço Redis serverless usado para cache de dados frequentes e rate limiting. |
| **Sentry** | Plataforma de monitoramento de erros em produção com rastreamento de stack traces. |
| **Row-Level Security (RLS)** | Funcionalidade do PostgreSQL/Supabase que restringe acesso a linhas de tabela com base em políticas, garantindo isolamento de dados entre usuários. |
| **Simulação** | Módulo da plataforma onde o aluno pratica inglês em cenários reais pré-definidos (entrevista de emprego, pedido no restaurante, etc.), com feedback ao final. |
| **Onboarding** | Fluxo inicial de configuração da conta do aluno, coletando nível, objetivo e foco para personalizar a experiência. |
| **Key Rotation** | Estratégia de alternar automaticamente entre múltiplas chaves de API quando uma delas atinge limite de taxa ou retorna erro de autenticação. |
| **Edge TTS** | Serviço de síntese de voz da Microsoft, acessível gratuitamente via biblioteca `edge-tts`, com vozes neurais de alta qualidade. |
| **Chunk** | Fragmento de texto gerado ao dividir documentos maiores para indexação no ChromaDB. Tamanho padrão: 1000 caracteres com overlap de 200. |
| **PAID_START** | Data a partir da qual o modelo de cobrança entra em vigor. Antes desta data, todos os usuários têm acesso irrestrito. |
| **SPECIAL_USERS** | Conjunto de usernames que possuem acesso garantido independentemente do status de assinatura (staff, desenvolvedores, testers). |

---

> **Fim do PRD — Teacher Tati v1.0**  
> Este documento é a fonte de verdade para o desenvolvimento da plataforma.  
> Qualquer alteração de escopo deve ser refletida neste documento antes da implementação.


## 19. Atualizacao de Entrega - Sprints de Podcast (Abril 2026)

### Sprint 13 (Entrega Executada) - Podcast Multi-Fonte, Traducoes e UX Moderna

**Objetivo:** Expandir a pratica de podcast para fontes alem do YouTube, com apoio de traducao e experiencia responsiva para desktop/mobile.

- [X] **Catalogo de Podcast Multi-Fonte (Backend)**
  - [X] Expandir `backend/routers/activities/podcasts.py` com fontes `YouTube`, `Vimeo`, `Spotify`, `TED` e `Dailymotion`.
  - [X] Adicionar metadados por item: `source_name`, `source_type`, `media_type`, `external_url`, `transcript_segments` e `translation_language`.
  - [X] Implementar validacao de seguranca para embeds com allowlist de hosts (`https` + dominio confiavel).
  - [X] Preservar recomendacao por nivel CEFR e relevancia de interesse do usuario.

- [X] **Exercicios com Contexto Bilingue**
  - [X] Incluir trechos de transcricao EN/PT no prompt de geracao dos exercicios.
  - [X] Normalizar payload de exercicios para sempre retornar `{"exercises": [...]}`.
  - [X] Corrigir fallback para formato consistente (mix de `writing`, `choice` e `voice`).
  - [X] Padronizar parse de JSON (remocao de markdown/code fences + extracao segura do objeto).

- [X] **Tela de Podcast Responsiva e com Animacoes**
  - [X] Refatorar `frontend/podcast_view.html` para layout em grid com painel de media + painel de transcricao.
  - [X] Criar `frontend/styles/podcast_view.css` com visual moderno (gradientes, chips, cards, estados hover, animacoes de entrada).
  - [X] Implementar reveal animation por bloco com `IntersectionObserver`.
  - [X] Ajustar experiencia mobile (breakpoints para cards, player, botoes e fluxo de exercicios).

- [X] **Traducoes e Internacionalizacao do Fluxo de Podcast**
  - [X] Adicionar chaves PT-BR e EN-US em `frontend/js/i18n.js` para carregamento, transcricao, feedback, voz e avaliacao.
  - [X] Aplicar as traducoes na tela (`data-i18n` + chamadas `t(...)` no JS).
  - [X] Exibir badge de traducao disponivel nos cards de podcast.

- [X] **Melhorias de UX na Area de Podcasts (Lista de Atividades)**
  - [X] Atualizar cards em `frontend/js/activities_ui.js` para mostrar origem da midia e status de traducao.
  - [X] Adicionar animacao escalonada de entrada dos cards.
  - [X] Refinar estilos em `frontend/styles/activities.css` para tornar os cards de podcast mais informativos e modernos.

- [X] **Personalizacao Automatica por IA (Sem acao manual do aluno)**
  - [X] Analisar mensagens recentes do usuario para extrair interesses automaticamente.
  - [X] Ranquear podcasts com base em nivel CEFR + temas recorrentes da conversa.
  - [X] Persistir recomendacoes no `users.profile` com cache temporal e renovacao automatica.
  - [X] Exibir no frontend o motivo da recomendacao ("porque este episodio foi sugerido para voce").

**Criterios de aceite do Sprint 13:**
- [X] O usuario consegue consumir podcasts de mais de uma plataforma na area de atividades.
- [X] A tela de podcast oferece alternancia entre transcricao original e traducao.
- [X] O fluxo permanece funcional em telas pequenas (mobile) e grandes (desktop).
- [X] A geracao/avaliacao de exercicios segue contrato consistente para o frontend.

### Sprint 14 (Proposto) - Evolucao de Aprendizagem Assistida por Midia

**Objetivo:** Transformar a area de podcast em trilha inteligente de escuta, pronuncia e revisao personalizada.

- [ ] **Legendas sincronizadas por timestamp real**
  - [ ] Sincronizar highlight da linha da transcricao com playback do player.
  - [ ] Permitir "pular para trecho" ao clicar no timestamp.

- [ ] **Curadoria opcional para professor (modo complementar)**
  - [ ] Permitir que professor fixe/reordene sugestoes automaticas por turma.
  - [ ] Manter IA como origem primaria de recomendacao para alunos, sem acao manual obrigatoria.

- [ ] **Traducao assistida por IA por nivel**
  - [ ] Criar modo de traducao simplificada (A1/A2), natural (B1/B2) e avancada (C1/C2).
  - [ ] Exibir glossario contextual de termos-chave com exemplos.

- [ ] **Trilhas por sprint pedagogico**
  - [ ] Organizar playlists semanais com meta de minutos por nivel.
  - [ ] Medir progresso por conclusao de episodio + score medio de exercicios.

- [ ] **Analytics de engajamento da escuta**
  - [ ] Registrar eventos: play, pausa, tempo ativo, replay por trecho e taxa de conclusao.
  - [ ] Exibir painel de insights para aluno e professor (top temas, dificuldade, evolucao de score).

- [ ] **Modo offline inteligente (PWA)**
  - [ ] Cache de transcricoes e exercicios recentes para revisao sem internet.
  - [ ] Sincronizacao posterior de tentativas quando a conexao voltar.
