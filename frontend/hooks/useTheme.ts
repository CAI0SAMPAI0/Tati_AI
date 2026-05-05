'use client';

import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return {
    theme: resolvedTheme ?? theme ?? 'dark',
    setTheme,
    toggleTheme,
    isDark: (resolvedTheme ?? theme) === 'dark',
  };
}
