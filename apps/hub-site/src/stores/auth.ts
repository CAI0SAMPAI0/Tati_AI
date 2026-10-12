import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  fetchProfile,
  ApiClientError,
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  syncAuthTokenCookieFromStorage,
  type User,
} from '@tati/hub-core';

export const useAuthStore = defineStore('hubAuth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const isLoaded = ref(false);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  function logout() {
    clearStoredSession();
    user.value = null;
    token.value = null;
  }

  async function refreshProfile() {
    const current = getStoredSession();
    if (!current?.token) return;

    try {
      const freshUser = await fetchProfile();
      user.value = freshUser;
      saveStoredSession({
        token: current.token,
        user: freshUser,
        refreshToken: current.refreshToken,
      });
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 404)) {
        logout();
      }
    }
  }

  function saveSession(nextToken: string, nextUser: User) {
    saveStoredSession({ token: nextToken, user: nextUser });
    token.value = nextToken;
    user.value = nextUser;
  }

  async function initAuth() {
    syncAuthTokenCookieFromStorage();
    const current = getStoredSession();
    if (!current) {
      isLoaded.value = true;
      return;
    }

    token.value = current.token;
    user.value = current.user;

    try {
      const freshUser = await fetchProfile();
      user.value = freshUser;
      saveStoredSession({
        token: current.token,
        user: freshUser,
        refreshToken: current.refreshToken,
      });
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 404)) {
        logout();
      }
    } finally {
      isLoaded.value = true;
    }
  }

  return {
    user,
    token,
    isLoaded,
    isAuthenticated,
    logout,
    refreshProfile,
    saveSession,
    initAuth,
  };
});
