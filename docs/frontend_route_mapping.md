# Mapeamento de Rotas e Layouts (Vue Router)

Este documento mapeia todas as rotas implementadas nas duas aplicacoes Vue 3 do monorepo ([`../frontend/src/router/index.ts`](../frontend/src/router/index.ts) e [`../apps/hub-site/src/router/index.ts`](../apps/hub-site/src/router/index.ts)), detalhando seus layouts, nivel de acesso e guards de navegacao.

---

## 1. Aplicacao Principal (`frontend/`)

O roteador principal utiliza `createWebHistory()` e carrega todas as views sob demanda (`() => import(...)`) para divisao automatica de chunks no Vite.

### 1.1. Rotas Publicas (Sem `AuthenticatedLayout`)

| Rota | Nome da Rota | Componente View | Acesso | Observacoes |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `landing` | `views/public/LandingView.vue` | Publico | Em modo APK/PWA standalone (`isApkOrStandalone()`), redireciona automaticamente para `/chat` ou `/login`. |
| `/cefr-test` | `cefr-test` | `views/public/CefrTestView.vue` | Publico | Avaliacao diagnostica gratuita de nivelamento CEFR (A1 a B2). |
| `/privacidade` | `privacy` | `views/public/PrivacyView.vue` | Publico | Politica de Privacidade e termos LGPD. |
| `/privacy` | `privacy-en` | Redirect -> `/privacidade` | Publico | Alias em ingles para compatibilidade de links externos e lojas de aplicativos. |
| `/login` | `login` | `views/auth/LoginView.vue` | Visitante (`guestOnly`) | Login, cadastro, Google OAuth e redirecionamento para `VITE_HUB_SITE_URL` quando `?access=hub`. |
| `/reset-password` | `reset-password` | `views/auth/ResetPasswordView.vue` | Visitante (`guestOnly`) | Redefinicao de senha via token enviado por e-mail. |

### 1.2. Rotas Autenticadas Full-Screen / Layouts Proprios

Estas rotas exigem autenticacao (`meta.requiresAuth: true`), mas renderizam sua propria estrutura visual de tela cheia em vez do `AuthenticatedLayout`:

| Rota | Nome da Rota | Componente View | Guard / Papel | Estrutura de Layout |
| :--- | :--- | :--- | :--- | :--- |
| `/chat` | `chat` | `views/chat/ChatView.vue` | Autenticado | Layout proprio com `components/chat/Sidebar.vue` (historico de conversas) e `ChatTopbar.vue`. |
| `/voice` | `voice` | `views/voice/VoiceView.vue` | Autenticado | Interface imersiva de conversacao por voz e roleplay CEFR (`?simulation_id=...&conv_id=...`). |
| `/voice-only` | `voice-only` | `views/voice/VoiceOnlyView.vue` | Autenticado | Modo focado exclusivamente no avatar vocal (`VoiceAvatar.vue`) sem transcricao em tela. |
| `/dashboard` | `dashboard` | `views/dashboard/DashboardView.vue` | Docente (`requiresTeacher`) | Painel da professora com `DashboardSidebar.vue` e navegacao interna por query `?tab=`. |
| `/activities/hub` | `hub-catalog` | `views/hub/HubCatalogView.vue` | Publico / Autenticado | Utiliza `HubShell.vue` (`HubHeader` + `HubSidebar`) dentro do app principal. |
| `/activities/hub/meus-materiais` | `hub-my-materials` | `views/hub/MyMaterialsView.vue` | Autenticado | Biblioteca de materiais adquiridos pelo aluno dentro do `HubShell.vue`. |
| `/activities/hub/pedidos` | `hub-orders` | `views/hub/OrdersView.vue` | Autenticado | Historico de compras do Hub dentro do `HubShell.vue`. |
| `/activities/hub/:id/ler` | `hub-reader` | `views/hub/ProtectedReaderView.vue` | Autenticado | Leitor protegido em tela cheia (`SecureDocumentViewer.vue`). |

### 1.3. Rotas Autenticadas sob `AuthenticatedLayout.vue`

Aninhadas sob `components/layout/AuthenticatedLayout.vue`, que fornece `MainHeader.vue`, barra lateral (`Sidebar.vue` / `SidebarActivities.vue`) e area de conteudo rolavel:

