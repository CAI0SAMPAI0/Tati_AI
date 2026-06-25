# PRD 2 – Tati AI: Frontend Rewrite (HTML + TypeScript + Tailwind CSS)

## 1. Visão Geral

### Contexto
O frontend atual do Tati AI é construído com Next.js 14 (App Router), React 18, TypeScript e TailwindCSS. Apesar de funcional, o framework adiciona complexidade de build, SSR overhead e curva de aprendizado que dificultam implementações rápidas e diretas. Este documento define a migração do frontend para uma abordagem **HTML vanilla + TypeScript + Tailwind CSS**, mantendo **idêntico** o design system atual, toda a responsividade e todas as integrações com o backend (REST API, WebSockets, webhooks).

### Problema que está sendo resolvido
Simplificar a arquitetura do frontend para acelerar implementações, reduzindo a complexidade de framework (Next.js) para HTML puro com TypeScript, sem perder qualidade visual, responsividade ou funcionalidades existentes.

### Escopo
Criar uma nova pasta `frontend_2/` na raiz do monorepo com toda a aplicação frontend reescrita em **HTML + TypeScript + Tailwind CSS**, espelhando 1:1 a interface e o comportamento do `frontend/` atual. O `frontend/` original não será modificado nem removido durante a construção.

---

## 2. Sobre a Migração

### Descrição
Reescrita completa do frontend do Tati AI, substituindo Next.jsApp Router e React por HTML estático或多页 (multi-page), TypeScript como linguagem de lógica e Tailwind CSS como framework de estilização. Toda a comunicação com o backend (FastAPI) permanece via REST e WebSockets.

### Princípios
- **Ponto de partida:** O design system, layout, cores, tipografia e animações do `frontend/` atual são a fonte de verdade. Zero mudanças visuais.
- **Simplicidade:** Não adicionar nada além do que já existe. Projeto enxuto, sem over-engineering.
- **Idioma:** Toda a interface do usuário (labels, botões, mensagens, tooltips, placeholders, headings, erros, notificações, modais) deve ser em **Inglês US**.
- **Profissionalismo:** Seguir padrões de arquitetura profissionais para projetos HTML+TS (separação de responsabilidades, módulos, naming conventions, clean code).
- **Responsividade:** Manter todos os breakpoints e comportamentos responsivos do frontend atual (mobile-first).

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Markup | HTML5 | Páginas estáticas或多页, sem frameworks de renderização |
| Lógica | TypeScript | Compilado via `tsc`, executado no browser como JS |
| Estilização | Tailwind CSS 3.x | Mesma config e tokens do `frontend/tailwind.config.ts` |
| Build/Dev | Vite | Bundler leve para TS+HTML+CSS, HMR rápido |
| Roteamento | Navegação multi-page | Cada página é um `.html` independente; transições via `<a>` ou `fetch` + `history.pushState` para SPA-like se necessário |
| Estado | Valentino store ou módulos TS simples | Estado global mínimo via store leve (sem React/Zustand) |
| HTTP | Fetch API nativo | Wrappers tipados em TS para endpoints do backend |
| WebSockets | WebSocket API nativa | Client TS tipado para chat e voz |
| Ícones | Lucide Icons (SVG) | Mesma lib de ícones do frontend atual, renderizada como SVG inline ou sprites |
| Fontes | Google Fonts (Sora, DM Sans) | Carregadas via `<link>`, sem `next/font` |
| Linting/Format | ESLint + Prettier | Configuração alinhada ao projeto |

---

## 4. Design System (Fonte de Verdade: `frontend/`)

> **Regra absoluta:** O design system deve ser **idêntico** ao do frontend atual. Nenhuma cor, espaçamento, borda, sombra, fonte ou animação deve ser alterada. O objetivo é que um usuário não consiga distinguir visualmente entre `frontend/` e `frontend_2/`.

### 4.1 Tokens CSS (copiar de `frontend/app/globals.css`)

