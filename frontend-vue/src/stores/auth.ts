import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  level: string;
  nickname?: string;
  preferred_accent?: string;
  is_premium_active?: boolean;
  is_special_access?: boolean;
  avatar?: string;
  avatar_url?: string;
  occupation?: string;
  focus?: string;
  responsible_email?: string;
  whatsapp_number?: string;
  allow_whatsapp_notifications?: boolean;
  streak?: number;
  streak_count?: number;
  total_xp?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const user = ref<User | null>(null);
  const isLoaded = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isStudent = computed(() => user.value?.role === 'student' || user.value?.role === 'aluno');
  const isProgrammer = computed(() => user.value?.role === 'programador' || user.value?.role === 'admin');

  function init() {
    if (typeof window === 'undefined') return;
    try {
      const storedToken = localStorage.getItem('token');
      const storedRefresh = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');

      if (storedToken) token.value = storedToken;
      if (storedRefresh) refreshToken.value = storedRefresh;
      if (storedUser) user.value = JSON.parse(storedUser);
    } catch (e) {
      console.warn('Erro ao restaurar sessão do localStorage:', e);
    } finally {
      isLoaded.value = true;
    }
  }

  function saveSession(newToken: string, newUser: User, newRefresh?: string) {
    token.value = newToken;
    user.value = newUser;
    if (newRefresh) refreshToken.value = newRefresh;

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
    }
  }

  function clearSession() {
    token.value = null;
    refreshToken.value = null;
    user.value = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  // Inicializa imediatamente
  init();

  return {
    token,
    refreshToken,
    user,
    isLoaded,
    isAuthenticated,
    isStudent,
    isProgrammer,
    saveSession,
    clearSession,
    init,
  };
});
