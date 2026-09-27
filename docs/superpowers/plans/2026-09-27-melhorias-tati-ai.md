# Melhorias Tati AI - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement responsive topbar & activities cleanup, fix hub material auto-sync bug, migrate hardcoded prompts to versioned markdown files, implement model versioning & AI caching, build complete modular RAG pipeline with evaluation set, implement structured JSON logging, eliminate hardcoded credentials/users, and document everything in PRD.md, ALTERACOES.md, and CONFIGURACOES.md.

**Architecture:**
- **Frontend (Next.js 14 App Router):** Route-aware header hiding streak/trophies on `/settings`, responsive font scaling for "Teacher Taty", CSS responsive hiding (`hidden lg:block`) of verbose subtitle texts on `/activities`, resilient polling/auto-recovery in the hub material reader.
- **Backend (Django Ninja + Celery + PyMuPDF/Poppler):** On-demand material sync in `HubService.get_content_access`, persistent cache resolution for secure pages, Markdown prompt template engine in `ai/prompts/` with memory cache, dynamic model provider configuration (`LLM_MODEL`, `EMBEDDING_MODEL`), multi-tier AI cache (Redis/memory), structured JSON logging middleware with `request_id` and `user_id`.
- **RAG Subsystem (`backend/apps/chat/rag/`):** Document ingestion (PDF, PPTX, MD, Drive), token-aware chunking with metadata, consistent embeddings with vector store abstraction (FAISS / in-memory / pgvector compatible), top-k retrieval with citations, and an automated evaluation suite.

**Tech Stack:** Next.js 14, Tailwind CSS, Django 5, Django Ninja, Python 3.14, Celery, Upstash/Redis, PyMuPDF, LangChain/vector primitives.

---

## Global Constraints
- Target branch: `desenvolvimento` (already merged with `main` and pushed to origin).
- Do not break existing student experience or Tatiana's pedagogical rules (anti-AI persona, no emojis, CEFR level adaptation).
- Never access Google Drive folders named "PESSOAIS".
- Zero hardcoded credentials or email addresses in application logic; use environment variables with sensible defaults.
- All tasks must be verified with automated tests or check scripts.

---

## Tasks Overview

### Task 1: Responsividade na Topbar & Ajustes de Texto em Activities
- Files:
  - `frontend/components/layout/main-header.tsx`
  - `frontend/app/(authenticated)/activities/activities-client-page.tsx`
- Deliverable: Hide streak/trophies in `/settings`, scale down "Teacher Taty" font, hide polluting subtitles on `sm` and `md` viewports.

### Task 2: Correção Definitiva do Bug do Hub Material (`/activities/hub/{id}/ler`)
- Files:
  - `backend/apps/activities/services.py`
  - `backend/apps/activities/api.py`
  - `frontend/app/(authenticated)/activities/hub/[id]/ler/page.tsx`
  - `apps/hub-site/app/materiais/[id]/ler/ler-client-page.tsx`
- Deliverable: Auto-sync on-demand when accessing material directly, eliminate the requirement of opening `tati-hub.vercel.app/materiais` first, add loading/retry state in frontend viewer.

### Task 3: Modelagem de IA — Prompts em Markdown & Versionamento de Modelos
- Files:
  - `backend/ai/prompts/tati_system_prompt.md`
  - `backend/ai/prompts/cefr_activity_generator.md`
  - `backend/ai/prompts/chat_simulation.md`
  - `backend/ai/prompts/word_analysis.md`
  - `backend/ai/prompts/image_prompt_generator.md`
  - `backend/ai/prompts/leveling_assessment.md`
  - `backend/shared/prompt_manager.py`
  - `backend/apps/chat/services.py`
  - `backend/apps/activities/generator.py`
  - `backend/apps/chat/word_service.py`
  - `backend/apps/chat/simulation_api.py`
- Deliverable: Centralized prompt manager loading versioned `.md` files; configurable `LLM_MODEL` and `EMBEDDING_MODEL` via settings/env.

### Task 4: Cache de IA (Queries Idempotentes, Embeddings, Retrieval)
- Files:
  - `backend/shared/ai_cache.py`
  - `backend/apps/chat/services.py`
- Deliverable: High-performance caching layer for LLM responses, embeddings, and frequent queries.

### Task 5: RAG Subsystem (Ingestão, Chunking, Embeddings, Retrieval, Citações e Eval Set)
- Files:
  - `backend/apps/chat/rag/__init__.py`
  - `backend/apps/chat/rag/ingestion.py`
  - `backend/apps/chat/rag/embeddings.py`
  - `backend/apps/chat/rag/vector_store.py`
  - `backend/apps/chat/rag/retrieval.py`
  - `backend/apps/chat/rag/rag_service.py`
  - `backend/apps/chat/rag/eval_set.py`
- Deliverable: Complete RAG pipeline supporting Tatiana's course materials, Google Drive folder ingestion (ignoring PESSOAIS), citation formatting, and 50-query eval benchmark.

### Task 6: Auditoria de Código, Hardcoded Removal & Structured JSON Logging
- Files:
  - `backend/app/middleware.py`
  - `backend/app/settings/base.py`
  - `backend/apps/activities/services.py`
  - `backend/apps/notifications/services.py`
  - `backend/apps/authentication/models.py`
- Deliverable: Structured JSON logs with `user_id` and `request_id`, removal of hardcoded emails and admin usernames.

### Task 7: Documentação Completa (PRD.md, ALTERACOES.md, CONFIGURACOES.md)
- Files:
  - `PRD.md` (Checklist with [X] for verified tasks)
  - `ALTERACOES.md` (Detailed step-by-step changelog)
  - `CONFIGURACOES.md` (Environment variables, required tools, and setup instructions)
- Deliverable: Three root documentation files ready for Caio's return at 20h40.
