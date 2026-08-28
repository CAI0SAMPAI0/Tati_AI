'use client';

import { useCallback } from 'react';

export function useGoogleAuth() {
  const signInWithGoogle = useCallback(async (): Promise<{ idToken: string } | null> => {
    return null;
  }, []);

  return { signInWithGoogle };
}