```css
:root {
  --bg: hsl(250 30% 97%);
  --bg-secondary: hsl(250 25% 93%);
  --surface: hsl(0 0% 100%);
  --surface-hover: hsl(250 20% 96%);
  --card: hsl(0 0% 100%);

  --primary: hsl(258 80% 58%);
  --primary-hover: hsl(258 80% 50%);
  --primary-dim: hsla(258 80% 58% / 0.12);
  --primary-glow: hsla(258 80% 58% / 0.25);

  --border: hsla(258 30% 40% / 0.12);
  --border-focus: hsla(258 80% 58% / 0.55);

  --text: hsl(250 25% 12%);
  --text-muted: hsl(250 12% 44%);
  --text-subtle: hsl(250 10% 60%);

  --input-bg: hsl(0 0% 100%);
  --success: hsl(152 68% 42%);
  --warning: hsl(38 92% 55%);
  --danger: hsl(355 78% 60%);

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.08);
  --shadow-glow: 0 0 20px hsla(258, 80%, 58%, 0.12);

  --primary-soft: hsl(258 45% 95%);
  --cat-purple: #e8e0f4;
  --cat-green: #e3f0e8;
  --cat-orange: #fceee3;

  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;
  --radius-xl: 1.375rem;
  --radius-full: 9999px;

  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 350ms;
}

.dark, [data-theme='dark'] {
  --bg: hsl(250 28% 7%);
  --bg-secondary: hsl(250 25% 10%);
  --surface: hsl(250 22% 13%);
  --surface-hover: hsl(250 20% 16%);
  --card: hsl(250 22% 13%);
  --border: hsla(258 40% 55% / 0.18);
  --text: hsl(250 20% 94%);
  --text-muted: hsl(250 12% 58%);
  --text-subtle: hsl(250 10% 42%);
  --input-bg: hsl(250 25% 9%);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.45);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.55);
  --shadow-glow: 0 0 24px hsla(258, 80%, 58%, 0.18);
}
```

### 4.2 Tailwind Config (copiar de `frontend/tailwind.config.ts`)

Replicar fielmente:
- `colors` (primary, bg, surface, card, border, text, input, success, warning, danger, ink, muted, subtle, line, primarySoft, bgSecondary, catPurple, catGreen, catOrange)
- `fontFamily` (display → Sora, body → DM Sans, mono → JetBrains Mono)
- `fontSize` (xs, sm, base, lg, xl, 2xl, 3xl, 4xl com line-heights customizados)
- `spacing` (4.5, 5.5, 6.5, 7.5, 13, 15, 17, 18, 22)
- `borderRadius` (sm, md, lg, xl, full, hub: 12px)
- `boxShadow` (sm, md, lg, glow, card)
- `transitionTimingFunction` (ease, spring)
- `transitionDuration` (fast, base, slow)
- `keyframes` e `animation` (fadeIn, slideUp, shimmer)

### 4.3 Component Classes (copiar de `globals.css`)

Replicar as `@layer components` e `@layer utilities`:
- `.hub-theme` e variáveis de hub
- `.card-surface`, `.chip`, `.chip-active`, `.chip-inactive`, `.section-title`, `.input-hub`, `.btn-primary`
- `.scrollbar-none`, `.custom-scrollbar`
- `.animate-fade-in`

### 4.4 Base Styles

- `html { font-size: 16px; scroll-behavior: smooth; }`
- `body { font-family: var(--font-body); font-size: 0.9375rem; line-height: 1.6; min-height: 100vh; }`
- Headings: `font-family: var(--font-display); font-weight: 700; line-height: 1.2;`
- Scrollbar custom (6px, rounded, bg-border)

---

## 5. Arquitetura de Diretórios

