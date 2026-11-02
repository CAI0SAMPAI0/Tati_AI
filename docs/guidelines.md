# Diretrizes e Padroes de Codigo

Este guia descreve as convencoes de engenharia, nomenclatura, organizacao arquitetural, qualidade e seguranca efetivamente adotadas no repositorio **Tati AI**.

---

## 1. Principios Gerais do Monorepo

- **Fonte unica de verdade**: o comportamento real do sistema e definido pelos contratos Pydantic/Django Ninja no backend (`backend/apps/*/schemas.py`) e pelas interfaces TypeScript compartilhadas (`packages/hub-core/src/types.ts` e `frontend/src/api/types.ts`).
- **Isolamento de responsabilidades**:
  - `backend/` concentra regras de negocio, autenticacao, integracao com LLMs, persistencia, marca d'agua de documentos e cobranca.
  - `frontend/` atende a jornada pedagogica de alunos e o painel administrativo da professora.
  - `apps/hub-site/` (`@tati/hub-site`) isola a vitrine comercial, checkout avulso e leitura protegida do Hub de Materiais.
  - `packages/hub-core/` (`@tati/hub-core`) centraliza tipos, cliente HTTP, sessao e cookies compartilhados entre subdominios.
- **Preservacao do esquema de producao**: a maioria das tabelas PostgreSQL utiliza `managed = False` nos modelos Django. Qualquer alteracao estrutural no banco exige verificacao explicita de compatibilidade antes de criar migrations ou alterar colunas.

---

## 2. Convencoes de Nomenclatura

| Contexto | Padrao Adotado | Exemplos Reais no Repositorio |
| :--- | :--- | :--- |
| Modulos, pacotes e funcoes Python | `snake_case` | `audio_service.py`, `secure_document_service.py`, `verify_pronunciation` |
| Classes Python (Models, Services, Schemas) | `PascalCase` | `FlashcardService`, `PronunciationHistory`, `CheckoutInput` |
| Componentes e Views Vue 3 (`.vue`) | `PascalCase.vue` | `AuthenticatedLayout.vue`, `ChatView.vue`, `SecureDocumentViewer.vue` |
| Composables / Hooks Vue (`.ts`) | `useCamelCase.ts` | `useVoiceSocket.ts`, `useAudioRecorder.ts`, `usePaymentWebSocket.ts` |
| Stores Pinia e utilitarios TypeScript (`.ts`) | `camelCase.ts` (ou `kebab-case.ts` em `hub-core`) | `notifications.ts`, `activityCache.ts`, `indexedDB.ts`, `auth-cookie.ts` |
| Variaveis de ambiente do Backend | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET_KEY`, `MERCADOPAGO_ACCESS_TOKEN` |
| Variaveis de ambiente do Frontend (Vite) | Prefixo obrigatorio `VITE_` | `VITE_API_URL`, `VITE_WS_URL`, `VITE_HUB_SITE_URL` |

---

## 3. Padroes de Desenvolvimento Backend (Django 5 + Django Ninja)

### 3.1. Separacao em Camadas por App (`backend/apps/<dominio>/`)
1. **`api.py` (Camada de Transporte HTTP)**:
   - Declara instancias de `ninja.Router`, validacao de entrada/saida, autenticacao (`auth=auth_required` ou `auth=auth_optional`) e verificacao de papel (`require_teacher(request.auth)`).
   - Evita conter logica complexa de banco ou chamadas diretas a provedores externos; delega para `services.py`.
2. **`schemas.py` (Contratos de Dados)**:
   - Define modelos `ninja.Schema` ou `pydantic.BaseModel` (Pydantic v2) para payloads de entrada (`*Input`, `*In`) e respostas (`*Out`, `*Response`).
3. **`services.py` (Regras de Negocio e Integracoes)**:
   - Encapsula calculo de XP, ofensiva (`StreakService`), geracao de conteudo CEFR, integracao com Mercado Pago, envio de notificacoes e consultas agregadas.
4. **`models.py` (Persistencia)**:
   - Mapeia tabelas do banco com `db_table` explicito. Em rotas `async def` (ou dentro de `ChatConsumer`), operacoes do Django ORM devem ser encapsuladas com `asgiref.sync.sync_to_async` (ou helpers em `shared/async_db.py`).
5. **`tasks.py` (Processamento Assincrono)**:
   - Tarefas `@shared_task` do Celery para operacoes demoradas (conversao de PDF/DOCX com LibreOffice, geracao em lote com IA, envio de e-mails e alertas agendados).

### 3.2. Prompts de IA
- Nunca embutir prompts extensos diretamente em strings Python quando fizerem parte do fluxo pedagogico recorrente.
- Armazene o template em [`../backend/ai/prompts/`](../backend/ai/prompts/) em formato Markdown e carregue-o via `PromptManager` ([`../backend/shared/prompt_manager.py`](../backend/shared/prompt_manager.py)).

### 3.3. Linting e Qualidade Python
A configuracao oficial de lint esta em [`../.flake8`](../.flake8) e no workflow [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml):
- Comprimento maximo de linha: `120` caracteres (`max-line-length = 120` no `.flake8`; verificacao critica de erros de sintaxe `E9,F63,F7,F82` bloqueante na CI).
- Execucao local:
  ```bash
  flake8 backend --count --select=E9,F63,F7,F82 --show-source --statistics
  flake8 backend --count --exit-zero --max-complexity=15 --max-line-length=127 --statistics
  ```

---

## 4. Padroes de Desenvolvimento Frontend (Vue 3 + Vite + TypeScript)

### 4.1. Componentes Vue (`<script setup lang="ts">`)
- Utilize sempre a **Composition API** com `<script setup lang="ts">`.
- Tipagem explicita em `defineProps<...>()` e `defineEmits<...>()` para manter compatibilidade com `vue-tsc --noEmit`.
- Componentes base reutilizaveis residem em `frontend/src/components/ui/` (`Button.vue`, `Input.vue`, `Select.vue`, `DialogModal.vue`, `ToastContainer.vue`).

### 4.2. Gerenciamento de Estado e Dados Remotos
- **Pinia (`stores/`)**: reservado exclusivamente para estado global transversal da sessao:
  - `useAuthStore`: token JWT, dados do usuario logado, renovacao e logout.
  - `useThemeStore`: tema visual (`dark` / `light`) sincronizado com `localStorage` e classe `.dark` no `<html>`.
  - `useNotificationStore`: lista de notificacoes, contagem de nao lidas e ciclo de atualizacao.
- **TanStack Vue Query (`@tanstack/vue-query`)**: utilizado para busca, cache em memoria, deduplicacao e invalidacao de dados do servidor (especialmente no catalogo e pedidos de `apps/hub-site` e listagens reativas).
- **Clientes HTTP centralizados**:
  - Em `frontend/`: utilize `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete` e `apiUpload` de [`../frontend/src/api/client.ts`](../frontend/src/api/client.ts), que ja injetam `Authorization: Bearer` e realizam retry automatico via `/auth/refresh` em respostas `401`.
  - Em `apps/hub-site/`: utilize os modulos de [`../packages/hub-core/src/`](../packages/hub-core/src/) (`@tati/hub-core`).

### 4.3. Estilizacao (Tailwind CSS + Tokens CSS)
- Utilize utilitarios do **Tailwind CSS 3.4** combinados com as variaveis semanticas definidas em [`../frontend/src/assets/styles/globals.css`](../frontend/src/assets/styles/globals.css) e [`../apps/hub-site/src/globals.css`](../apps/hub-site/src/globals.css) (`--background`, `--foreground`, `--primary`, `--card`, `--border`).
- Garanta contraste adequado tanto no modo claro quanto no modo escuro (`.dark`).

### 4.4. Verificacao de Tipos e Build
Antes de abrir um Pull Request com alteracoes em `frontend/`, `apps/hub-site/` ou `packages/hub-core/`, valide a tipagem estatica e o empacotamento:
```bash
npm run typecheck
npm run build --workspace frontend
npm run build --workspace @tati/hub-site
```

---

## 5. Diretrizes de Seguranca e Privacidade

1. **Segredos e Variaveis de Ambiente**:
   - Nunca versione arquivos `.env`, chaves de API (`GROQ_API_KEY`, `HF_TOKEN`, `GEMINI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `JWT_SECRET_KEY`, `VAPID_PRIVATE_KEY`) ou dumps de banco.
   - Qualquer variavel iniciada por `VITE_` e embutida publicamente no bundle JavaScript entregue ao navegador. Jamais exponha segredos do servidor com prefixo `VITE_`.
