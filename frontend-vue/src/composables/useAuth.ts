import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

export function useAuth() {
  const store = useAuthStore();

  return {
    user: computed(() => store.user),
    token: computed(() => store.token),
    isAuthenticated: computed(() => store.isAuthenticated),
    isLoaded: computed(() => store.isLoaded),
    accent: computed(() => store.accent),
    userLevel: computed(() => store.userLevel),
    userRole: computed(() => store.userRole),
    isTeacher: computed(() => store.isTeacher),
    setSession: store.setSession,
    logout: store.logout,
    setAccent: store.setAccent,
    updateUserData: store.updateUserData,
  };
}