```
frontend_2/
├── index.html                  # Landing / Login
├── pages/
│   ├── dashboard.html          # Dashboard do aluno
│   ├── chat.html               # Chat com IA
│   ├── activities.html         # Atividades / Quizzes
│   ├── flashcards.html         # Flashcards / SRS
│   ├── vocabulary.html         # Vocabulário
│   ├── podcasts.html           # Podcasts
│   ├── simulations.html        # Simulações de conversa
│   ├── progress.html           # Progresso / Metas
│   ├── cefr.html               # Avaliação CEFR
│   ├── hub/
│   │   ├── catalog.html        # Catálogo do hub
│   │   ├── checkout.html       # Checkout
│   │   └── my-materials.html   # Meus materiais
│   ├── admin/
│   │   ├── dashboard.html      # Painel admin/professora
│   │   ├── dispatch.html       # Disparo de arquivos/quizzes
│   │   └── celery-monitor.html # Monitor de saúde Celery
│   ├── settings.html           # Configurações / Notificações
│   ├── store.html              # Loja de recompensas (Streak Freeze)
│   ├── voice.html              # Voz em tempo real
│   └── writing.html            # Writing Sandbox
├── src/
│   ├── main.ts                 # Entry point global
│   ├── styles/
│   │   ├── globals.css         # Tokens, base, components (copiado de frontend/)
│   │   └── tailwind.css        # @tailwind directives
│   ├── tailwind.config.ts      # Config idêntica ao frontend/
│   ├── postcss.config.js
│   ├── api/
│   │   ├── client.ts           # Fetch wrapper tipado (baseURL,JWT,refresh)
│   │   ├── endpoints.ts        # Mapa de endpoints do backend
│   │   └── websocket.ts        # Client WebSocket tipado (chat + voz)
│   ├── auth/
│   │   ├── auth.ts             # Login,register,refresh,guard
│   │   └── token.ts            # JWT decode,storage,isExpired
│   ├── store/
│   │   ├── index.ts            # Store global (estado mínimo)
│   │   ├── auth-store.ts       # Estado de autenticação
│   │   └── ui-store.ts         # Sidebar,theme,modals
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.ts      # Sidebar (desktop:fixa, mobile:drawer)
│   │   │   ├── navbar.ts       # Topbar com avatar,notificações,theme toggle
│   │   │   └── auth-guard.ts   # Redirect para login se não autenticado
│   │   ├── ui/
│   │   │   ├── button.ts       # Botão primário/secundário/perigo
│   │   │   ├── input.ts        # Input com focus ring
│   │   │   ├── select.ts
│   │   │   ├── dialog-modal.ts # Modal genérico
│   │   │   ├── spinner.ts
│   │   │   └── tati-logo.ts    # Logo SVG
│   │   ├── chat/
│   │   │   ├── message-bubble.ts
│   │   │   ├── voice-bubble.ts
│   │   │   └── word-tooltip.ts
│   │   ├── dashboard/
│   │   │   ├── stat-card.ts
│   │   │   └── weekly-goal.ts
│   │   ├── catalog/
│   │   │   ├── product-card.ts
│   │   │   └── filter-chips.ts
│   │   ├── payment/
│   │   │   ├── checkout-modal.ts
│   │   │   └── pix-modal.ts
│   │   ├── onboarding/
│   │   │   └── tour-modal.ts
│   │   └── activities/
│   │       └── activity-card.ts
│   ├── hooks/                   # Funções utilitárias reutilizáveis
│   │   ├── use-theme.ts        # Toggle light/dark
│   │   ├── use-notifications.ts
│   │   └── use-permissions.ts
│   └── utils/
│       ├── format.ts           # Formatação de datas,números
│       ├── markdown.ts         # Render markdown (alternativa leve)
│       └── dom.ts              # Helpers DOM (createElement,toggleClass)
├── public/
│   ├── images/
│   │   └── tati_logo.jpg
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   └── icon-512x512.png
│   ├── sw.js                   # Service Worker para PWA/offline
│   └── manifest.json
├── tsconfig.json
├── vite.config.ts
├── package.json
├── .env.example
├── .env
└── postcss.config.js
```

---

## 6. Padrões Arquiteturais

