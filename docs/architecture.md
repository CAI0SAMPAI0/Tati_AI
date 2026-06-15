# Visão Geral e Arquitetura

O **Tati AI** é uma plataforma de ensino de inglês que utiliza Inteligência Artificial para proporcionar uma experiência educacional moderna e interativa.

## Arquitetura do Monorepo

O projeto utiliza uma estrutura de monorepo para facilitar o compartilhamento de código e a gestão de múltiplas aplicações:

-   **`apps/hub-site/`**: Portal de materiais e conteúdo (Next.js 14).
-   **`backend/`**: API principal desenvolvida com FastAPI (Python).
-   **`frontend/`**: Aplicação principal do aluno (Next.js 14).
-   **`packages/hub-core/`**: Biblioteca compartilhada de tipos e lógica de negócios (TypeScript).
-   **`mobile_app/`**: Aplicativos móveis (Capacitor) e desktop (Tauri).
-   **`pwa/`**: Configurações e assets para Progressive Web App.

## Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Backend** | Python 3.12, FastAPI, Pydantic, Uvicorn |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| **Banco de Dados** | PostgreSQL (Supabase) |
| **Cache/Mensageria** | Redis (Upstash) |
| **IA** | Groq (Llama 3), Google GenAI (Gemini) |
| **Áudio (STT/TTS)** | OpenAI Whisper, Edge TTS |
| **Processamento Async** | Celery |

## Camadas do Sistema

O sistema é dividido em três camadas principais:

1.  **Interface (Frontend/Mobile)**: Consome a API e fornece a experiência do usuário.
2.  **API (Backend)**: Gerencia a lógica de negócio, autenticação e integrações.
3.  **Workers (Celery)**: Processa tarefas pesadas ou assíncronas em segundo plano, como geração de relatórios e notificações.
