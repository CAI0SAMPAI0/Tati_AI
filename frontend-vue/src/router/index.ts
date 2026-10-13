import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

import LandingView from '@/views/LandingView.vue';
import LoginView from '@/views/LoginView.vue';
import ResetPasswordView from '@/views/ResetPasswordView.vue';
import PrivacyView from '@/views/PrivacyView.vue';
import ChatView from '@/views/ChatView.vue';
import PronunciationReaderView from '@/views/PronunciationReaderView.vue';
import DashboardView from '@/views/DashboardView.vue';
import ActivitiesView from '@/views/ActivitiesView.vue';
import VoiceView from '@/views/VoiceView.vue';
import ProgressView from '@/views/ProgressView.vue';
import GoalsView from '@/views/GoalsView.vue';
import AchievementsView from '@/views/AchievementsView.vue';
import CompetitionsView from '@/views/CompetitionsView.vue';
import HistoryView from '@/views/HistoryView.vue';
import ProfileView from '@/views/ProfileView.vue';
import SettingsView from '@/views/SettingsView.vue';
import ExamsView from '@/views/ExamsView.vue';
import { canAccessDashboard } from '@/utils/permissions';

const routes = [
  {
    path: '/',
    name: 'landing',
    component: LandingView,
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPasswordView,
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: PrivacyView,
  },
  {
    path: '/politica-de-privacidade',
    redirect: '/privacy',
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true },
  },
  {
    path: '/pronunciation-reader',
    name: 'pronunciation-reader',
    component: PronunciationReaderView,
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/activities',
    name: 'activities',
    component: ActivitiesView,
    meta: { requiresAuth: true },
  },
  {
    path: '/voice',
    name: 'voice',
    component: VoiceView,
    meta: { requiresAuth: true },
  },
  {
    path: '/progress',
    name: 'progress',
    component: ProgressView,
    meta: { requiresAuth: true },
  },
  {
    path: '/goals',
    name: 'goals',
    component: GoalsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/achievements',
    name: 'achievements',
    component: AchievementsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/activities/achievements/my',
    redirect: '/achievements',
  },
  {
    path: '/competitions',
    name: 'competitions',
    component: CompetitionsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/history',
    name: 'history',
    component: HistoryView,
    meta: { requiresAuth: true },
  },
  {
    path: '/exams',
    name: 'exams',
    component: ExamsView,
    meta: { requiresAuth: true, programadorOnly: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0 };
  },
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } });
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/chat');
  } else if (to.meta.programadorOnly && authStore.user?.username !== 'programador') {
    next('/activities');
  } else if (to.path.startsWith('/dashboard')) {
    if (!canAccessDashboard(authStore.user)) {
      next('/chat');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
