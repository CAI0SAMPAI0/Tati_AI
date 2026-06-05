## Product Requirements Document (PRD) - Tati AI

> **Legenda:** `- [x]` concluído · `- [ ]` pendente · `- [~]` em andamento

**Última atualização:** 2026-06-05

---

### 1. Visão Geral do Produto

O Tati AI (Teacher Tati) é uma plataforma inovadora de ensino de inglês e hub de conteúdos premium baseada em Inteligência Artificial. O produto centraliza o aprendizado de idiomas em uma tutora virtual imersiva alimentada por LLMs modernos, combinada a um sistema de Hub Educacional contendo materiais exclusivos (e-books, flashcards, áudios e PDFs).

**Objetivo de Engenharia Atual:** Otimizar o tempo de resposta do backend (FastAPI), migrar fluxos síncronos/bloqueantes para processamento em segundo plano distribuído (Celery) e implementar pipelines automáticos de IA para geração de conteúdo CEFR, garantindo estabilidade no consumo de recursos na infraestrutura da Railway.

---

### 2. Público-Alvo e Padronização de Níveis (CEFR)

Os níveis dos usuários devem seguir estritamente o padrão CEFR abaixo.

**Regra de Migração:** Usuários com o nível antigo `Business English` devem ser migrados no banco de dados para `C1`.

| Código | Label | Perfil |
|--------|-------|--------|
| A1 | Beginner | Precisa de traduções de suporte, correções detalhadas e ritmo cadenciado |
| A2 | Pre-Intermediate | Foco na confiança para conversações básicas |
| B1 | Intermediate | Introdução a vocabulário complexo e tempos verbais variados |
| B2 | Upper-Intermediate | Prática de conversação mais fluida e gírias nativas |
| C1 | Advanced | Simulações de entrevistas e discussões aprofundadas |
| C2 | Mastery / Proficiency | Domínio completo do idioma |

**Administrador (Professor/Time Tati):** Necessita de painéis para visualizar métricas, gerenciar licenças, cadastrar materiais, auditar chats e revisar/aprovar materiais gerados por IA.

---

### 3. Escopo e Funcionalidades Principais (Core Features)

#### 3.1. Hub Premium Educacional (`apps/hub-site`)
- [ ] **Vitrine e Leitor Seguro:** Catálogo de e-books e apostilas com sistema integrado de conversão de PDFs para imagens (pdf2image assíncrono), impedindo downloads não autorizados.
- [ ] **Flashcards Interativos:** Treinamento de memória por repetição espaçada com geração automática de imagens via IA.
- [ ] **Autenticação Unificada:** Login integrado (E-mail/Senha + Google OAuth) rápido e otimizado (TTFT < 400ms).

#### 3.2. Chat e Tutoria com Inteligência Artificial
- [ ] **Interação Multimodal:** Suporte a texto, áudio (Whisper STT) e uploads de arquivo, com respostas em voz (Edge TTS).
- [ ] **Orquestração de LLMs:** Integração com Groq (Llama 3), Anthropic Claude, e Gemini via RAG (Retrieval-Augmented Generation).
- [ ] **AI Exercises (Correção Rigorosa):** Os exercícios e correções gerados pela IA devem ser estritamente em Inglês, mesmo que o usuário interaja em PT-BR. Nenhuma alternativa ou explicação de exercício pode conter texto em português.

#### 3.3. Automação de Materiais CEFR (Cron & Celery)
- [ ] **Ingestão Automática:** Admins fazem upload de arquivos com o nível CEFR especificado no nome (ex: `B1_technology.pdf`).
- [ ] **Pipeline de IA:** O Celery processa o arquivo em background e gera automaticamente Flashcards, Exercícios Variados e Simulações de Conversação.
- [ ] **Agendamento:** Rotina padrão configurada para rodar 2x na semana (Cron Job). O professor terá uma interface no admin para alterar a frequência, horários e dias de execução.
- [ ] **Dashboard de Curadoria:** Todo material gerado cai em uma aba com filtros de níveis. A professora pode abrir, ver o contexto, editar, excluir ou aprovar. Após aprovado, os materiais vão para as abas respectivas.

---

### 4. Arquitetura do Sistema e Stack

A plataforma utiliza estrutura Monorepo (NPM Workspaces) para centralizar interfaces e lógica de negócio.

```
                            ┌────────────────────────┐
                            │    Frontend (Vercel)   │
                            └────────────────────────┘
                                         │
                        Requests HTTP    │   Conexão WebSocket
                                         ▼
                    ┌────────────────────────────────────────┐
                    │        FastAPI API-Gateway (Railway)   │
                    │   (Leve, Async Nativo, Sem Processos)    │
                    └────────────────────────────────────────┘
                       │                 │                │
             Eventos   │      Cache /     │                │  Queries Async
             Celery    │      Broker      │                │  (PostgREST)
                       ▼                  ▼                ▼
                ┌──────────────┐    ┌───────────────┐   ┌──────────────┐
                │ Celery Worker│    │ Upstash Redis │   │   Supabase   │
                │  (Railway)   │    │  (Cache/Fila) │   │ (PostgreSQL) │
                └──────────────┘    └───────────────┘   └──────────────┘
                        │
                ┌───────┴───────┐
                │ LibreOffice   │
                │ Poppler-Utils │
                │ ReportLab     │
                └───────────────┘
```