### 6.1 Separação de Responsabilidades
- **HTML** = estrutura e conteúdo da página
- **TypeScript** = lógica, estado, chamadas de API, WebSockets
- **Tailwind CSS** = estilização (zero CSS custom além de tokens e component classes)
- Cada **componente TS** é um módulo que manipula um fragmento do DOM e expõe uma `init()` ou `render()` function

### 6.2 Component Pattern
```typescript
// src/components/ui/button.ts
export function renderButton(
  label: string,
  variant: 'primary' | 'secondary' | 'danger' = 'primary',
  onClick?: () => void
): HTMLButtonElement {
  const btn = document.createElement('button');
  const baseClasses = 'rounded-lg px-4 py-2 font-semibold transition-all duration-base';
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'border border-primary text-primary bg-transparent hover:bg-primary-dim',
    danger: 'bg-danger text-white hover:opacity-90',
  };
  btn.className = `${baseClasses} ${variantClasses[variant]}`;
  btn.textContent = label;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
```

### 6.3 Page Pattern
Cada página HTML carrega um script TS específico via Vite:
```html
<!-- pages/dashboard.html -->
<!DOCTYPE html>
<html lang="en" class="scrollbar-none">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard – Tati AI</title>
  <link rel="stylesheet" href="/src/styles/globals.css" />
</head>
<body class="bg-bg text-text min-h-screen">
  <div id="app"></div>
  <script type="module" src="/src/pages/dashboard.ts"></script>
</body>
</html>
```

```typescript
// src/pages/dashboard.ts
import { initSidebar } from '../components/layout/sidebar';
import { initNavbar } from '../components/layout/navbar';
import { checkAuth } from '../auth/auth';
import { loadDashboard } from './dashboard-loader';

checkAuth();
initSidebar();
initNavbar();
loadDashboard();
```

### 6.4 API Client Pattern
```typescript
// src/api/client.ts
const BASE_URL = import.meta.env.VITE_API_URL;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) { /* refresh or redirect */ }
  return res.json();
}
```

### 6.5 WebSocket Pattern
```typescript
// src/api/websocket.ts
export function createChatSocket(
  onMessage: (data: ChatMessage) => void
): WebSocket {
  const ws = new WebSocket(`${WS_URL}/api/chat/ws`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  return ws;
}
```

---

## 7. Funcionalidades a Replicar (1:1 com `frontend/`)

### 7.1 Páginas e Rotas
| Rota | Página HTML | Descrição |
|------|-----------|-----------|
| `/` | `index.html` | Landing / Redireciona para login ou dashboard |
| `/login` | `index.html` (seção login) | Login e registro |
| `/dashboard` | `pages/dashboard.html` | Dashboard do aluno (XP, streak, metas) |
| `/chat` | `pages/chat.html` | Chat com IA (texto + voz via WS) |
| `/activities` | `pages/activities.html` | Quizzes e atividades |
| `/flashcards` | `pages/flashcards.html` | Flashcards com SRS |
| `/vocabulary` | `pages/vocabulary.html` | Vocabulário |
| `/podcasts` | `pages/podcasts.html` | Podcasts e exercícios |
| `/simulations` | `pages/simulations.html` | Simulações de conversa |
| `/progress` | `pages/progress.html` | Progresso, metas, CEFR evolution |
| `/cefr` | `pages/cefr.html` | Avaliação CEFR |
| `/hub/catalog` | `pages/hub/catalog.html` | Hub catálogo |
| `/hub/checkout` | `pages/hub/checkout.html` | Checkout do hub |
| `/hub/materials` | `pages/hub/my-materials.html` | Meus materiais |
| `/admin` | `pages/admin/dashboard.html` | Painel admin |
| `/admin/dispatch` | `pages/admin/dispatch.html` | Disparo pedagógico |
| `/admin/celery` | `pages/admin/celery-monitor.html` | Monitor Celery |
| `/settings` | `pages/settings.html` | Preferências de notificação |
| `/store` | `pages/store.html` | Loja de recompensas |
| `/voice` | `pages/voice.html` | Voz em tempo real (Gemini Live) |
| `/writing` | `pages/writing.html` | Writing Sandbox |

