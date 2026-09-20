'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AppUpdateDetector() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Se já estiver na página de atualização, não faz nada
    if (pathname?.startsWith('/atualizar')) return;

    const checkOldApk = () => {
      // Detecta se está rodando dentro do WebView do Flutter
      const isFlutter = Boolean(
        (window as any).isFlutterApp ||
        (window as any).flutter_inappwebview
      );

      // No novo APK (v1.0.1), window.tatiAppVersionCode é definido como 2.
      // Se for Flutter e NÃO tiver version code (ou for menor que 2), é o APK antigo!
      const versionCode = (window as any).tatiAppVersionCode;
      const isOldApk = isFlutter && (!versionCode || Number(versionCode) < 2);

      if (isOldApk) {
        window.location.href = '/atualizar';
      }
    };

    // Executa imediatamente e novamente após 1s para garantir que os objetos do WebView já foram injetados
    checkOldApk();
    const timeout = setTimeout(checkOldApk, 1000);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
}
