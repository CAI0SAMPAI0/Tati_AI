<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useNotificationStore } from './stores/notifications';
import { usePresence } from './composables/usePresence';
import { registerServiceWorker, subscribeToPush } from './services/pushNotifications';
import { isApkOrStandalone } from './router';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const notifStore = useNotificationStore();
const router = useRouter();

// Keep user presence alive across the whole application
usePresence();

let notifPollTimer: any = null;
let pushInitTimer: any = null;

function handleGoogleMessage(event: MessageEvent) {
  if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
    const isHub = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'hub';
    authStore.setSession(
      event.data.token,
      event.data.user || { username: 'student' },
      event.data.refreshToken || event.data.refresh_token
    );
    if (isHub || event.data.user?.is_hub_only) {
      window.location.href = import.meta.env.VITE_HUB_SITE_URL || 'http://localhost:3001/materiais';
    } else {
      router.replace('/chat');
    }
  }
}

function handleFlutterReady() {
  try {
    localStorage.setItem('is_apk', '1');
  } catch {}
  if (router.currentRoute.value.path === '/') {
    router.replace(authStore.isAuthenticated ? '/chat' : '/login');
  }
}

function startNotificationPolling() {
  if (notifPollTimer) clearInterval(notifPollTimer);
  notifStore.fetchNotifications();
  // Poll notifications (streaks, new activities, trophies, nudges) every 25 seconds
  notifPollTimer = setInterval(() => {
    if (authStore.isAuthenticated && document.visibilityState === 'visible') {
      notifStore.fetchNotifications();
    }
  }, 25000);
}

onMounted(() => {
  themeStore.initTheme();
  authStore.init();

  // Register service worker for PWA / push notifications
  registerServiceWorker();

  // Proteção APK: Se carregar na raiz (/), redireciona imediatamente
  if (isApkOrStandalone() && router.currentRoute.value.path === '/') {
    router.replace(authStore.isAuthenticated ? '/chat' : '/login');
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleGoogleMessage);
    window.addEventListener('flutterInAppWebViewPlatformReady', handleFlutterReady);
  }

  // Se já autenticado, inicia push e notificações
  if (authStore.isAuthenticated) {
    startNotificationPolling();
    pushInitTimer = setTimeout(() => {
      subscribeToPush();
    }, 5000);
  }
});

watch(
  () => authStore.isAuthenticated,
  (isAuth) => {
    if (isAuth) {
      startNotificationPolling();
      if (!pushInitTimer) {
        pushInitTimer = setTimeout(() => {
          subscribeToPush();
        }, 5000);
      }
    } else {
      if (notifPollTimer) {
        clearInterval(notifPollTimer);
        notifPollTimer = null;
      }
    }
  }
);

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleGoogleMessage);
    window.removeEventListener('flutterInAppWebViewPlatformReady', handleFlutterReady);
  }
  if (notifPollTimer) clearInterval(notifPollTimer);
  if (pushInitTimer) clearTimeout(pushInitTimer);
});
</script>

<template>
  <router-view />
</template>
