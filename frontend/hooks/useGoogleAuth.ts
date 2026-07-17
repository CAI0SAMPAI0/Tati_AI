'use client';

import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export function useGoogleAuth() {
  const signInWithGoogle = useCallback(async (): Promise<{ idToken: string } | null> => {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const { GoogleAuth } = await import('@southdevs/capacitor-google-auth');
      await GoogleAuth.initialize();
      const user = await GoogleAuth.signIn();
      if (user?.authentication?.idToken) {
        return { idToken: user.authentication.idToken };
      }
      return null;
    } catch (e) {
      console.error('[useGoogleAuth] Error:', e);
      return null;
    }
  }, []);

  return { signInWithGoogle };
}
