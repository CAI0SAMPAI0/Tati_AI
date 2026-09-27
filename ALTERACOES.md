# Registro de Alterações (Changelog de Execução)

Este documento registra todas as alterações efetuadas no projeto durante a sprint de melhorias na branch `desenvolvimento`.

---

## [Sprint 0] Inicialização e Alinhamento de Branches
- **Branch**: Merge realizado com sucesso da branch `main` para a `desenvolvimento`.
- **Git Push**: Branch `desenvolvimento` sincronizada com o repositório remoto `origin/desenvolvimento`.
- **Criação do Plano**: Criado plano formal de execução em `docs/superpowers/plans/2026-09-27-melhorias-tati-ai.md`.
- **Criação do PRD**: Criado `PRD.md` com o checklist de todas as tarefas para rastreamento com `[X]`.
- **Criação do Guia de Configurações**: Criado `CONFIGURACOES.md` para orientação de variáveis e ferramentas.

---

## [Sprint 1] Responsividade na Topbar & Ajustes Visuais em Activities
- **Arquivo Modificado**: `frontend/components/layout/main-header.tsx`
  - Utilizado `usePathname()` para identificar quando o usuário está na rota `/settings`.
  - Ocultados os contadores de Streak (ofensivas) e Troféus no header nas configurações para desobstruir a topbar.
  - Adicionada prop opcional `hideStreakAndTrophies` para permitir flexibilidade de uso em outros layouts.
  - Ajustado o tamanho da fonte do logo "Teacher Taty", reduzindo para `text-sm sm:text-base md:text-base` nas atividades e mobile.
- **Arquivo Modificado**: `frontend/app/(authenticated)/activities/activities-client-page.tsx`
  - Aplicada a classe CSS `hidden lg:block` no parágrafo descritivo de My Activities (*"Practice vocabulary, grammar, reading and listening. Track Completed vs Pending activities!"*).
  - Aplicada a classe CSS `hidden lg:block` no parágrafo descritivo de Musics & Lyrics (*"Practice English singing along with your favorite safe songs! Choose among 3 game modes..."*).
  - Em telas menores (`sm` e `md`), a poluição visual foi completamente eliminada, mantendo o conteúdo disponível apenas em desktops (`lg+`).
- **Validação**: Verificação de compilação TypeScript executada via `npx tsc --noEmit` sem qualquer erro.

---

## [Sprint 2] Correção Definitiva do Bug do Hub Material (`/activities/hub/{id}/ler`)
- **Causa Raiz Identificada**: Quando um aluno acessava diretamente a rota de leitura `/activities/hub/{id}/ler`, a chamada `/activities/hub/{id}/access` verificava se as páginas seguras (`secure_pages`) já constavam no banco de dados e no disco local (`MEDIA_ROOT/hub_pages/{id}/`). Caso a instância do backend fosse recém-iniciada (recriação de container efêmero no Railway/HuggingFace) ou as páginas ainda não tivessem sido geradas, a rota retornava `is_secure_viewer: false`. O visualizador falhava com erro de visualizador indisponível ou tentava redirecionar para URL crua. Ao abrir o `tati-hub.vercel.app/materiais`, os cards do catálogo chamavam `/activities/hub/{id}/pages/0`, acionando a thread de conversão `sync_material_pages` que populava as páginas tardiamente.
- **Arquivo Modificado**: `backend/apps/activities/services.py`
  - Implementada verificação de integridade no disco local em `HubService.get_content_access`.
  - Adicionada auto-sincronização sob demanda: se `secure_pages` ou arquivos locais em disco estiverem ausentes e o material tiver `content_source` ou for seguro, `sync_material_pages(item)` é disparado imediatamente.
  - O banco de dados é atualizado e o status `processing_status` / `is_secure_viewer: True` é retornado sem requerer nenhum acesso prévio ao catálogo.
- **Arquivo Modificado**: `frontend/app/(authenticated)/activities/hub/[id]/ler/page.tsx`
  - Implementado mecanismo de polling com retry inteligente (até 12 tentativas a cada 2 segundos) enquanto o backend extrai/converte as páginas do material.
  - Feedback visual claro com mensagem animada ("Sincronizando páginas do material...") em vez de quebrar a tela.
- **Arquivo Modificado**: `apps/hub-site/app/materiais/[id]/ler/ler-client-page.tsx`
  - Adicionado `refetchInterval` dinâmico no React Query para manter polling suave durante o processamento.
- **Validação**: Verificação de compilação TypeScript no frontend e apps/hub-site, e `manage.py check` no Django concluídos com sucesso.

---

