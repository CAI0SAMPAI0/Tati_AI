import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  // Public Routes
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
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { public: true },
  },

  // Authenticated Routes
  {
    path: '/',
    component: () => import('../components/layout/AuthenticatedLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/chat',
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('../views/chat/ChatView.vue'),
      },
      {
        path: 'exams',
        name: 'exams',
        component: () => import('../views/exams/ExamsView.vue'),
      },
      {
        path: 'activities',
        name: 'activities',
        component: () => import('../views/activities/ActivitiesView.vue'),
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
        path: 'vocab',
        name: 'vocab',
        component: () => import('../views/vocab/VocabView.vue'),
      },
      {
        path: 'achievements',
        name: 'achievements',
        component: () => import('../views/achievements/AchievementsView.vue'),
      },
      {
        path: 'pronunciation',
        name: 'pronunciation',
        component: () => import('../views/pronunciation/PronunciationView.vue'),
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../views/NotFoundView.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  // If not yet loaded, initialize
  if (!authStore.isLoaded) {
    authStore.init();
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