### 7.2 Funcionalidades Críticas (devem funcionar idênticas)
- **Autenticação:** Login, registro, JWT, refresh de token, auth guard
- **Dashboard:** Stat cards, weekly goal, XP, streak com freeze, leagues
- **Chat IA:** Mensagens texto/voz, WebSocket streaming, markdown rendering, word tooltip, paginated history (20 msgs), IndexedDB cache
- **CEFR:** Avaliação com exercícios dinâmicos, julgamento semântico
- **Flashcards:** SRS, revisão diária, adicionar do chat
- **Gamificação:** XP, troféus, streaks, rankings, ligas, certificados
- **Podcasts:** Lista, transcript, pronunciation practice
- **Simulações:** Roleplay com avatar, checklist de missões, phonetic feedback (verde/vermelho por palavra)
- **Voice:** Modo hands-free, VAD, Web Audio canvas visualization
- **Writing:** Sandbox de redações
- **Hub:** Catálogo, precificação por papel (resolvePrice), checkout (Asaas/MercadoPago), PIX modal, documentos seguros
- **Admin:** Dashboard docente, analytics do aluno, disparo de arquivos/quizzes, celery monitor
- **Notificações:** Push (FCM), preferências configuráveis, action buttons
- **Mobile:** Responsividade total, sidebar drawer, modais ajustados
- **Tema:** Light/dark toggle com persistência
- **PWA:** Service Worker, manifest, offline support

---

## 8. Responsividade (mobile-first)

Replicar os breakpoints e padrões do `frontend/` atual:
- Base: mobile (single column, sidebar oculta/drawer)
- `sm:` (640px) – ajustes menores
- `md:` (768px) – layout intermediário
- `lg:` (1024px) – sidebar visível, grid com offset para sidebar
- `xl:` (1280px) – max-width container

Regras:
- Sidebar: mobile = drawer overlay; desktop (`lg:`) = fixa lateral
- Grids com sidebar: offset de cols no `lg:` (ex: `lg:grid-cols-4`)
- Modais: full-screen em mobile, centered com max-width em desktop
- Inputs e botões: largura total em mobile, auto em desktop

---

## 9. Webhooks e Integrações com Backend

### 9.1 REST API
- Base URL: `VITE_API_URL` (definido em `.env`)
- Autenticação via JWT no header `Authorization: Bearer <token>`
- Refresh automático de token antes de expirar
- Endpoints idênticos aos consumidos pelo `frontend/` atual (ver `lib/api/endpoints.ts`)

### 9.2 WebSockets
- Chat WS: `wss://{API_URL}/api/chat/ws` – streaming de mensagens
- Voice WS: `wss://{API_URL}/api/voice/live` – áudio bidirecional em tempo real

### 9.3 Webhooks (pagamentos)
- Escuta de status de pagamento via polling ou WebSocket para atualização em tempo real do checkout
- Callbacks de Asaas e MercadoPago processados pelo backend; frontend consulta status

---

## 10. Idioma da Interface

**Regra:** Toda a informação mostrada na interface do usuário deve ser em **Inglês US**.

Inclui (mas não se limita a):
- Labels de campos de formulário
- Textos de botões (ex: "Sign In", "Save", "Cancel", "Submit")
- Mensagens de erro e sucesso
- Headings e títulos de página
- Tooltips e placeholders
- Notificações e toasts
- Textos de modais
- Itens de menu e navegação
- Status e badges
- Empty states

Exemplos:
- "Login" → "Sign In"
- "Registrar" → "Sign Up"
- "Salvar" → "Save"
- "Cancelar" → "Cancel"
- "Carregando..." → "Loading..."
- "Erro ao carregar" → "Failed to load"
- "Nenhuma atividade encontrada" → "No activities found"

---

## 11. Requisitos Não Funcionais

### Performance
- Cada página HTML deve carregar com LCP < 2.5s
- Bundle por página deve ser mínimo (code-splitting natural por página)
- Nenhuma dependência pesada que não seja estritamente necessária
- Lazy loading de imagens e componentes não visíveis