| Rota | Nome da Rota | Componente View | Finalidade Pedagogica |
| :--- | :--- | :--- | :--- |
| `/activities` | `activities` | `views/activities/ActivitiesView.vue` | Central de atividades (Gramatica, Vocabulario, Listening, Reading, Musica, Flashcards, Simulacoes, Jogos e Noticias). |
| `/pronunciation` | `pronunciation` | `views/pronunciation/PronunciationView.vue` | Laboratorio fonetico com avaliacao de acuracia/fluencia por palavra e historico de audios. |
| `/vocab` | `vocab` | `views/vocab/VocabView.vue` | Banco pessoal de vocabulario e expressoes estudadas. |
| `/vocab/review` | `vocab-review` | `views/vocab/VocabReviewView.vue` | Sessao pratica de revisao de vocabulario. |
| `/flashcards/:deckId` | `flashcards-player` | `views/flashcards/FlashcardsPlayerView.vue` | Player de repeticao espacada (SRS) e revisao de sexta-feira (`deckId=friday`). |
| `/listenings` | `listenings` | `views/listenings/ListeningsView.vue` | Catalogo de podcasts e exercicios auditivos por nivel CEFR. |
| `/listenings/:id` | `listening-detail` | `views/listenings/ListeningDetailView.vue` | Player de episodio com acompanhamento de transcricao. |
| `/exams` | `exams` | `views/exams/ExamsDashboardView.vue` | Painel de elegibilidade e historico dos exames trimestrais. |
| `/exams/doing` | `exams-doing` | `views/exams/ExamsDoingView.vue` | Execucao e revisao comentada (`?review_id=`) do exame trimestral. |
| `/progress` | `progress` | `views/progress/ProgressView.vue` | Metricas de estudo, XP acumulado, ofensiva e graficos de evolucao. |
| `/goals` | `goals` | `views/goals/GoalsView.vue` | Acompanhamento do Objetivo da Semana (8 categorias obrigatorias e multiplicador de XP). |
| `/history` | `history` | `views/history/HistoryView.vue` | Linha do tempo de submissoes e praticas concluidas. |
| `/achievements` | `achievements` | `views/achievements/AchievementsView.vue` | Galeria de trofeus e medalhas desbloqueadas. |
| `/competitions` | `competitions` | `views/competitions/CompetitionsView.vue` | Ranking competitivo mensal/geral de XP da turma. |
| `/profile` | `profile` | `views/profile/ProfileView.vue` | Edicao de dados pessoais, sotaque preferido, avatar e resumo da conta. |
| `/settings` | `settings` | `views/settings/SettingsView.vue` | Preferencias de notificacoes, tema, audio e conta. |
| `/shop` | `shop` | `views/shop/ShopView.vue` | Vitrine de planos e recursos premium. |
| `/payment` | `payment` | `views/payment/PaymentView.vue` | Fluxo de checkout de planos. |
| `/receipt` | `receipt` | `views/payment/ReceiptView.vue` | Comprovante pos-pagamento (`?plan=...`). |
| `/:pathMatch(.*)*` | `not-found` | `views/NotFoundView.vue` | Pagina 404 com retorno rapido ao `/chat`. |

> **Nota sobre arquivo nao roteado**: `frontend/src/views/exams/ExamsView.vue` permanece no diretorio `views/exams/`, mas a rota ativa `/exams` aponta para `ExamsDashboardView.vue`.

---

## 2. Guards Globais de Navegacao (`frontend/src/router/index.ts`)

O hook `router.beforeEach` executa quatro verificacoes em sequencia:

1. **Inicializacao da Store**: chama `authStore.init()` caso ainda nao hidratada.
2. **Captura de Retorno OAuth na Query String**: se a URL contiver `?token=...` (retorno de callback do Google OAuth), persiste a sessao via `authStore.setSession(...)` e substitui a URL para `/chat` sem recarregar a pagina.
3. **Modo Nativo APK / PWA Standalone (`isApkOrStandalone()`)**: detecta `localStorage.getItem('is_apk') === '1'`, query `?apk=1`, `window.flutter_inappwebview` ou `display-mode: standalone`. Quando ativo na rota `/`, redireciona imediatamente para `/chat` (autenticado) ou `/login` (visitante).
4. **Protecao de Autenticacao e Papel Docente**:
   - `to.meta.requiresAuth && !authStore.isAuthenticated` -> redireciona para `{ name: 'login', query: { redirect: to.fullPath } }`.
   - `to.meta.requiresTeacher && !authStore.isTeacher` -> redireciona alunos comuns para `{ name: 'chat' }`.
   - `to.meta.guestOnly && authStore.isAuthenticated` -> redireciona usuarios ja autenticados para `/chat` (exceto quando `?access=hub` estiver presente em `/login`).

---

## 3. Portal Hub de Materiais (`apps/hub-site/`)

Definido em [`../apps/hub-site/src/router/index.ts`](../apps/hub-site/src/router/index.ts), envolto globalmente por `HubLayoutWrapper.vue` (que alterna entre o shell com `HubHeader` + `Sidebar` e modo limpo para `/login` e leitor):

| Rota | Nome da Rota | Componente View | Acesso | Responsabilidade |
| :--- | :--- | :--- | :--- | :--- |
| `/` | — | Redirect -> `/materiais` | Publico | Redireciona a raiz do dominio para o catalogo. |
| `/materiais` | `catalog` | `views/CatalogView.vue` | Publico | Vitrine de materiais filtrados por categoria, busca textual e abertura do `CheckoutFlow.vue`. |
| `/materiais/:id/ler` | `read-material` | `views/ReadMaterialView.vue` | Autenticado / Comprador | Valida acesso ao material e renderiza `SecureDocumentViewer.vue` (ou redireciona para URL externa quando aplicavel). |
| `/meus-materiais` | `my-materials` | `views/MyMaterialsView.vue` | Autenticado | Lista materiais ja adquiridos ou liberados para o usuario logado. |
| `/pedidos` | `orders` | `views/OrdersView.vue` | Autenticado | Historico de cobrancas PIX/Cartao, retomada de QR Code pendente e cancelamento de pedido. |
| `/login` | `login` | `views/LoginView.vue` | Publico | Login/cadastro proprio do Hub e autenticacao Google OAuth integrada ao `@tati/hub-core`. |
| `/:pathMatch(.*)*` | — | Redirect -> `/materiais` | Publico | Fallback para qualquer rota inexistente no portal do Hub. |
