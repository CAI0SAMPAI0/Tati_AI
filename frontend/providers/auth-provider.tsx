'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { User } from '@/lib/api/types';
import { ApiClientError, apiGet, registerUnauthorizedHandler } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { clearStoredSession, getStoredSession, saveStoredSession } from '@/lib/api/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoaded: boolean;
  saveSession: (token: string, user: User) => void;
  updateProfile: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isLoaded: false,
  saveSession: () => {},
  updateProfile: () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const logoutRef = useRef<() => void>(() => {});
  const hasHydrated = useRef(false);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const freshUser = await apiGet<User>(ENDPOINTS.PROFILE);
      setUser(freshUser);
      saveStoredSession({ token, user: freshUser });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        logoutRef.current();
      }
    }
  }, [token]);

  const saveSession = useCallback((newToken: string, newUser: User) => {
    saveStoredSession({ token: newToken, user: newUser });
    setToken(newToken);
    setUser(newUser);
  }, []);

  const updateProfile = useCallback((newUser: User) => {
    setUser(prev => prev ? { ...prev, ...newUser } : newUser);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    const session = getStoredSession();
    if (!session) {
      setIsLoaded(true);
      return;
    }

    setToken(session.token);
    setUser(session.user);

    // Valida sessão no backend para evitar estado quebrado após refresh de página.
    apiGet<User>(ENDPOINTS.PROFILE)
      .then((freshUser) => {
        setUser(freshUser);
        saveStoredSession({ token: session.token, user: freshUser, refreshToken: session.refreshToken });
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
      });
  }, []);

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

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoaded,
        saveSession,
        updateProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
