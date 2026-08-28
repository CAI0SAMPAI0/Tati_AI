'use client';

import { useState, useCallback } from 'react';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [latestVersion, setLatestVersion] = useState('');

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const downloadUpdate = useCallback(() => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  }, [downloadUrl]);

  return { updateAvailable, latestVersion, downloadUrl, dismissUpdate, downloadUpdate };
}