### Simplicidade
- Zero React, zero Next.js, zero framework de UI
- Dependências mínimas: Vite, Tailwind CSS, TypeScript, lucide (SVG only)
- Estado global mínimo e simples
- Não adicionar bibliotecas ou funcionalidades não solicitadas

### Manutenibilidade
- Um componente = um arquivo `.ts` com função `render()` que retorna `HTMLElement`
- Nomenclatura consistente: kebab-case para arquivos, camelCase para funções/variáveis
- Tipagem forte: toda resposta de API e estado deve ter interface TypeScript

### Segurança
- JWT armazenado em `httpOnly` cookie ou `localStorage` com sanitize
- Tokens não expostos em URLs ou logs
- CSRF protection se aplicável
- Input sanitization antes de renderizar no DOM (prevenir XSS)

### Acessibilidade
- HTML semântico (`<nav>`, `<main>`, `<aside>`, `<article>`, `<section>`)
- Contraste WCAG AA
- Focus management em modais e navegação por teclado

---

## 12. Dependências (package.json mínimo)

```json
{
  "name": "tati-ai-frontend-2",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lucide": "latest"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vite": "^6.x",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.17",
    "eslint": "^8",
    "prettier": "^3"
  }
}
```

> Não adicionar nenhuma dependência além das listadas sem aprovação explícita.

---

## 13. Ordem de Implementação

### Fase 1 – Fundação
1. Criar `frontend_2/` com estrutura de diretórios
2. Configurar Vite + TypeScript + Tailwind CSS + PostCSS
3. Copiar `globals.css` e `tailwind.config.ts` adaptados (remover `@apply` que dependa de Tailwind plugins, manter tokens CSS puros)
4. Implementar `api/client.ts` com autenticação JWT
5. Implementar `auth/auth.ts` (login, register, refresh, guard)
6. Criar layout base (sidebar + navbar) responsivo

### Fase 2 – Páginas Principais do Aluno
7. Dashboard (stat cards, weekly goal, XP, streak)
8. Chat (WebSocket, mensagens, markdown, word tooltip, paginação)
9. Activities / Quizzes
10. Flashcards / SRS
11. Progress (CEFR evolution, gráficos, "How Points Work")

### Fase 3 – Módulos Adicionais
12. Podcasts (lista, transcript, pronunciation)
13. Simulations (roleplay, missions checklist, phonetic feedback)
14. Voice (real-time, VAD, Web Audio canvas)
15. Writing Sandbox
16. Vocabulary
17. CEFR Assessment

### Fase 4 – Hub e Pagamentos
18. Hub Catalog (filter chips, product cards, resolvePrice)
19. Checkout (modal, PIX, Asaas/MercadoPago)
20. My Materials (secure document viewer)

### Fase 5 – Admin e Extras
21. Admin Dashboard (student modal, analytics, nudges)
22. Dispatch Panel (file upload, quiz dispatch, student selection)
23. Celery Monitor
24. Settings (notification preferences)
25. Store (Streak Freeze purchase, XP spend)
26. Onboarding Tour

### Fase 6 – PWA e Polimento
27. Service Worker + offline page
28. Manifest.json
29. Validação visual side-by-side com `frontend/` atual
30. Testes de responsividade em breakpoints

---

## 14. Validação

### Critério de Aceite Final
O `frontend_2/` será considerado completo quando:
1. Todas as páginas do `frontend/` atual tiverem equivalente funcional em `frontend_2/`
2. O design system for visualmente idêntico (mesmas cores, espaçamentos, fontes, animações)
3. Toda a interface estiver em Inglês US
4. Responsividade funcionar em mobile, tablet e desktop
5. Autenticação, WebSockets e chamadas de API funcionarem contra o mesmo backend
6. `npm run typecheck` e `npm run lint` passarem sem erros
7. Zero funcionalidades adicionadas que não existam no `frontend/` atual
