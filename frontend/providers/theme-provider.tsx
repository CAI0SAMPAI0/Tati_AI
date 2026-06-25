'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useRef } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange
    >
      <ThemeOverflowGuard>{children}</ThemeOverflowGuard>
    </NextThemesProvider>
  );
}

function ThemeOverflowGuard({ children }: { children: React.ReactNode }) {
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const el = document.documentElement;
          const isDark = el.classList.contains('dark');
          const isLight = el.classList.contains('light');
          const current = isDark ? 'dark' : isLight ? 'light' : 'none';

          if (lastAppliedRef.current === null) {
            lastAppliedRef.current = current;
            return;
          }

          if (current === 'none' && lastAppliedRef.current !== 'none') {
            el.classList.add(lastAppliedRef.current);
            return;
          }

          lastAppliedRef.current = current;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
