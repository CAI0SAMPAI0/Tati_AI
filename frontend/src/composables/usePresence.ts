import { onMounted, onUnmounted, watch } from 'vue';
import { apiPost } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

let lastPing = 0;
const PING_INTERVAL = 30000; // 30 seconds

export function usePresence() {
  const authStore = useAuthStore();
  let timer: any = null;

  async function sendHeartbeat() {
    if (!authStore.isAuthenticated) return;
    const now = Date.now();
    lastPing = now;
    try {
      await apiPost('/auth/heartbeat', {});
    } catch {
      // ignore network errors
    }
  }

  function handleUserActivity() {
    const now = Date.now();
    if (now - lastPing >= PING_INTERVAL) {
      sendHeartbeat();
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastPing >= 15000) {
        sendHeartbeat();
      }
    }
  }

  onMounted(() => {
    if (authStore.isAuthenticated) {
      sendHeartbeat();
    }

    timer = setInterval(() => {
      if (authStore.isAuthenticated && document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }, PING_INTERVAL);

    window.addEventListener('focus', handleUserActivity);
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener('focus', handleUserActivity);
    window.removeEventListener('click', handleUserActivity);
    window.removeEventListener('keydown', handleUserActivity);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        sendHeartbeat();
      }
    }
  );

  return {
    sendHeartbeat,
  };
}
