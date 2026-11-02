# Auditoria de Navegacao (Vue Router 4)

Este documento registra como a navegacao cliente-servidor e realizada nas aplicacoes [`../frontend/`](../frontend/) e [`../apps/hub-site/`](../apps/hub-site/), distinguindo links declarativos (`<router-link>`), navegacao programatica (`router.push` / `router.replace`) e redirecionamentos entre origens (`window.location`).

---

## 1. Visao Geral dos Padroes Utilizados

Diferentemente de arquiteturas SSR, em uma SPA **Vue 3 + Vue Router 4** com `createWebHistory()`:
- **`<router-link>`** renderiza tags semanticas `<a>` nativas (permitindo abrir em nova aba, acessibilidade por teclado, foco nativo e classes ativas automaticas).
- **`router.push()` / `router.replace()`** executam transicoes de rota imperativas sem recarregar o documento HTML, adequadas apos submissao de formularios, callbacks de autenticacao, sincronizacao de query params (`?conv_id=`, `?tab=`) ou cliques em cards compostos.
- **`window.location.href` / `window.location.replace()`** sao reservados exclusivamente para mudanca de dominio/porta (ex.: transicao entre `frontend` na porta `3000` e `apps/hub-site` na porta `3001`, inicio do fluxo OAuth no backend ou abertura de recursos externos).

---

## 2. Navegacao Declarativa (`<router-link>`)

Todos os menus estruturais e cabecalhos principais ja utilizam `<router-link>`:

### 2.1. Em `frontend/src/`
- **Layouts e Menus Globais**:
  - `components/layout/MainHeader.vue`: links superiores de navegacao autenticada e acesso ao perfil.
  - `components/layout/Sidebar.vue` e `components/layout/SidebarActivities.vue`: navegacao lateral entre Atividades, Exames, Historico, Hub, Progresso, Metas, Conquistas, Competicoes e retorno ao Chat.
  - `components/chat/Sidebar.vue` e `components/chat/ChatTopbar.vue`: atalhos para atividades, voz, configuracoes e painel docente.
  - `components/dashboard/DashboardSidebar.vue`: links de retorno ao aplicativo a partir do painel da professora.
  - `components/catalog/HubHeader.vue` e `components/catalog/HubSidebar.vue`: navegacao interna do Hub embutido (`/activities/hub`, `/meus-materiais`, `/pedidos`).
- **Views**:
  - `views/public/LandingView.vue` e `views/public/CefrTestView.vue`: CTAs publicos para `/login`, `/cefr-test` e `/privacidade`.
  - `views/activities/ActivitiesView.vue`, `views/exams/ExamsDashboardView.vue`, `views/progress/ProgressView.vue`, `views/payment/PaymentView.vue`, `views/payment/ReceiptView.vue` e `views/hub/*`: links contextuais entre telas relacionadas.

### 2.2. Em `apps/hub-site/src/`
- `components/HubHeader.vue` e `components/Sidebar.vue`: menu principal entre Galeria (`/materiais`), Meus Materiais (`/meus-materiais`), Pedidos (`/pedidos`) e Login (`/login`).
- `components/catalog/ProductCard.vue` e `components/CheckoutFlow.vue`: links diretos para leitura (`/materiais/:id/ler`) apos liberacao de compra.
- `views/CatalogView.vue`, `views/MyMaterialsView.vue`, `views/OrdersView.vue`, `views/ReadMaterialView.vue` e `views/LoginView.vue`.

---

## 3. Navegacao Programatica (`router.push` e `router.replace`)

Os usos imperativos auditados no codigo dividem-se em quatro categorias legitimas e pontos de atencao:

### 3.1. Autenticacao, Logout e Guards de Papel
- `frontend/src/App.vue`: redireciona para `/chat` ou `/login` ao detectar container APK/PWA (`handleFlutterReady`, `isApkOrStandalone`) ou mensagem `GOOGLE_AUTH_SUCCESS`.
- `frontend/src/views/auth/LoginView.vue` e `views/auth/ResetPasswordView.vue`: `router.push('/chat')` / `router.replace('/chat')` apos login, cadastro ou captura de token OAuth.
- `frontend/src/components/layout/AuthenticatedLayout.vue`, `components/layout/Sidebar.vue`, `components/chat/Sidebar.vue` e `views/profile/ProfileView.vue`: redirecionamento imediato para `/login` apos logout ou sessao ausente.
- `frontend/src/views/dashboard/DashboardView.vue`: `router.replace('/chat')` caso um usuario sem permissao docente tente montar o componente.
- `apps/hub-site/src/views/LoginView.vue` e `ReadMaterialView.vue`: redirecionamento pos-login para `/materiais` e tratamento de falta de permissao no leitor.

### 3.2. Sincronizacao de Estado na Query String (Sem Recarregamento)
- `frontend/src/views/chat/ChatView.vue`: atualiza `?conv_id=<uuid>` com `router.push` / `router.replace` ao selecionar ou criar uma conversa e ao alternar a conversa ativa para o modo de voz (`/voice?conv_id=...`).
- `frontend/src/views/voice/VoiceView.vue` e `VoiceOnlyView.vue`: mantem `?conv_id=` e `?simulation_id=` sincronizados na URL durante sessoes de fala.
- `frontend/src/views/dashboard/DashboardView.vue`: sincroniza a secao ativa do painel da professora em `?tab=<section>`.
- `apps/hub-site/src/views/CatalogView.vue`: limpa parametros temporarios de query em `/materiais` via `router.replace`.

### 3.3. Acao Pos-Fluxo ou Selecao Dinamica de Item
- `ActivitiesView.vue` e `ActivityViewerModal.vue`: abrem dinamicamente `/flashcards/${item.id}`, `/voice?simulation_id=${item.id}` ou `/listenings/${item.id}` conforme o tipo da atividade clicada.
- `CheckoutFlow.vue` e `ProductCard.vue` (`frontend`): encaminham para `/activities/hub/${id}/ler` apos verificacao/compra.
- `ExamsDashboardView.vue`: inicia exame (`/exams/doing`) ou modo revisao (`/exams/doing?review_id=...`).
- `PaymentView.vue`: avanca para `/receipt?plan=...` apos confirmacao.

### 3.4. Botoes Estáticos `@click="router.push(...)"` (Oportunidade de Melhoria Semantica)
Algumas views utilizam `<Button @click="router.push('...')">` para botoes simples de "Voltar":
- `FlashcardsPlayerView.vue` (`router.push('/activities')`)
- `ExamsDoingView.vue` (`router.push('/exams')`)
- `ListeningDetailView.vue` (`router.push('/listenings')`)
- `VocabReviewView.vue` e `VocabView.vue` (`router.push('/vocab')` / `router.push('/vocab/review')`)
- `PrivacyView.vue` (`router.push('/')`) e `NotFoundView.vue` (`router.push('/chat')`)

Embora funcionalmente corretos na SPA, caso o componente `Button.vue` passe a aceitar uma prop opcional `to` (renderizando `<router-link>` internamente), esses botoes ganharao semantica nativa de link (`href`, clique com botao do meio e melhor indexacao/acessibilidade).

---

## 4. Redirecionamentos Cross-Origin (`window.location`)

Verificados e necessarios por cruzarem fronteiras de aplicacao ou provedor externo:
1. **Ponte `frontend` -> `apps/hub-site`**: em `frontend/src/App.vue` e `frontend/src/views/auth/LoginView.vue`, quando `?access=hub` ou `user.is_hub_only` e verdadeiro, utiliza `window.location.href = import.meta.env.VITE_HUB_SITE_URL || 'http://localhost:3001/materiais'`.
2. **Inicio de Google OAuth no Backend**: em `LoginView.vue`, redireciona o navegador para `/api/v1/auth/google/login` no servidor Django.
3. **Materiais Externos no Leitor**: em `frontend/src/views/hub/ProtectedReaderView.vue` e `apps/hub-site/src/views/ReadMaterialView.vue`, utiliza `window.location.replace(data.url)` apenas quando o backend indica que o recurso e um link externo direto em vez de paginas WebP internas.