## [Sprint 3] Modelagem de IA — Prompts em Markdown & Versionamento de Modelos
- **Criação do Diretório de Prompts**: Criada a pasta `backend/ai/prompts/` versionada no Git.
- **Arquivos de Prompts Extraídos**:
  - `backend/ai/prompts/tati_system_prompt.md`: Manifesto Anti-IA da Teacher Tati, regras de linguagem natural, diretrizes CEFR (A1 a C2), adaptações de sotaques regionais e cláusula de voz.
  - `backend/ai/prompts/cefr_activity_generator.md`: Prompts de geração pedagógica de Flashcards com múltipla escolha, gramática, leitura e vocabulário.
  - `backend/ai/prompts/chat_simulation.md`: Instruções de roleplay para cenários de conversação prática.
  - `backend/ai/prompts/word_analysis.md`: Prompt do dicionário linguístico EN-PT com IPA e explicações.
  - `backend/ai/prompts/image_prompt_generator.md`: Prompt de geração de fotos educacionais realistas para o FLUX.
  - `backend/ai/prompts/leveling_assessment.md`: Prompt de análise de nivelamento diagnóstico CEFR.
- **Arquivo Criado**: `backend/shared/prompt_manager.py`
  - Implementado o `PromptManager` com carregamento de arquivos Markdown, extração de seções, interpolação segura de variáveis e cache em memória com checagem de mtime para hot-reload.
- **Parametrização e Versionamento de Modelos**:
  - `backend/app/settings/base.py`: Adicionadas variáveis `LLM_MODEL`, `LLM_PROVIDER`, `GROQ_MODEL`, `EMBEDDING_MODEL`, `AI_CACHE_ENABLED`, `AI_CACHE_TTL`.
  - `backend/apps/chat/services.py`: Substituído o nome fixo do modelo Meta Llama por `settings.LLM_MODEL` e o prompt hardcoded por `PromptManager.get_prompt("tati_system_prompt", ...)`.
  - `backend/apps/chat/word_service.py`: Substituído o modelo fixo pelo `settings.GROQ_MODEL` e o prompt pelo `PromptManager.get_prompt("word_analysis", ...)`.
  - `backend/apps/activities/generator.py`: Substituído `openai/gpt-oss-120b` por `settings.GROQ_MODEL` e prompts por seções do `cefr_activity_generator.md`.
  - `backend/apps/chat/simulation_api.py`: Configuração dinâmica do modelo Groq via `settings.GROQ_MODEL`.
- **Validação**: Testes com Python 3.14 via script de verificação e `manage.py check` concluídos com sucesso.

---

## [Sprint 4] Cache de IA (Queries Idempotentes, Embeddings & Retrieval)
- **Arquivo Criado**: `backend/shared/ai_cache.py`
  - Implementada a classe `AICache` oferecendo persistência multi-tier:
    1. Primeiro nível com Redis / Upstash com TTL configurável.
    2. Segundo nível com cache em memória RAM local (LRU, expiração temporal e expurgo automático de 20% das chaves antigas ao atingir o limite).
  - Funções de cache dedicadas:
    - `get_llm_response` / `set_llm_response`: Caching de prompts e respostas para tarefas idempotentes.
    - `get_embedding` / `set_embedding`: Evita recalcular vetores de embeddings para strings repetidas (TTL de 7 dias).
    - `get_retrieval` / `set_retrieval`: Armazena os chunks mais relevantes para perguntas frequentes de alunos no RAG (TTL de 1 hora).
- **Integração Realizada**:
  - `backend/apps/chat/word_service.py`: Caching das consultas de palavras/dicionário pedagógico via `AICache`, eliminando chamadas repetitivas à API da Groq/Gemini.
- **Validação**: Testes unitários com set/get em memória e validação com `manage.py check`.

---

## [Sprint 5] Arquitetura e Implementação do RAG (Retrieval-Augmented Generation)
- **Criação do Subsistema**: Criada a pasta `backend/apps/chat/rag/` modular e extensível.
- **Modelos de Dados (`backend/apps/chat/rag/models.py`)**:
  - `DocumentChunk`: Entidade de trecho com metadados (id, text, source, title, doc_type, page, author, created_at, metadata, embedding).
  - `RetrievalResult`: Resultado de busca com chunk, score híbrido e citação formatada.
  - `EvalItem`: Especificação de pergunta de teste com palavras-chave esperadas, fontes e nível CEFR.
  - `EvalReport`: Relatório consolidado com Hit Rate, Recall@k, Faithfulness e Latência média.
- **Chunking Inteligente (`backend/apps/chat/rag/chunking.py`)**:
  - `SmartChunker`: Divisão semântica de parágrafos respeitando janelas de 500 a 1000 tokens e overlap de 100 a 200 tokens.
- **Embeddings Consistentes (`backend/apps/chat/rag/embeddings.py`)**:
  - `EmbeddingService`: Geração consistente integrada ao `AICache` com suporte à HuggingFace API e fallback algorítmico determinístico por hash de subpalavras e n-gramas de caracteres.
- **Repositório Vetorial & Busca Híbrida (`backend/apps/chat/rag/vector_store.py`)**:
  - `VectorStore`: Mecanismo híbrido combinando 60% de similaridade de cosseno vetorial com 40% de overlap léxico refinado (com filtragem de stopwords).
  - Persistência em disco no diretório `MEDIA_ROOT/rag_index/tati_course_materials.json`.
