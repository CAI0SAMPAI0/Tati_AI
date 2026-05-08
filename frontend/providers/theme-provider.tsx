'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { use, useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by only rendering after mount
  if (!mounted) {
    return (
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="theme"
        forcedTheme="dark"
      >
        {children}
      </NextThemesProvider>
    );
  }
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}
