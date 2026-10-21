import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  // Public Landing & Leveling Test
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/public/LandingView.vue'),
    meta: { public: true },
  },
  {
    path: '/cefr-test',
    name: 'cefr-test',
    component: () => import('../views/public/CefrTestView.vue'),
    meta: { public: true },
  },
  {
    path: '/teste-cefr',
    redirect: '/cefr-test',
  },

  // Auth Routes
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('../views/auth/ResetPasswordView.vue'),
    meta: { public: true },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/public/PrivacyView.vue'),
    meta: { public: true },
  },
  {
    path: '/politica-de-privacidade',
    redirect: '/privacy',
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { public: true },
  },

  // Public Catalog
  {
    path: '/activities/hub',
    name: 'hub-catalog',
    component: () => import('../views/hub/HubCatalogView.vue'),
    meta: { public: true },
  },

  // Rotas Autenticadas em Tela Cheia (SEM Sidebar e SEM Topbar de troféus)
  {
    path: '/pronunciation',
    name: 'pronunciation',
    component: () => import('../views/pronunciation/PronunciationView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pronunciation-reader',
    name: 'pronunciation-reader',
    component: () => import('../views/pronunciation/PronunciationView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/voice',
    name: 'voice',
    component: () => import('../views/voice/VoiceView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/voice-only',
    name: 'voice-only',
    component: () => import('../views/voice/VoiceOnlyView.vue'),
    meta: { requiresAuth: true },
  },

  // Authenticated App Routes (COM Sidebar e Topbar via AuthenticatedLayout)
  {
    path: '/',
    component: () => import('../components/layout/AuthenticatedLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'chat',
        name: 'chat',
        component: () => import('../views/chat/ChatView.vue'),
      },
      {
        path: 'competitions',
        name: 'competitions',
        component: () => import('../views/competitions/CompetitionsView.vue'),
      },
      {
        path: 'exams',
        name: 'exams',
        component: () => import('../views/exams/ExamsDashboardView.vue'),
      },
      {
        path: 'exams/doing',
        name: 'exams-doing',
        component: () => import('../views/exams/ExamsDoingView.vue'),
      },
      {
        path: 'activities',
        name: 'activities',
        component: () => import('../views/activities/ActivitiesView.vue'),
      },
      {
        path: 'activities/hub/:id/ler',
        alias: ['reader/:id', 'hub/:id/ler'],
        name: 'hub-reader',
        component: () => import('../views/hub/ProtectedReaderView.vue'),
      },
      {
        path: 'activities/hub/meus-materiais',
        alias: ['meus-materiais', 'my-materials'],
        name: 'hub-my-materials',
        component: () => import('../views/hub/MyMaterialsView.vue'),
      },
      {
        path: 'activities/hub/pedidos',
        alias: ['pedidos', 'orders'],
        name: 'hub-orders',
        component: () => import('../views/hub/OrdersView.vue'),
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/dashboard/DashboardView.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('../views/profile/ProfileView.vue'),
      },
      {
        path: 'history',
        name: 'history',
        component: () => import('../views/history/HistoryView.vue'),
      },
      {
        path: 'progress',
        name: 'progress',
        component: () => import('../views/progress/ProgressView.vue'),
      },
      {
        path: 'goals',
        name: 'goals',
        component: () => import('../views/goals/GoalsView.vue'),
      },
      {
        path: 'flashcards/:id',
        name: 'flashcards-player',
        component: () => import('../views/flashcards/FlashcardsPlayerView.vue'),
      },
      {
        path: 'listenings',
        name: 'listenings',
        component: () => import('../views/listenings/ListeningsView.vue'),
      },
      {
        path: 'listenings/:id',
        name: 'listening-detail',
        component: () => import('../views/listenings/ListeningDetailView.vue'),
      },
      {
        path: 'vocab',
        name: 'vocab',
        component: () => import('../views/vocab/VocabView.vue'),
      },
      {
        path: 'vocab/review',
        name: 'vocab-review',
        component: () => import('../views/vocab/VocabReviewView.vue'),
      },
      {
        path: 'achievements',
        name: 'achievements',
        component: () => import('../views/achievements/AchievementsView.vue'),
      },
      {
        path: 'activities/achievements/my',
        redirect: '/achievements',
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../views/settings/SettingsView.vue'),
      },
      {
        path: 'payment',
        name: 'payment',
        component: () => import('../views/payment/PaymentView.vue'),
      },
      {
        path: 'receipt',
        name: 'receipt',
        component: () => import('../views/payment/ReceiptView.vue'),
      },
      {
        path: 'shop',
        name: 'shop',
        component: () => import('../views/shop/ShopView.vue'),
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../views/NotFoundView.vue'),
      },
    ],
  },
];

export function isApkOrStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Memória persistente no dispositivo
  if (
    localStorage.getItem('is_apk') === '1' ||
    localStorage.getItem('is_pwa') === '1' ||
    localStorage.getItem('app_source') === 'apk' ||
    (typeof document !== 'undefined' &&
      (document.cookie.includes('is_pwa=1') || document.cookie.includes('is_apk=1')))
  ) {
    return true;
  }

  // 2. Ponte Flutter InAppWebView nativa do APK
  const w = window as any;
  if (w.flutter_inappwebview || w.isFlutterApp || w.FlutterBridge) {
    try {
      localStorage.setItem('is_apk', '1');
    } catch {}
    return true;
  }

  // 3. Assinatura do User-Agent (WebView Android, Flutter, TatiAI)
  const ua = navigator.userAgent || '';
  if (
    /wv|Android.*Version\/[\d.]+/i.test(ua) ||
    /TatiAI|Flutter|InAppWebView|TatiApp/i.test(ua)
  ) {
    try {
      localStorage.setItem('is_apk', '1');
    } catch {}
    return true;
  }

  // 4. Parâmetros de URL (?apk, ?apk=1, ?source=apk, ?source=pwa, ?mode=standalone)
  if (window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (
        params.has('apk') ||
        params.get('source') === 'apk' ||
        params.get('source') === 'pwa' ||
        params.get('mode') === 'standalone' ||
        params.get('mode') === 'pwa'
      ) {
        try {
          localStorage.setItem('is_apk', '1');
        } catch {}
        return true;
      }
    } catch {}
  }

  // 5. Standalone PWA / TWA instalada
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as any).standalone) ||
    (document.referrer && document.referrer.includes('android-app://'))
  ) {
    try {
      localStorage.setItem('is_pwa', '1');
    } catch {}
    return true;
  }

  return false;
}

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (!authStore.isLoaded) {
    authStore.init();
  }

  // Intercept Google OAuth / callback tokens from URL query parameters on auth routes
  const isAuthRoute = to.path === '/login' || to.path === '/auth/callback' || Boolean(to.query.token);
  let token = (to.query.token as string | undefined);
  let refreshToken = (to.query.refresh_token as string | undefined);
  let userParam = (to.query.user as string | undefined);

  if (isAuthRoute && !token && typeof window !== 'undefined' && window.location.search) {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      token = searchParams.get('token') || undefined;
      refreshToken = searchParams.get('refresh_token') || undefined;
      userParam = searchParams.get('user') || undefined;
    } catch (_) {}
  }

  if (token && isAuthRoute) {
    let userObj: any = null;
    try {
      if (userParam) {
        try {
          userObj = JSON.parse(userParam);
        } catch {
          userObj = JSON.parse(decodeURIComponent(userParam));
        }
      }
    } catch (_) {}

    authStore.setSession(token, userObj || { username: 'student' }, refreshToken);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', to.path);
    }

    const isHub = to.query.access === 'hub' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'hub');
    if (isHub || userObj?.is_hub_only) {
      window.location.href = import.meta.env.VITE_HUB_SITE_URL || 'http://localhost:3001/materiais';
      return;
    }

    return next('/chat');
  }

  // Proteção APK e PWA Standalone:
  // Se o usuário estiver usando pelo APK (Android WebView, Flutter InAppWebView, etc.),
  // NUNCA exibe a landing page (/). Redireciona sempre para /chat se autenticado, ou /login se não.
  if (to.path === '/' && isApkOrStandalone()) {
    return next(authStore.isAuthenticated ? '/chat' : '/login');
  }

  // Usuário autenticado na web comum acessando a raiz (/) também vai direto para /chat
  if (to.path === '/' && authStore.isAuthenticated) {
    return next('/chat');
  }

  const isPublic = to.matched.some((record) => record.meta.public);

  if (to.path === '/login' && authStore.isAuthenticated) {
    return next('/chat');
  }

  if (!isPublic && !authStore.isAuthenticated) {
    return next('/login');
  }

  next();
});

export default router;