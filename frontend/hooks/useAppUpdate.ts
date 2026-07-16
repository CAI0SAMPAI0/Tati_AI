'use client';

import { useState, useEffect, useCallback } from 'react';

const LAST_VERSION_KEY = 'tati_app_version';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min

interface AppVersion {
  android: string;
  download_url: string;
}

function getCurrentVersion(): string {
  if (typeof window === 'undefined') return '1.0.0';
  return localStorage.getItem(LAST_VERSION_KEY) || '1.0.0';
}

function setCurrentVersion(v: string) {
  localStorage.setItem(LAST_VERSION_KEY, v);
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [latestVersion, setLatestVersion] = useState('');

  const checkForUpdate = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/app/version`);
      if (!res.ok) return;

      const data: AppVersion = await res.json();
      const current = getCurrentVersion();

      if (data.android && data.android !== current && data.download_url) {
        setLatestVersion(data.android);
        setDownloadUrl(data.download_url);
        setUpdateAvailable(true);
      }
    } catch {
      // silently ignore
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
    // Remember this version so we don't nag again until next version
    if (latestVersion) setCurrentVersion(latestVersion);
  }, [latestVersion]);

  const downloadUpdate = useCallback(() => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  }, [downloadUrl]);

  useEffect(() => {
    checkForUpdate();
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkForUpdate]);

  // Mark current version on first load so we can detect changes
  useEffect(() => {
    const current = getCurrentVersion();
    if (!current || current === '1.0.0') {
      setCurrentVersion('1.0.0');
    }
  }, []);

  return { updateAvailable, latestVersion, downloadUrl, dismissUpdate, downloadUpdate };
}