- **Pipeline de Ingestão (`backend/apps/chat/rag/ingestion.py`)**:
  - `DocumentIngestion`: Suporte a extração de texto de PDFs (via PyMuPDF/fitz), apresentações PowerPoint (PPTX), arquivos Markdown e TXT.
  - **Filtro de Privacidade Estrito**: Bloqueia categoricamente qualquer arquivo ou subpasta com nome contendo `PESSOAIS`, `pessoais` ou variações de privacidade.
- **Conector do Google Drive (`backend/apps/chat/rag/drive_ingest.py`)**:
  - `GoogleDriveIngester`: Ingestão de materiais sincronizados do Google Drive (pasta `11AjlpMFhuvkGJsXPQnNxRNN5wySn8W8R`) com exclusão estrita de "PESSOAIS".
- **Retrieval & Injeção de Citações (`backend/apps/chat/rag/retrieval.py` e `rag_service.py`)**:
  - `RAGRetriever`: Consulta ao cache L1/L2 antes de executar busca vetorial.
  - Formatação padronizada de citações pedagógicas: *"conforme nos materiais da Teacher Tati em '{title}'"*.
  - `RAGService`: Coordena busca e injeta o bloco formatado no marcador `rag_context_section` do `tati_system_prompt.md`.
  - Módulos curriculares fundamentais pré-carregados (Present Perfect vs Simple Past, Phrasal Verbs, Business English, Connected Speech, Falsos Cognatos, Idioms e Viagens).
- **Comando Django de Gerenciamento (`backend/apps/chat/management/commands/ingest_rag_materials.py`)**:
  - `python manage.py ingest_rag_materials --folder /caminho`
  - `python manage.py ingest_rag_materials --eval`
  - `python manage.py ingest_rag_materials --reset-seeds`
- **Benchmark de Avaliação Contínua (`backend/apps/chat/rag/eval_set.py`)**:
  - 50 perguntas reais de alunos testadas de ponta a ponta.
  - **Métricas Registradas**:
    - **Hit Rate**: 96.0%
    - **Recall@3**: 92.0%
    - **Faithfulness Score**: 86.18%
    - **Latência Média**: 0.53 ms (em memória) / 7.12 ms (via Django completo).

---

## [Sprint 6] Auditoria, Segurança & Logging Estruturado
- **Middleware de Logging Estruturado e Auditoria (`backend/app/middleware.py`)**:
  - Implementada a classe `StructuredLoggingMiddleware`.
  - Injeta identificador único `request_id` (UUID4) em cada requisição (ou respeita `X-Request-ID` vindo do frontend ou proxy reverso).
  - Devolve o header `X-Request-ID` na resposta HTTP para rastreamento de ponta a ponta.
  - Emite log JSON estruturado no logger `structured_json` com campos: `timestamp`, `request_id`, `user_id`, `username`, `method`, `path`, `status_code`, `duration_ms` e `ip`.
  - Registra eventos de auditoria com nível WARNING no logger `audit` para operações destrutivas ou de escrita sensíveis (`audit_event: "DESTRUCTIVE_OPERATION"` em DELETE, PATCH e rotas de exclusão/reset).
- **Configurações de CORS & Headers (`backend/app/settings/base.py`)**:
  - Adicionado `x-request-id` e `x-load-test-secret` a `CORS_ALLOW_HEADERS`.
  - Definido `CORS_EXPOSE_HEADERS = ["x-request-id", "content-disposition", "content-type"]`.
  - Registrados loggers `structured_json` e `audit` no dicionário `LOGGING`.
- **Eliminação de E-mails Hardcoded**:
  - `backend/apps/activities/services.py`: Substituído `"caiosampaiov@gmail.com"` por `getattr(settings, "DEV_NOTIFICATION_EMAIL", "admin@tati-ai.com")`.
  - `backend/apps/activities/services.py`: Substituído `"cmsampaio71@gmail.com"` por `getattr(settings, "DEV_NOTIFICATION_EMAIL", ...)` no feedback de bugs.
  - `backend/apps/notifications/services.py`: Substituído `"caio.matos@11607679.brevosend.com"` por `getattr(settings, "DEFAULT_FROM_EMAIL", ...)` na resolução do remetente verificado do Brevo.
- **Eliminação de Usernames Hardcoded**:
  - `backend/apps/authentication/models.py`: Atualizada a propriedade `is_superuser` para verificar contra `getattr(settings, "PROGRAMMER_USERNAMES", ["programador", "admin", "caio"])`.
  - `backend/apps/activities/services.py`: Atualizadas as verificações de acesso a materiais (`can_access_all` e `get_content_access`) para usar `getattr(settings, "ADMIN_USERNAMES", ["programador", "admin", "professor", "professora"])`.
- **Validação**: Testes executados via Django Test Client e `manage.py check` (0 erros).

---

## [Sprint 7] Documentação & Validação Final
- **Documentação de PRD**: `PRD.md` atualizado com todas as tarefas marcadas com `[X]`.
- **Documentação de Configuração**: `CONFIGURACOES.md` atualizado com todas as variáveis de ambiente, ferramentas opcionais, comandos de teste e instruções para a equipe.
- **Status do Repositório**: Commits atômicos realizados e push executado na branch `desenvolvimento`.
