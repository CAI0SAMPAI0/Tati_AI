import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '../api/types';
import {
  getStoredSession,
  saveStoredSession,
  clearStoredSession,
} from '../api/auth';
import { apiGet, apiPut, registerUnauthorizedHandler } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { DEFAULT_ACCENT, getStoredAccent, saveStoredAccent } from '../constants/accents';
import { DEFAULT_AVATAR_URL } from '../constants/user';

function normalizeUserAvatar(source: User): User {
  if (!source || typeof source !== 'object') {
    return { username: 'student', avatar_url: DEFAULT_AVATAR_URL } as User;
  }
  const profileAvatar = (source as any)?.profile?.avatar_url;
  let chosenAvatar = source.avatar_url || profileAvatar || DEFAULT_AVATAR_URL;
  if (typeof chosenAvatar === 'string' && chosenAvatar.includes('/avatar/avatar_tati') && (source as any).role !== 'teacher') {
    chosenAvatar = DEFAULT_AVATAR_URL;
  }
  return { ...source, avatar_url: typeof chosenAvatar === 'string' ? chosenAvatar : DEFAULT_AVATAR_URL };
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  const refreshToken = ref<string | null>(null);
  const isLoaded = ref(false);
  const accent = ref<string>(getStoredAccent());

  const isAuthenticated = computed(() => Boolean(token.value));
  const userLevel = computed(() => user.value?.level || 'A1');
  const userRole = computed(() => user.value?.role || 'student');
  const isTeacher = computed(() => userRole.value === 'teacher' || userRole.value === 'admin');

  function init() {
    const session = getStoredSession();
    if (session) {
      token.value = session.token;
      user.value = normalizeUserAvatar(session.user);
      refreshToken.value = session.refreshToken || null;
      accent.value = session.user?.preferred_accent || getStoredAccent();

      // Refresh in background
      apiGet<User>(ENDPOINTS.PROFILE)
        .then((fresh) => {
          user.value = normalizeUserAvatar(fresh);
          if (fresh.preferred_accent) {
            accent.value = fresh.preferred_accent;
            saveStoredAccent(fresh.preferred_accent);
          }
          saveStoredSession({
            token: session.token,
            user: user.value,
            refreshToken: session.refreshToken,
          });
        })
        .catch(() => {});
    }
    isLoaded.value = true;

    registerUnauthorizedHandler(() => {
      logout();
    });
  }

  function setSession(newToken: string, newUser: User, newRefreshToken?: string | null) {
    const normalized = normalizeUserAvatar(newUser);
    token.value = newToken;
    user.value = normalized;
    refreshToken.value = newRefreshToken || null;
    saveStoredSession({ token: newToken, user: normalized, refreshToken: newRefreshToken });

    if (normalized.preferred_accent) {
      accent.value = normalized.preferred_accent;
      saveStoredAccent(normalized.preferred_accent);
    }

    // Immediately fetch full fresh profile in background so avatar, name, and level are always populated
    apiGet<User>(ENDPOINTS.PROFILE)
      .then((fresh) => {
        if (fresh) {
          const freshNormalized = normalizeUserAvatar(fresh);
          user.value = freshNormalized;
          if (fresh.preferred_accent) {
            accent.value = fresh.preferred_accent;
            saveStoredAccent(fresh.preferred_accent);
          }
          saveStoredSession({
            token: newToken,
            user: freshNormalized,
            refreshToken: newRefreshToken,
          });
        }
      })
      .catch((err) => console.debug('[Auth] Failed to fetch fresh profile after setSession:', err));
  }

  function logout() {
    token.value = null;
    user.value = null;
    refreshToken.value = null;
    clearStoredSession();
  }

  function setAccent(newAccent: string) {
    accent.value = newAccent;
    saveStoredAccent(newAccent);
    apiPut('/profile', { preferred_accent: newAccent, accent: newAccent }).catch(() => {});
  }

  function updateUserData(updated: Partial<User>) {
    if (user.value) {
      user.value = normalizeUserAvatar({ ...user.value, ...updated });
      if (token.value) {
        saveStoredSession({ token: token.value, user: user.value, refreshToken: refreshToken.value });
      }
    }
  }

  return {
    token,
    user,
    refreshToken,
    isLoaded,
    accent,
    isAuthenticated,
    userLevel,
    userRole,
    isTeacher,
    init,
    setSession,
    logout,
    setAccent,
    updateUserData,
  };
});

