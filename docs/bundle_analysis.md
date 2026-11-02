# Analise de Bundle (Vite 6 + Vue 3)

Este relatorio apresenta as metricas reais de compilacao de producao (`vue-tsc --noEmit && vite build` com **Vite v6.4.4**) das duas aplicacoes web do monorepo: [`../frontend/`](../frontend/) e [`../apps/hub-site/`](../apps/hub-site/).

---

## 1. Resumo Executivo

| Aplicacao | Modulos Transformados | Chunk JS Inicial (Entry) | CSS Global | Code-Splitting de Rotas | Sourcemaps em Producao |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`frontend`** | 1.825 modulos | `177.62 kB` (`65.01 kB` gzip) | `80.07 kB` (`14.25 kB` gzip) | Ativo (imports dinamicos por rota) | Desativado (`sourcemap: false`) |
| **`@tati/hub-site`** | 1.669 modulos | `218.50 kB` (`73.57 kB` gzip) | `24.59 kB` (`5.98 kB` gzip) | Inativo (bundle unico; imports estaticos) | Ativo (`1,269.65 kB` `.map`) |

Ambas as aplicacoes compilam sem erros de tipagem estatica (`vue-tsc --noEmit`) e mantem um payload inicial comprimido (gzip) abaixo de `80 kB` de JavaScript, graças a ausencia de bibliotecas pesadas de UI legadas e ao tree-shaking nativo do Rollup/Vite.

---

## 2. Detalhamento da Aplicacao Principal (`frontend/`)

Configuracao de build: [`../frontend/vite.config.ts`](../frontend/vite.config.ts).

### 2.1. Chunks Principais Gerados

| Artefato (em `frontend/dist/assets/`) | Tamanho Bruto | Tamanho Gzip | Composicao Principal |
| :--- | :--- | :--- | :--- |
| `DashboardView-*.js` | `270.25 kB` | `61.80 kB` | Painel administrativo completo da professora (`DashboardView.vue` + secoes de alunos, CEFR, flashcards, simulacoes, Hub, feedbacks, graficos e WhatsApp). Carregado apenas por docentes em `/dashboard`. |
| `index-*.js` (Entry Chunk) | `177.62 kB` | `65.01 kB` | Runtime Vue 3.5, Vue Router 4, Pinia 2.3, TanStack Vue Query 5, stores globais, `App.vue` e cliente HTTP base. |
| `index-*.css` | `80.07 kB` | `14.25 kB` | Utilitarios Tailwind CSS 3.4 purgados + variaveis de tema em `globals.css`. |
| `PronunciationView-*.js` | `56.05 kB` | `17.11 kB` | Laboratorio fonetico (`/pronunciation`), feedback por palavra e historico de gravacoes. |
| `ChatView-*.js` | `48.13 kB` | `14.50 kB` | Interface de chat IA, bolhas interativas, `LevelingModal` e parser Markdown (`marked`). |
| `VoiceView-*.js` | `38.01 kB` | `11.95 kB` | Sala de conversacao por voz e roleplay CEFR (`/voice`), complementado por `useVoiceSocket-*.js` (`11.55 kB` / `3.63 kB` gzip). |
| `ProfileView-*.js` | `30.99 kB` | `9.18 kB` | Gestao de perfil, avatar, sotaque e preferencias (`/profile`). |
| `ActivitiesView-*.js` | `28.31 kB` | `8.50 kB` | Central de atividades, filtros CEFR e modal de worksheets (`/activities`). |
| `FlashcardsPlayerView-*.js` | `21.87 kB` | `7.20 kB` | Player SRS e revisao semanal (`/flashcards/:deckId`). |
| `ExamsDoingView-*.js` | `21.37 kB` | `6.87 kB` | Execucao e revisao de exames trimestrais (`/exams/doing`). |
| `LandingView-*.js` | `20.50 kB` | `6.04 kB` | Pagina institucional publica (`/`). |
| `ProgressView-*.js` | `18.41 kB` | `5.61 kB` | Painel de evolucao, ofensiva e XP (`/progress`). |
| `ProductCard-*.js` | `16.09 kB` | `5.51 kB` | Card de material e abertura de checkout do Hub interno. |
| `LoginView-*.js` | `14.99 kB` | `4.97 kB` | Tela de autenticacao e cadastro (`/login`). |
| `SettingsView-*.js` | `14.67 kB` | `4.64 kB` | Configuracoes da conta (`/settings`). |
| `CefrTestView-*.js` | `13.43 kB` | `4.62 kB` | Teste diagnostico CEFR publico (`/cefr-test`). |
| `ExamsDashboardView-*.js` | `12.65 kB` | `4.49 kB` | Visao geral de exames trimestrais (`/exams`). |
| `CompetitionsView-*.js` | `11.94 kB` | `3.86 kB` | Ranking competitivo de XP (`/competitions`). |

