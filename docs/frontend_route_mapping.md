# Mapeamento de Rotas, Layouts e Providers - Frontend

## 1. Providers Globais (AppProviders)
Todos os componentes abaixo são carregados no `RootLayout` e envolvem toda a aplicação:

- **ThemeProvider**: Gerencia o tema (claro/escuro).
- **QueryProvider**: Configura o React Query Client.
- **AuthProvider**: Gerencia o estado de autenticação e tokens.
- **NotificationProvider**: Gerencia notificações push e in-app.
- **Toaster**: Componente de feedback visual de toasts (react-hot-toast).
- **RegisterServiceWorker**: Registra o SW para PWA (apenas cliente).
- **CapacitorHandler**: Lida com eventos nativos do Capacitor (apenas cliente).

## 2. Estrutura de Layouts

### Root Layout (`app/layout.tsx`)
- Envolve todas as rotas.
- Carrega as fontes (Sora, DM Sans).
- Renderiza o `AppProviders`.

### Authenticated Layout (`app/(authenticated)/layout.tsx`)
- Envolve todas as rotas dentro do grupo `(authenticated)`.
- **Layouts**: `AuthGuard` (proteção de rota).
- **Componentes**: `TourLauncher` (apresentação guiada, apenas cliente).

### Public Layout (`app/(public)/layout.tsx`)
- Envolve todas as rotas dentro do grupo `(public)`.
- **Layouts**: `PublicGuard` (redireciona se já estiver logado).

## 3. Mapeamento de Rotas

| Rota | Layouts Envolvidos | Providers/Guards |
| :--- | :--- | :--- |
| `/login` | Root -> Public | Global + PublicGuard |
| `/dashboard` | Root -> Authenticated | Global + AuthGuard |
| `/chat` | Root -> Authenticated | Global + AuthGuard |
| `/activities` | Root -> Authenticated | Global + AuthGuard |
| `/activities/hub` | Root -> Authenticated | Global + AuthGuard |
| `/activities/hub/[id]/ler`| Root -> Authenticated | Global + AuthGuard |
| `/activities/hub/meus-materiais`| Root -> Authenticated | Global + AuthGuard |
| `/activities/hub/pedidos` | Root -> Authenticated | Global + AuthGuard |
| `/achievements` | Root -> Authenticated | Global + AuthGuard |
| `/competitions` | Root -> Authenticated | Global + AuthGuard |
| `/flashcards/[id]` | Root -> Authenticated | Global + AuthGuard |
| `/goals` | Root -> Authenticated | Global + AuthGuard |
| `/install` | Root -> Authenticated | Global + AuthGuard |
| `/payment` | Root -> Authenticated | Global + AuthGuard |
| `/podcasts` | Root -> Authenticated | Global + AuthGuard |
| `/podcasts/[id]` | Root -> Authenticated | Global + AuthGuard |
| `/profile` | Root -> Authenticated | Global + AuthGuard |
| `/progress` | Root -> Authenticated | Global + AuthGuard |
| `/quiz/[id]` | Root -> Authenticated | Global + AuthGuard |
| `/receipt` | Root -> Authenticated | Global + AuthGuard |
| `/settings` | Root -> Authenticated | Global + AuthGuard |
| `/vocab` | Root -> Authenticated | Global + AuthGuard |
| `/vocab/review` | Root -> Authenticated | Global + AuthGuard |
| `/voice` | Root -> Authenticated | Global + AuthGuard |
| `/voice-only` | Root -> Authenticated | Global + AuthGuard |
| `/hub` | Root | Global |

---
**Observação**: Rotas autenticadas frequentemente usam `PrefetchHydration` internamente em suas páginas para injetar dados do servidor no React Query.
