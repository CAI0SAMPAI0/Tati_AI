'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AppUpdateDetector() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Se já estiver na página de atualização, não faz nada
    if (pathname?.startsWith('/atualizar')) return;

    // Se já foi confirmado nesta sessão que a versão é atual, não precisa verificar novamente
    if (sessionStorage.getItem('tati_app_version_verified') === 'true') return;

    const checkOldApk = () => {
      // Se tiver version code 2 ou superior, é a versão atualizada
      const versionCode = (window as any).tatiAppVersionCode;
      if (versionCode && Number(versionCode) >= 2) {
        sessionStorage.setItem('tati_app_version_verified', 'true');
        return;
      }

      // Detecta se está rodando dentro do WebView do Flutter
      const isFlutter = Boolean(
        (window as any).isFlutterApp ||
        (window as any).flutter_inappwebview
      );

      // Se for Flutter e após o tempo de carregamento ainda NÃO tiver versionCode >= 2,
      // significa que é o APK antigo que nunca injeta o versionCode.
      if (isFlutter && (!versionCode || Number(versionCode) < 2)) {
        window.location.href = '/atualizar';
      }
    };

    // Dá 2.5 segundos para o WebView carregar a página e injetar as variáveis
    // antes de considerar que se trata de uma versão antiga sem versionCode.
    const timeout = setTimeout(checkOldApk, 2500);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
}
