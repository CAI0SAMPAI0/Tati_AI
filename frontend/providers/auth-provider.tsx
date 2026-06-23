'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/lib/api/types';
import { ApiClientError, apiGet, registerUnauthorizedHandler } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

function triggerPodcastWarmup() {
  apiGet<{ ok: boolean }>(ENDPOINTS.ACTIVITIES_PODCASTS_WARMUP).catch(() => {
    // Fire-and-forget: não bloqueia login nem navegação
  });
}
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  syncAuthTokenCookieFromStorage,
} from '@/lib/api/auth';

function normalizeUserAvatar(source: User): User {
  const profileAvatar = (source as User & { profile?: { avatar_url?: string } })?.profile?.avatar_url;
  if (!source.avatar_url && profileAvatar) {
    return { ...source, avatar_url: profileAvatar };
  }
  return source;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoaded: boolean;
  isBootstrappingProfile: boolean;
  saveSession: (token: string, user: User) => Promise<void>;
  updateProfile: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isLoaded: false,
  isBootstrappingProfile: false,
  saveSession: async () => {},
  updateProfile: () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBootstrappingProfile, setIsBootstrappingProfile] = useState(false);
  const logoutRef = useRef<() => void>(() => {});
  const hasHydrated = useRef(false);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const freshUser = await apiGet<User>(ENDPOINTS.PROFILE);
      const normalizedUser = normalizeUserAvatar(freshUser);
      setUser(normalizedUser);
      saveStoredSession({ token, user: normalizedUser });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        logoutRef.current();
      }
    }
  }, [token]);

  const saveSession = useCallback(async (newToken: string, newUser: User) => {
    setIsBootstrappingProfile(true);
    // Reiniciar o cache do React Query ao entrar/logar
    queryClient.clear();
    // Persist token first so /profile can authenticate immediately.
    saveStoredSession({ token: newToken, user: normalizeUserAvatar(newUser) });
    try {
      const freshUser = await apiGet<User>(ENDPOINTS.PROFILE);
      const normalizedUser = normalizeUserAvatar(freshUser);
      setUser(normalizedUser);
      saveStoredSession({ token: newToken, user: normalizedUser });
    } catch {
      // Keep login resilient: fallback to user from login payload.
      const normalizedUser = normalizeUserAvatar(newUser);
      setUser(normalizedUser);
      saveStoredSession({ token: newToken, user: normalizedUser });
    } finally {
      setToken(newToken);
      setIsBootstrappingProfile(false);
      triggerPodcastWarmup();

      // Prefetch da tela de chat do usuário ao entrar
      queryClient.prefetchQuery({
        queryKey: ['due-vocab'],
        queryFn: () => apiGet('/users/vocabulary/due'),
      });
      queryClient.prefetchQuery({
        queryKey: ['payments-status'],
        queryFn: () => apiGet(ENDPOINTS.PAYMENTS_STATUS),
      });
    }
  }, [queryClient]);

  const updateProfile = useCallback((newUser: User) => {
    setUser(prev => prev ? { ...prev, ...newUser } : newUser);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    // Reiniciar o cache do React Query no logout
    queryClient.clear();
    window.location.href = '/login';
  }, [queryClient]);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    syncAuthTokenCookieFromStorage();

    const session = getStoredSession();
    if (!session) {
      setIsLoaded(true);
      return;
    }

    // Reiniciar cache ao carregar o estado inicial do usuário (entrada no sistema)
    queryClient.clear();

    setToken(session.token);
    setUser(normalizeUserAvatar(session.user));

    // Prefetch da tela de chat do usuário ao entrar já logado
    queryClient.prefetchQuery({
      queryKey: ['due-vocab'],
      queryFn: () => apiGet('/users/vocabulary/due'),
    });
    queryClient.prefetchQuery({
      queryKey: ['payments-status'],
      queryFn: () => apiGet(ENDPOINTS.PAYMENTS_STATUS),
    });

    // Valida sessão no backend para evitar estado quebrado após refresh de página.
    apiGet<User>(ENDPOINTS.PROFILE)
      .then((freshUser) => {
        const normalizedUser = normalizeUserAvatar(freshUser);
        setUser(normalizedUser);
        saveStoredSession({ token: session.token, user: normalizedUser, refreshToken: session.refreshToken });
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 401) {
          logoutRef.current();
        } else {
          // Erro de rede não deve derrubar sessão imediatamente.
          setUser(session.user);
        }
      })
      .finally(() => {
        setIsLoaded(true);
        triggerPodcastWarmup();
      });
  }, [queryClient]);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logoutRef.current();
    });
    return () => {
      registerUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (token && user) {
      saveStoredSession({ token, user });
    } else if (!token) {
      clearStoredSession();
    }
  }, [token, user, isLoaded]);

  useEffect(() => {
    if (!hasHydrated.current) {
      // Garantia defensiva caso o fluxo de hidratação seja interrompido.
      setIsLoaded(true);
    }
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    isLoaded,
    isBootstrappingProfile,
    saveSession,
    updateProfile,
    refreshUser,
    logout,
  }), [
    token,
    user,
    isLoaded,
    isBootstrappingProfile,
    saveSession,
    updateProfile,
    refreshUser,
    logout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