---

### 5. Cronograma de Execução: Sprints Técnicas

#### Sprint 1: Correções Críticas, Padronização e Otimização do Login
**Status:** `[x]` concluída

##### 5.1. Padronização CEFR (níveis A1–C2)
- [x] **Migração DB (Supabase):** `scripts/migrate_cefr_levels.sql` executado (users, simulations, cefr_flashcards, modules, podcasts).
- [x] **Backend – Enum centralizado:** `backend/app/core/enums.py` com `CEFRLevel`, `LEVEL_ALIAS_MAP`, `normalize_level()` e `cefr_window()`.
- [x] **Backend – Utilitário de match:** `backend/app/core/utils/level_utils.py` usando `normalize_level`.
- [x] **Backend – Serviços migrados:** auth, chat, simulation, ranking, podcasts, module_service, dashboard, progress, cefr/generator.
- [x] **Backend – Defaults legados:** Substituído `'Intermediate'` por `'B1'` + `normalize_level()` nos serviços restantes.
- [x] **Backend – Registro:** `auth_service.register_student` normaliza nível no insert.
- [x] **hub-core – Fonte única:** `packages/hub-core/src/levels.ts` com tipos, opções e `normalizeLevel()`.
- [x] **Frontend – Constantes:** `frontend/lib/constants/levels.ts` re-exporta do hub-core.
- [x] **Frontend – Telas migradas:** login, profile, competitions, flashcards, simulations, modules.
- [x] **Frontend – Admin:** student-modal, reports-section, cefr-section.
- [x] **hub-site – Registro:** login-form com select CEFR e default `A1`.

##### 5.2. Demais itens da Sprint 1
- [x] **Correção do Idioma nos AI Exercises:** Prompts de geração/correção (exercises, quizzes, weekly plan, url-to-module, podcasts) exigem conteúdo 100% em inglês.
- [x] **Refatoração do Endpoint `/auth/login`:** Sem I/O pesado; `activate_special_user` em background; warmup movido para endpoint dedicado.
- [x] **Endpoint isolado `GET /activities/podcasts/warmup`:** JWT + disparo em background; frontend chama após login/sessão.
- [x] **Remoção de I/O de Terceiros no Hub (`/activities/hub`):** `get_content_access` lê status só do Supabase; `payment-status` evita Asaas se já confirmado.

---

#### Sprint 2: Paralelismo de Queries e Migração Async
**Status:** `[~]` parcial

- [x] Paralelização de `/activities/personalized` com `asyncio.gather` (`personalized.py`).
- [ ] Otimização de Queries N+1 via Supabase (PostgREST Joins) — ex.: buyers/orders no `dashboard_service` ainda em fetches separados.

---

#### Sprint 3: Estruturação do Worker Celery + Infraestrutura (Railway)
**Status:** `[~]` parcial

- [x] Módulo Celery (`app/core/celery_app.py`) + beat schedule.
- [x] `Dockerfile.api` e `Dockerfile.worker` existem.
- [~] Lógica pesada migrada em parte (notificações, CEFR weekly via tasks).
- [ ] Substituir APScheduler por Celery Beat — `notification_scheduler.py` ainda usa APScheduler em paralelo.

---

#### Sprint 4: Automação do Funil CEFR (Geração de Conteúdo IA)
**Status:** `[~]` parcial

- [x] Upload CEFR + extração de nível no nome do arquivo (`cefr/admin/upload-material`, frontend `cefr-section`).
- [x] Geração de Flashcards, Exercícios e Simulações (endpoints admin + `CEFRGeneratorService`).
- [~] Cron Celery Beat 1x/semana (`geracao-semanal-cefr`); falta 2x/semana + UI admin para configurar frequência.

---

#### Sprint 5: Dashboard Admin de Curadoria CEFR
**Status:** `[~]` parcial

- [~] API de curadoria pronta (`/cefr/admin/all`, PUT/DELETE por tipo).
- [ ] Aba dedicada "AI Generated Materials" no dashboard com filtros por nível e fluxo de aprovação (hoje só upload/geração na aba CEFR Materials).

---

#### Sprint 6: Expansão Futura (Roadmap Pós-Backend)
**Status:** `[ ]` pendente

- [ ] Avatares em vídeo / animações labiais sincronizadas.
- [ ] Embutir Frontend/PWA em WebView para mobile.
- [ ] Suporte offline via Service Workers.

---

### 6. Histórico de Progresso

| Data | Item | Notas |
|------|------|-------|
| 2026-06-05 | Padronização CEFR (código) | Enum backend, hub-core/levels.ts, componentes frontend e hub-site atualizados |
| 2026-06-05 | Sprint 1 – login/warmup/hub/exercises | Login leve, warmup isolado, hub sem Asaas síncrono, prompts em inglês |
| 2026-06-05 | Migração DB CEFR | Script executado no Supabase (A1:15, A2:10, B1:8, C1:2) |
| 2026-06-05 | Logo dashboard | `tati_logo.jpg` copiado para `frontend/public/images/` |