2. **Protecao contra SSRF e Hotlinking**:
   - Novos proxies de midia no backend devem seguir o padrao de `_is_safe_activity_image_url` em `backend/apps/activities/api.py`: whitelist estrita de dominios e bloqueio de IPs privados, loopback, link-local e endpoints de metadados de nuvem.
3. **Protecao de Propriedade Intelectual no Hub**:
   - Materiais pagos nunca devem ter URLs diretas do arquivo bruto expostas a usuarios nao autorizados; utilize o fluxo paginado `/api/v1/activities/hub/{content_id}/pages/{page_index}` com token de escopo `hub_read:{content_id}` e marca d'agua dinamica (`apply_watermark`).
4. **Dados Estudantis e LGPD**:
   - Nao registre senhas em texto puro, tokens JWT completos ou audios em Base64 nos logs estruturados.

---

## 6. Fluxo de Git e Integracao Continua

- A pipeline [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa em pushes e Pull Requests nas branches `main` e `develop`:
  1. **Job `backend-lint-test`**: Python 3.12, instalacao de `backend/requirements.txt`, Flake8, `manage.py check` e `manage.py test` com `app.settings.test`.
  2. **Job `frontend-build`**: Node.js 20, `npm ci`, verificacao estatica TypeScript (`vue-tsc --noEmit`) e `vite build`.
- Workflows adicionais:
  - [`../.github/workflows/deploy-hf.yml`](../.github/workflows/deploy-hf.yml): sincronizacao automatizada do backend para o Hugging Face Spaces em pushes na `main`.
  - [`../.github/workflows/tauri-desktop-build.yml`](../.github/workflows/tauri-desktop-build.yml): workflow preparatorio para empacotamento desktop multiplataforma (acionado manualmente via `workflow_dispatch` ou tags `desktop-v*`).
