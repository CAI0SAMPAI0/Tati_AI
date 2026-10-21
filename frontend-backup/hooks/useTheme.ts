'use client';

import { useCallback, useMemo } from 'react';
import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  const toggleTheme = useCallback(() => {
    const effective = resolvedTheme ?? theme ?? 'dark';
    setTheme(effective === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, theme, setTheme]);

  return useMemo(() => ({
    /** Preferência salva: 'light' | 'dark' | 'system' */
    theme: theme ?? 'dark',
    /** Tema efetivo aplicado na UI */
    resolvedTheme: resolvedTheme ?? theme ?? 'dark',
    setTheme,
    toggleTheme,
    isDark: (resolvedTheme ?? theme) === 'dark',
  }), [theme, resolvedTheme, setTheme, toggleTheme]);
}
