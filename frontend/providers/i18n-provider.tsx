'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { type Locale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { loadMessages, type TranslationDict } from '@/lib/i18n/messages/loader';

interface I18nState {
  locale: Locale;
  t: (key: string, ...args: unknown[]) => string;
  setLanguage: (locale: Locale) => void;
}

const I18nContext = createContext<I18nState | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<TranslationDict>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    loadMessages(locale)
      .then((dict) => {
        if (!cancelled) {
          setMessages(dict);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages({});
          setIsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLanguage = useCallback((newLocale: Locale) => {
    // No-op since we only support English now
  }, []);

  const t = useCallback(
    (key: string, ...args: unknown[]): string => {
      const keys = key.split('.');

      let value: unknown = messages;
      for (const k of keys) {
        value = (value as Record<string, unknown> | undefined)?.[k];
        if (value === undefined) break;
      }

      if (value === undefined) {
        const fallbackDict = { gen: { error: 'Error. Please try again.' } } as TranslationDict;
        value = fallbackDict;
        for (const k of keys) {
          value = (value as Record<string, unknown> | undefined)?.[k];
          if (value === undefined) break;
        }
      }

      if (typeof value === 'function') {
        return String((value as (...fnArgs: unknown[]) => unknown)(...args));
      }

      if (typeof value === 'string') return value;

      return key;
    },
    [messages],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLanguage }}>
      {isLoaded ? children : null}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
