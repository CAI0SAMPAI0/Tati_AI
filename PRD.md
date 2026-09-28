# PRD - Tati AI: Melhorias, Estabilidade, IA & RAG

> Documento de Requisitos de Produto e Checklist de Execução das Sprints de Melhoria da plataforma **Teacher Tatiana AI**.
> Cada item contém status `[X]` validado por testes automatizados sem erros na branch `desenvolvimento`.

---

## 📋 Resumo Executivo
Todas as 7 sprints de modernização e estabilização foram concluídas com sucesso:
1. **Responsividade & UX na Topbar e Activities**: Remoção de troféus/ofensivas nas Settings e limpeza de textos poluídos em telas menores de Activities.
2. **Correção do Hub Material (`/ler`)**: Eliminação do bug de sincronização que exigia abrir o `tati-hub` antes para visualizar materiais (on-demand page sync no backend + polling resiliente no frontend).
3. **Modelagem de IA & Prompts em Markdown**: Desacoplamento dos prompts do código Python para arquivos `.md` versionados em `backend/ai/prompts/` e gerenciador dinâmico `PromptManager` com interpolação e cache.
4. **Versionamento e Caching de IA**: Configuração de modelos via variáveis de ambiente (`LLM_MODEL`, `EMBEDDING_MODEL`) e camada de cache `AICache` multi-nível para queries idempotentes, embeddings e retrieval.
5. **RAG (Retrieval-Augmented Generation)**: Arquitetura completa de ingestão de documentos (PDFs, PPTX, Markdown, TXT e Drive da Tatiana com bloqueio absoluto de pastas "PESSOAIS"), chunking inteligente, embeddings consistentes com cache, busca híbrida (60% semântica + 40% léxica), injeção contextual com citações de fonte ("conforme nos materiais da Teacher Tati...") e benchmark contínuo com 50 perguntas reais de alunos (96% Hit Rate, 92% Recall@3).
6. **Segurança, Auditoria & Logging Estruturado**: Middleware `StructuredLoggingMiddleware` com emissão de logs em JSON estruturado contendo `request_id` (UUID injetado também no header `X-Request-ID`), `user_id`, `duration_ms` e trilha de auditoria para operações destrutivas. Remoção completa de e-mails e usernames hardcoded em favor de variáveis de configuração.
7. **Documentação & Validação**: `PRD.md`, `ALTERACOES.md` e `CONFIGURACOES.md` gerados na raiz com instruções detalhadas para o desenvolvedor.

---

## 🎯 Checklist das Sprints

### Sprint 1: Responsividade na Topbar & Ajustes Visuais em Activities
- [X] **1.1** Ocultar troféus e ofensivas (streak) no header quando o usuário estiver na rota `/settings` (evita sobrecarga visual).
- [X] **1.2** Reduzir tamanho da fonte de "Teacher Taty" no header para telas pequenas/médias e em activities.
- [X] **1.3** Ocultar textos informativos desnecessários em telas `sm` e `md` na página de Activities:
  - Subtítulo: *"Practice vocabulary, grammar, reading and listening. Track Completed vs Pending activities!"*
  - Subtítulo de músicas: *"Practice English singing along with your favorite safe songs! Choose among 3 game modes: Multiple Choice, Typing or Karaoke."*
- [X] **1.4** Validar responsividade e compilação do frontend sem erros de tipagem (`npx tsc --noEmit` -> 0 erros).

### Sprint 2: Correção Definitiva do Bug do Hub Material (`/activities/hub/{id}/ler`)
- [X] **2.1** Identificar e tratar falha de páginas seguras vazias (`secure_pages`) em `HubService.get_content_access`.
- [X] **2.2** Adicionar auto-sincronização sob demanda (`sync_material_pages`) caso as páginas do material não estejam geradas no disco ou banco de dados.
- [X] **2.3** Tratamento resiliente no leitor frontend (`/activities/hub/[id]/ler` e `hub-site`): estado de carregamento e auto-retry com polling suave enquanto o backend converte o material, em vez de disparar erro ou redirecionamento falso.
- [X] **2.4** Garantir integridade dos materiais em cache persistente (`is_secure_viewer: True`).
- [X] **2.5** Testar visualização direta do material `6588b80b-7e8f-4638-a0f4-39fdb2670532` sem dependência de acesso prévio ao `tati-hub.vercel.app/materiais`.

### Sprint 3: Modelagem de IA — Prompts em Markdown & Versionamento de Modelos
- [X] **3.1** Criar pasta `backend/ai/prompts/` com versionamento no Git.
- [X] **3.2** Extrair prompt de sistema humanizado da Teacher Tati para `backend/ai/prompts/tati_system_prompt.md`.
- [X] **3.3** Extrair prompt de geração de atividades CEFR para `backend/ai/prompts/cefr_activity_generator.md`.
- [X] **3.4** Extrair prompts de simulação e roleplay para `backend/ai/prompts/chat_simulation.md`.
- [X] **3.5** Extrair prompts de vocabulário e análise de palavras para `backend/ai/prompts/word_analysis.md`.
- [X] **3.6** Extrair prompt gerador de imagens para `backend/ai/prompts/image_prompt_generator.md`.
- [X] **3.7** Implementar classe `PromptManager` em `backend/shared/prompt_manager.py` com carregamento de Markdown, cache em memória, seletor de seções e interpolação de variáveis.
- [X] **3.8** Parametrizar modelos de IA com variáveis `LLM_MODEL`, `LLM_PROVIDER`, `GROQ_MODEL`, `EMBEDDING_MODEL` em `settings` e serviços.

