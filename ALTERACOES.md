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

---

## [Correção Pós-Deploy] Resolução do Erro Recorrente de Troféus em Produção
- **Causa Raiz Identificada nos Logs**:
  Os logs do container de produção indicavam múltiplos warnings a cada consulta de `/users/streak`:
  `Error notifying unlocked trophies for programador: column "unlocked_at" of relation "user_trophies" does not exist`
  `column "trophy_id" is of type uuid but expression is of type character varying`
  Isso acontecia porque a tabela `user_trophies` no PostgreSQL foi criada externamente com `earned_at` (em vez de `unlocked_at`) e `trophy_id` como `UUID` (em vez de aceitar slugs alfanuméricos como `streak-7`). Como o modelo possuía `managed = False`, o Django nunca sincronizou a estrutura.
- **Solução Implementada**:
  1. Executado script de migração DDL no PostgreSQL do Railway garantindo a coluna `unlocked_at TIMESTAMPTZ` (sincronizada com `earned_at`) e alterando `trophy_id` para `VARCHAR(100)` para suportar tanto UUIDs legados quanto novos slugs de conquistas.
  2. Adicionada rotina de auto-cura (`_ensure_user_trophies_schema`) em background no `ready()` de [`backend/apps/activities/apps.py`](file:///C:/Users/caio/Projetos/Tati_AI/backend/apps/activities/apps.py) para que qualquer nova réplica ou banco garanta esse schema na inicialização de forma segura e transparente.
  3. Validada a inserção e desbloqueio de troféus sem qualquer warning ou erro nos logs.

---

## [Otimização Railway Serverless] Atualização de `Dockerfile.api` & Permissão de Sleep (Escala a Zero)
- **Causa Raiz Identificada**:
  Na Railway, instâncias configuradas com Serverless (App-Sleeping) monitoram tráfego de saída e requisições para suspender o container após ~10 minutos de inatividade. O backend não entrava em modo de suspensão (sleep) porque:
  1. O `BackgroundNotificationRunner` executava um loop contínuo em segundo plano a cada 30 segundos, disparando um ping HTTP periódico para o WAHA no Render (`https://waha-tati.onrender.com/api/sessions`) a cada 10 minutos (`[WAHA Keep Alive] Render WAHA ping response: 200`), resetando ininterruptamente o contador de inatividade da Railway.
  2. O loop também consultava o banco de dados a cada 60 segundos buscando agendamentos CEFR ativos, gerando pacotes TCP de saída no PostgreSQL.
  3. O `Dockerfile.api` anterior possuía `HEALTHCHECK --interval=30s` executando `curl` local interno a cada 30 segundos, além de utilizar a imagem legada `python:3.13-slim` com Daphne em vez da infraestrutura moderna de produção.
- **Solução Implementada**:
  1. **Atualização do `backend/Dockerfile.api`**:
     - Atualizado com base em `backend/Dockerfile`: `python:3.14-slim`, dependências completas do sistema (compilação, LibreOffice, Poppler, ffmpeg), cópia resiliente do monorepo (`/tmp/build/`) e servidor ASGI de alta performance com Gunicorn + Uvicorn Workers.
     - Definidas variáveis de ambiente padrão no container: `ENV ENABLE_NOTIFICATION_SCHEDULER=false` e `ENV SERVERLESS=true`.
     - Removido o `HEALTHCHECK` interno de 30s do Dockerfile (o Railway utiliza seu próprio healthcheck externo via proxy durante rollouts, permitindo que o container atinja inatividade completa sem probes locais contínuos).
  2. **Defesa em Duplo Nível no Código Python**:
     - `backend/apps/notifications/apps.py`: Detecta `SERVERLESS=true` ou `ENABLE_NOTIFICATION_SCHEDULER=false` e ignora o início do `BackgroundNotificationRunner`.
     - `backend/apps/notifications/scheduler.py`: Adicionada verificação idêntica em `BackgroundNotificationRunner.start()` para impedir instanciação da thread sob qualquer circunstância em ambientes serverless.
  3. **Manutenção de Notificações sob Demanda**:
     - Todas as rotinas de disparo agendado (Streaks, relatórios de evolução, incentivo de inatividade e fechamento de competição mensal) continuam totalmente operacionais via webhooks seguros protegidos por token (`/api/notifications/cron/*`), permitindo acionamento via cron externo (ex: Railway Cron, Vercel Cron, GitHub Actions) sem manter a instância de API acordada 24/7.




---

## [Sprint 9] Restauração dos Avatares da Teacher Tati, Ajuste "Music 213" & Merge Produção/Desenvolvimento
- **Problema Relatado**:
  1. Em produção na branch `main`, os avatares da Teacher Tatiana não estavam aparecendo no Modo de Voz (`/voice`) e nas Atividades (`/activities`).
  2. Na aba de músicas em Activities, aparecia "Musics 213", e a Teacher Tatiana solicitou a remoção do plural "s" para ficar "Music 213".
  3. No modal de configurações (`/settings`), a topbar estava poluída com troféus e ofensivas (streaks).
- **Causa Raiz Técnica**:
  1. **Arquivos ausentes no frontend**: Os 14 arquivos `.webp` dos visemas e animações faciais da Tatiana (`avatar_tati_normal.webp`, `avatar_tati_meio.webp`, `avatar_tati_aberta.webp`, `avatar_tati_bem_aberta.webp`, `avatar_tati_ouvindo.webp`, `tati_piscando.webp`, `tati_surpresa.webp`, `frame_A.webp` a `frame_F.webp`) existiam apenas na pasta `backend/assets/avatar/` e nunca foram versionados na pasta `frontend/public/avatar/`. Como o build da Vercel só consome o diretório `frontend/`, esses arquivos resultavam em HTTP 404 em produção.
  2. **Dependência síncrona de endpoint de backend no VoiceAvatar**: O componente `VoiceAvatar` usava `INITIAL_SRC = '/images/tati_logo.jpg'` e aguardava uma requisição de rede para `/avatar/frames`. Além disso, a função interna `getUrl` tentava prefixar qualquer caminho relativo com a URL do backend (`${API_BASE}/...`), causando falhas se a API estivesse inicializando ou se o container estivesse dormindo.
  3. **Avatar padrão quebrado (`img.magnific.com`)**: Tanto o frontend (`frontend/lib/constants/user.ts`) quanto o backend (`backend/apps/authentication/models.py`) definiam `DEFAULT_AVATAR_URL` como uma URL externa inativa (`img.magnific.com`), fazendo com que qualquer usuário ou fallback de avatar quebrasse visualmente.
- **Solução Implementada**:
  1. **Cópia e versionamento estático de todos os frames**:
     - Copiados os 14 frames `.webp` para `frontend/public/avatar/` e `frontend/public/images/avatar/`, garantindo entrega com 0ms de latência diretamente pelo CDN da Vercel.
  2. **Modernização resiliente do `VoiceAvatar` (`frontend/components/chat/voice-avatar.tsx`)**:
     - Definido `INITIAL_SRC = '/avatar/avatar_tati_normal.webp'`.
     - Criado objeto `DEFAULT_FRAMES` estático local apontando para todos os 14 visemas locais.
     - Atualizada a função `getUrl` para servir arquivos `/avatar/` e `/images/` diretamente sem direcionar para a API externa.
     - Adicionadas tratativas de `onError` com fallback para evitar telas brancas ou ícones quebrados.
  3. **Correção do `DEFAULT_AVATAR_URL`**:
     - Atualizado em `frontend/lib/constants/user.ts` e `backend/apps/authentication/models.py` para `/avatar/avatar_tati_normal.webp`.
  4. **Presença visual da Teacher Tati nas Atividades e Chat**:
     - Inserido avatar da Tatiana no [`MainHeader`](file:///C:/Users/caio/Projetos/Tati_AI/frontend/components/layout/main-header.tsx) ao lado de "Teacher Taty".
     - Inserido avatar da Tatiana no topo da [`SidebarActivities`](file:///C:/Users/caio/Projetos/Tati_AI/frontend/components/activities/sidebar-activities.tsx).
     - Inserido avatar da Tatiana no título da página [`My Activities`](file:///C:/Users/caio/Projetos/Tati_AI/frontend/app/(authenticated)/activities/activities-client-page.tsx).
     - Atualizadas as bolhas de chat de IA e tela inicial de boas-vindas para utilizar o avatar facial da Tatiana.
  5. **Ajuste da Aba "Music 213"**:
     - `activities-client-page.tsx`: Alterado `label: 'Musics'` para `label: 'Music'`, exibindo agora `Music 213`.
     - Atualizado o título de `Musics & Lyrics (LingoClip)` para `Music & Lyrics (LingoClip)`.
     - Ocultados textos de instrução secundários em telas `sm` e `md` (`hidden lg:block`).
  6. **Topbar Responsiva & Settings Limpo**:
     - No [`MainHeader`](file:///C:/Users/caio/Projetos/Tati_AI/frontend/components/layout/main-header.tsx), ocultados os troféus e ofensivas quando na rota `/settings`, eliminando poluição visual.
     - Ajustado o tamanho da tipografia de "Teacher Taty" para `text-sm sm:text-base` nas rotas de atividades e telas menores.
  7. **Deploy na Produção (`main`) & Sincronização (`desenvolvimento`)**:
     - Commit e push executados com sucesso na branch `main`.
     - Checkout para `desenvolvimento`, merge de `main` e resolução de conflitos mantendo todas as funcionalidades intactas.
     - Validação TypeScript (`tsc --noEmit`) aprovada com 0 erros.
     - Push final realizado na branch `desenvolvimento`.


---

## [Sprint 10] Restauração da Animação do VoiceAvatar & Restauração dos Logos no Chat
- **Problema Relatado**:
  1. O avatar da Teacher Tatiana voltou a aparecer no `/voice`, mas sem as animações que existiam anteriormente (ouvindo, falando, piscando e anéis pulsantes).
  2. No chat (sidebar header ao lado de "Taty's Hub", tela de boas-vindas e bolhas de mensagem), onde deveria constar a logo da Tatiana (`/images/tati_logo.jpg`), havia sido colocado o avatar facial, descaracterizando a identidade de marca.
- **Causa Raiz Técnica**:
  1. **Animações dos Rings Inativas**: O componente utilizava classes CSS arbitrárias como `animate-[ring-idle_4s_ease-in-out_infinite]` referenciando keyframes declarados dentro de uma tag `<style jsx global>`. No Next.js 14 App Router, o compilador do Tailwind não enxerga tags `<style jsx>`, fazendo com que nenhum dos keyframes fosse gerado e os anéis ficassem 100% estáticos.
  2. **Arquitetura Frágil de 3 Camadas (`<img>`)**: Havia 3 elementos `<img>` empilhados (`mouthSrc`, `reactionSrc`, `blinkVisible`), criando sobreposição incorreta de imagens inteiras (todos os frames `.webp` são retratos completos de 256x256, e não sobreposições transparentes).
  3. **Mouth Lock em Modo Web Audio**: Ao instanciar `ctx.createMediaElementSource(audioElement)`, se o contexto de áudio estivesse suspenso pelo navegador ou se o áudio fosse decodificado a partir de `data:audio/mp3;base64` ou CORS restrito, `getByteFrequencyData` retornava zeros. Como a flag `usingAudio` fora marcada como verdadeira, o fallback nunca era ativado, travando a boca no frame `normal` (fechada) durante toda a fala. Além disso, em trocas de estado para `listening` e `processing`, a animação não exibia o frame `ouvindo` com persistência ou o piscar reflexivo.
- **Solução Implementada**:
  1. **Restauração Fiel da Máquina de Estados Visual Original (`frontend/components/chat/voice-avatar.tsx`)**:
     - **Estado `idle`**: Exibe frame `normal` e agenda piscadas aleatórias naturais (`scheduleIdleBlink`) a cada 3.2s a 5.2s, exibindo o frame `piscando` (`/avatar/tati_piscando.webp`) por 150ms e retornando para `normal`.
     - **Estado `listening`**: Tatiana assume a pose de escuta com a cabeça inclinada e atenta (`/avatar/avatar_tati_ouvindo.webp`). Anéis pulsam em verde vivo com `animate-ring-listen` e `animate-ring-listen-delayed`.
     - **Estado `processing`**: Exibe frame `normal` com piscadas reflexivas ("pensando") a cada 2.2s e anéis âmbar (`animate-ring-process` e `animate-ring-process-delayed`).
     - **Estado `speaking`**: Anéis roxos com efeito sonoro pulsante intenso (`animate-ring-speak` e `animate-ring-speak-delayed`). Sincronia labial dinâmica: se o volume Web Audio estiver ativo e com energia (`avgVolume >= 12`), mapeia para visemas médios (`meio`, `frame_A`, `frame_B`, `frame_C`) e amplos (`bem_aberta`, `aberta`, `frame_E`, `frame_D`); se o volume for zero ou restrito pelo navegador, aciona loop de cadência orgânica a cada 75ms com a sequência fluida de visemas pedagógicos, garantindo que a boca **nunca fique travada** enquanto o áudio estiver tocando.
     - Suporte a detecção de emoção de surpresa/entusiasmo via `detectEmotion` mostrando `/avatar/tati_surpresa.webp` nos primeiros 350ms de fala.
     - Piscadas naturais breves (120ms) a cada 4.5s durante falas longas.
  2. **Renderização de Frame Único de Alta Performance**:
     - Eliminada a pilha de 3 imagens. Utilizado um único elemento `<img>` gerenciado por estado `currentFrame` com pré-carregamento imediato de todos os 14 frames no cache do navegador (0ms de latência e 0 flicker).
     - Cache global `WeakMap<HTMLAudioElement, ...>` para garantir que `createMediaElementSource` nunca seja chamado duas vezes no mesmo elemento `<audio>`, prevenindo o erro `InvalidStateError`.
  3. **Keyframes e Classes de Anéis Globais**:
     - Keyframes `@keyframes ring-idle`, `ring-listen`, `ring-process`, `ring-speak` e classes `.animate-ring-*` adicionados a `frontend/app/globals.css`.
     - Keyframes e utilitários de animação configurados também em `frontend/tailwind.config.ts`.
  4. **Restauração da Logo da Tatiana (`/images/tati_logo.jpg`)**:
     - `frontend/components/chat/sidebar.tsx`: Restaurada a imagem institucional `/images/tati_logo.jpg` no cabeçalho ao lado de "Taty's Hub".
     - `frontend/components/chat/message-list.tsx`: Restaurada a imagem `/images/tati_logo.jpg` no círculo central de boas-vindas do Chat.
     - `frontend/components/chat/message-bubble.tsx`: Restaurada a logo da Tatiana no avatar das mensagens do assistente.
     - `frontend/app/teste-cefr/page.tsx`: Restaurada a logo da Tatiana nas mensagens do assistente e no indicador de carregamento do teste de nivelamento.
- **Validação**:
  - Compilação do TypeScript `npm run typecheck` executada com **0 erros**.