### 2.2. Comportamento dos Icones (`lucide-vue-next`)
O Rollup divide automaticamente os icones compartilhados de `lucide-vue-next` entre multiplas rotas assincronas em cerca de 75 micro-chunks individuais (`0.31 kB` a `1.76 kB` cada, ex.: `check-*.js`, `mic-*.js`, `book-open-*.js`). Isso garante que apenas os icones efetivamente usados na rota visitada sejam transferidos via HTTP/2, sem incluir o pacote inteiro de icones no bundle inicial.

---

## 3. Detalhamento do Portal Hub (`apps/hub-site/`)

Configuracao de build: [`../apps/hub-site/vite.config.ts`](../apps/hub-site/vite.config.ts).

| Artefato (em `apps/hub-site/dist/assets/`) | Tamanho Bruto | Tamanho Gzip | Observacao |
| :--- | :--- | :--- | :--- |
| `index-*.js` | `218.50 kB` | `73.57 kB` | Contem Vue 3, Router, Pinia, Vue Query, `@tati/hub-core` e todas as 5 views (`CatalogView`, `ReadMaterialView`, `MyMaterialsView`, `OrdersView`, `LoginView`). |
| `index-*.js.map` | `1,269.65 kB` | — | Gerado porque `build.sourcemap: true` esta habilitado em `apps/hub-site/vite.config.ts`. |
| `index-*.css` | `24.59 kB` | `5.98 kB` | Estilos Tailwind CSS exclusivos do portal Hub. |

---

## 4. Oportunidades Tecnicas de Otimizacao Identificadas

1. **Fragmentacao interna do `DashboardView` (`270.25 kB`) no `frontend/`**:
   - Embora `DashboardView.vue` ja nao afete os alunos (pois so e baixado quando um docente acessa `/dashboard`), suas sub-abas (`CefrSection.vue`, `FlashcardsSection.vue`, `PremiumSection.vue`, `ReportsSection.vue`, `WhatsappSection.vue`, etc.) sao importadas estaticamente dentro de `DashboardView.vue`. O uso de `defineAsyncComponent` por aba reduziria o carregamento inicial do painel docente pela metade.
2. **Code-splitting de rotas no `apps/hub-site/`**:
   - Em [`../apps/hub-site/src/router/index.ts`](../apps/hub-site/src/router/index.ts), as views `CatalogView`, `ReadMaterialView`, `MyMaterialsView`, `OrdersView` e `LoginView` sao importadas no topo do arquivo. Converter `ReadMaterialView` (`SecureDocumentViewer`), `OrdersView` e `LoginView` para `() => import(...)` reduzira o bundle inicial da vitrine `/materiais`.
3. **Agrupamento de micro-chunks de icones (`experimentalMinChunkSize` / `manualChunks`)**:
   - Caso se deseje reduzir o numero de requisicoes paralelas de micro-arquivos de `0.3 kB` do `lucide-vue-next` em conexoes moveis de alta latencia, pode-se configurar `build.rollupOptions.output.manualChunks` para agrupar `vue`, `vue-router`, `pinia` e `@tanstack/vue-query` em um chunk `vendor` estavel e consolidar icones muito pequenos.
4. **Revisao de `sourcemap: true` em producao no `apps/hub-site/`**:
   - `apps/hub-site/vite.config.ts` publica o arquivo `.map` de `1.27 MB`. Em producao comercial, alterar para `sourcemap: false` (alinhando com `frontend/vite.config.ts`) reduz o artefato de deploy e evita expor o codigo-fonte original no navegador.