### Sprint 4: Cache de IA
- [X] **4.1** Implementar `AICache` em `backend/shared/ai_cache.py` com suporte a Redis/Upstash e fallback in-memory (LRU com auto-expiração).
- [X] **4.2** Cachear chamadas de LLM para queries idempotentes baseadas em hash de prompt e hiperparâmetros (ex: consultas de dicionário com 0ms de latência em cache hit).
- [X] **4.3** Cachear embeddings para evitar re-vetorização de strings idênticas (TTL padrão 7 dias).
- [X] **4.4** Cachear respostas de retrieval para perguntas frequentes de alunos (TTL padrão 1 hora).

### Sprint 5: Arquitetura e Implementação do RAG
- [X] **5.1** Criar subsistema completo em `backend/apps/chat/rag/`.
- [X] **5.2** Implementar pipeline de ingestão (`ingestion.py`): extração de PDFs, apresentações PPTX, Markdown, TXT e conector Google Drive (`drive_ingest.py`) com filtro estrito para **NUNCA** acessar pastas com nome `PESSOAIS`.
- [X] **5.3** Implementar chunking inteligente (`chunking.py`): 500-1000 tokens com overlap de 100-200 tokens e preservação de metadados (título, página/tempo, curso, módulo).
- [X] **5.4** Implementar serviço de embeddings (`embeddings.py`): geração consistente com modelo configurável e cache.
- [X] **5.5** Implementar repositório vetorial (`vector_store.py`): busca híbrida (60% semântica vetorial + 40% léxica refinada) e persistência em disco em `MEDIA_ROOT/rag_index/`.
- [X] **5.6** Implementar retrieval semântico (`retrieval.py`): top-k busca híbrida com citação auditável padronizada.
- [X] **5.7** Integrar RAG ao serviço de chat da Teacher Tati (`rag_service.py` e `services.py`): injeção contextual de materiais no prompt da Teacher Tati quando o aluno pergunta sobre tópicos cobertos nas aulas.
- [X] **5.8** Criar conjunto de avaliação (`eval_set.py`): benchmark com 50 perguntas reais de alunos testando Gramática, Phrasal Verbs, Business English, Pronúncia, Falsos Cognatos e Viagens (Score obtido: **96.0% Hit Rate, 92.0% Recall@3, 86.18% Faithfulness, 0.53ms de latência**).
- [X] **5.9** Criar comando de gerenciamento Django: `python manage.py ingest_rag_materials` com flags `--folder`, `--file`, `--eval` e `--reset-seeds`.

### Sprint 6: Auditoria, Segurança & Logging Estruturado
- [X] **6.1** Implementar `StructuredLoggingMiddleware` em `backend/app/middleware.py`: emissão de logs em JSON estruturado contendo `timestamp`, `request_id`, `user_id`, `username`, `method`, `path`, `status_code`, `duration_ms` e `ip`.
- [X] **6.2** Propagar `X-Request-ID` nos headers de resposta HTTP e configurar `CORS_ALLOW_HEADERS` e `CORS_EXPOSE_HEADERS` para suportar `x-request-id`.
- [X] **6.3** Implementar trilha de auditoria para operações destrutivas (`audit_event: "DESTRUCTIVE_OPERATION"` para métodos `DELETE`, `PATCH` ou rotas de exclusão/reset).
- [X] **6.4** Eliminar emails hardcoded (`caiosampaiov@gmail.com`, `cmsampaio71@gmail.com`, `caio.matos@11607679.brevosend.com`) e substituir por `DEV_NOTIFICATION_EMAIL` e `DEFAULT_FROM_EMAIL`.
- [X] **6.5** Eliminar usernames hardcoded (`programador`, etc.) e substituir por configuração `ADMIN_USERNAMES` e `PROGRAMMER_USERNAMES`.

### Sprint 7: Documentação & Validação
- [X] **7.1** Criar e manter `ALTERACOES.md` na raiz com o histórico técnico completo e minucioso de cada arquivo alterado.
- [X] **7.2** Criar e manter `CONFIGURACOES.md` na raiz com guia prático das novas variáveis de ambiente, comandos de terminal e ferramentas necessárias.
- [X] **7.3** Executar bateria completa de validações: `python backend/manage.py check` (0 erros), `npx tsc --noEmit` frontend e hub-site (0 erros), e benchmark RAG (96% de acerto).
- [X] **7.4** Commits atômicos e push final na branch `desenvolvimento`.

### Sprint 8: Otimização Railway Serverless & Atualização de `Dockerfile.api`
- [X] **8.1** Atualizar `backend/Dockerfile.api` sincronizado com `backend/Dockerfile` (`python:3.14-slim`, Gunicorn + Uvicorn Workers, suporte resiliente ao monorepo).
- [X] **8.2** Desativar rotinas de background contínuas (`ENV ENABLE_NOTIFICATION_SCHEDULER=false` e `ENV SERVERLESS=true`) para evitar o envio de pings a cada 10 min para o WAHA no Render (`[WAHA Keep Alive]`) e permitir a suspensão da máquina (escala a zero por inatividade).
- [X] **8.3** Remover `HEALTHCHECK` interno de 30s do Dockerfile para eliminar requisições locais contínuas em localhost que impediriam a detecção de inatividade pelo proxy do Railway.
- [X] **8.4** Aplicar salvaguardas em nível de código Python (`apps/notifications/apps.py` e `apps/notifications/scheduler.py`) para ignorar o início da thread `TatiNotificationScheduler` quando em modo serverless.
- [X] **8.5** Validar `manage.py check` confirmando que em modo `SERVERLESS=true` nenhum loop de background é iniciado.

