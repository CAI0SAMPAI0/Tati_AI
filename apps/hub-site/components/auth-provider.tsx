'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchProfile } from '@tati/hub-core';
import { ApiClientError } from '@tati/hub-core';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  syncAuthTokenCookieFromStorage,
} from '@tati/hub-core';
import type { User } from '@tati/hub-core';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoaded: boolean;
  saveSession: (token: string, user: User) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setToken(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = getStoredSession();
    if (!current?.token) return;

    try {
      const freshUser = await fetchProfile();
      setUser(freshUser);
      saveStoredSession({ token: current.token, user: freshUser, refreshToken: current.refreshToken });
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 404)) {
        logout();
      }
    }
  }, [logout]);

  const saveSession = useCallback((nextToken: string, nextUser: User) => {
    saveStoredSession({ token: nextToken, user: nextUser });
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  useEffect(() => {
    syncAuthTokenCookieFromStorage();

    const current = getStoredSession();
    if (!current) {
      setIsLoaded(true);
      return;
    }

    setToken(current.token);
    setUser(current.user);

    fetchProfile()
      .then((freshUser) => {
        setUser(freshUser);
        saveStoredSession({ token: current.token, user: freshUser, refreshToken: current.refreshToken });
      })
      .catch((error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 404)) {
          logout();
        }
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, [logout]);

  useEffect(() => {
    if (!token || !user) return;
    saveStoredSession({ token, user });
  }, [token, user]);

  const value = useMemo(
    () => ({ user, token, isLoaded, saveSession, logout, refreshProfile }),
    [isLoaded, logout, refreshProfile, saveSession, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useHubAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useHubAuth must be used within AuthProvider');
  }
  return context;
}
