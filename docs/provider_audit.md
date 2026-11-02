# Auditoria de Estado Global, Plugins e Ciclo de Vida (Vue 3)

Este documento descreve a arquitetura real de inicializacao, plugins globais, stores **Pinia** e rotinas em segundo plano nas aplicacoes [`../frontend/`](../frontend/) e [`../apps/hub-site/`](../apps/hub-site/).

---

## 1. Plugins Globais (`main.ts`)

Ambas as aplicacoes inicializam uma arvore enxuta de plugins Vue 3, sem wrappers de Context API desnecessarios:

### 1.1. `frontend/src/main.ts`
1. **`createPinia()`**: gerenciador central de stores reativas (`auth`, `theme`, `notifications`).
2. **`VueQueryPlugin`** (`@tanstack/vue-query`):
   - `staleTime`: `60_000` ms (1 minuto).
   - `retry`: `1`.
   - `refetchOnWindowFocus`: `false` (evita rajadas de requisicoes ao alternar abas).
3. **`router`** (`frontend/src/router/index.ts`): Vue Router 4 com guards de autenticacao, papel docente e deteccao de APK/PWA.

### 1.2. `apps/hub-site/src/main.ts`
1. **`configureApiClient({ apiUrl: resolveApiUrl() })`**: configura a URL base do SDK `@tati/hub-core` antes da montagem da aplicacao.
2. **`createPinia()`**: instancia Pinia para `useAuthStore` do Hub.
3. **`VueQueryPlugin`**:
   - `staleTime`: `30_000` ms (30 segundos).
   - `retry`: `1`.
   - `refetchOnWindowFocus`: `false`.
4. **`router`** (`apps/hub-site/src/router/index.ts`).

---

## 2. Arquitetura de Stores Pinia

| Aplicacao | Store | Arquivo | Responsabilidade e Persistencia |
| :--- | :--- | :--- | :--- |
| `frontend` | `useAuthStore` | `frontend/src/stores/auth.ts` | Mantem `token`, `refreshToken` e `user`; computa `isAuthenticated` e `isTeacher`; sincroniza com `localStorage` e expoe `init()`, `setSession()`, `fetchMe()` e `logout()`. |
| `frontend` | `useThemeStore` | `frontend/src/stores/theme.ts` | Inicializa e alterna o modo claro/escuro (`localStorage` + classe `.dark` em `<html>`). |
| `frontend` | `useNotificationStore` | `frontend/src/stores/notifications.ts` | Armazena notificacoes do usuario, calcula `unreadCount` e centraliza chamadas a `/api/v1/notifications`. |
| `hub-site` | `useAuthStore` | `apps/hub-site/src/stores/auth.ts` | Hidrata sessao via `@tati/hub-core` (`getStoredSession`, combinando `localStorage` e cookie cross-subdomain em `auth-cookie.ts`), expoe login, registro e logout. |

---

## 3. Efeitos Globais e Ciclo de Vida Raiz (`App.vue`)

### 3.1. `frontend/src/App.vue`
O componente raiz renderiza apenas `<router-view />` no template e coordena cinco servicos transversais de sessao:

1. **Presenca Online (`usePresence()` — `frontend/src/composables/usePresence.ts`)**:
   - Dispara `POST /api/v1/auth/heartbeat` a cada `30 segundos` somente quando `authStore.isAuthenticated` e verdadeiro e `document.visibilityState === 'visible'`.
   - Escuta eventos passivos de `focus`, `click`, `keydown` e `visibilitychange` com debounce de tempo (`lastPing`) para atualizar o status online do aluno no painel da professora sem sobrecarregar a API em abas ocultas.
2. **Polling de Notificacoes In-App**:
   - Quando autenticado, consulta `notifStore.fetchNotifications()` na entrada e a cada `25 segundos`, respeitando estritamente `document.visibilityState === 'visible'`.
   - O timer e limpo automaticamente no `logout` (via `watch(() => authStore.isAuthenticated)`) e no `onUnmounted`.
3. **Service Worker e WebPush (`pushNotifications.ts`)**:
   - Registra `/sw.js` na montagem e agenda `subscribeToPush()` `5 segundos` apos autenticacao confirmada, evitando disputar rede e CPU com o carregamento inicial da rota.
4. **Listener de Retorno OAuth (`window.addEventListener('message', handleGoogleMessage)`)**:
   - Recebe `GOOGLE_AUTH_SUCCESS` vindo de popups/fluxos OAuth, salva a sessao e redireciona para o Hub (`VITE_HUB_SITE_URL`) ou `/chat`.
5. **Ponte com Flutter `InAppWebView` (`flutterInAppWebViewPlatformReady`)**:
   - Marca `localStorage.setItem('is_apk', '1')` e redireciona `/` para `/chat` ou `/login`.

### 3.2. `apps/hub-site/src/App.vue`
- Chama `authStore.initAuth()` em `onMounted`.
- Envolve `<router-view />` com `HubLayoutWrapper.vue` e monta globalmente o `LgpdConsentModal.vue` para conformidade de privacidade no primeiro acesso ao catalogo.

---

## 4. Isolamento de Conexoes Pesadas (WebSocket e Midia)

Um ponto arquitetural positivo confirmado na auditoria:
- **O WebSocket de IA (`TatiWebSocket` / `useVoiceSocket.ts`) NAO e instanciado globalmente no `App.vue`**.
- Ele e aberto exclusivamente nas views que exigem streaming conversacional (`VoiceView.vue`, `VoiceOnlyView.vue` e interacoes em tempo real do chat) e encerrado no `onUnmounted` da respectiva pagina.
- Da mesma forma, a captura de microfone (`useAudioRecorder.ts`) solicita permissao de hardware (`navigator.mediaDevices.getUserMedia`) somente quando o aluno inicia uma gravacao de voz ou teste de pronuncia, liberando as tracks de midia imediatamente ao parar.
