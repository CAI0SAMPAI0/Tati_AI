'use client';

import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  function toggleTheme() {
    const effective = resolvedTheme ?? theme ?? 'dark';
    setTheme(effective === 'dark' ? 'light' : 'dark');
  }

  return {
    /** Preferência salva: 'light' | 'dark' | 'system' */
    theme: theme ?? 'dark',
    /** Tema efetivo aplicado na UI */
    resolvedTheme: resolvedTheme ?? theme ?? 'dark',
    setTheme,
    toggleTheme,
    isDark: (resolvedTheme ?? theme) === 'dark',
  };
}
