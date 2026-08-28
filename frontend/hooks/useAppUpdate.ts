'use client';

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useState, useCallback } from 'react';

interface AppVersionResponse {
  android: string;
  download_url: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [latestVersion, setLatestVersion] = useState('');

  const checkForUpdate = useCallback(async () => {
    // Only check for updates if running as a native app
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      const currentVersion = info.version; // e.g. "1.0.0"

      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/app/version`);
      if (!res.ok) return;

      const data: AppVersionResponse = await res.json();

      // Simple version comparison (e.g. "1.1.0" !== "1.0.0")
      if (data.android && data.android !== currentVersion && data.download_url) {
        setLatestVersion(data.android);
        setDownloadUrl(data.download_url);
        setUpdateAvailable(true);
      }
    } catch (e) {
      console.error('[useAppUpdate] Error checking for update:', e);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!downloadUrl) return;

    const w = window as any;
    const isCapacitor = w.Capacitor?.isNativePlatform?.();

    if (isCapacitor && w.Capacitor?.Plugins?.ExternalBrowser) {
      try {
        await w.Capacitor.Plugins.ExternalBrowser.open({ url: downloadUrl });
      } catch {
        window.location.href = downloadUrl;
      }
    } else {
  const downloadUpdate = useCallback(() => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  }, [downloadUrl]);

  useEffect(() => {
    checkForUpdate();
    // Check every 30 minutes
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdate]);

  return { updateAvailable, latestVersion, downloadUrl, dismissUpdate, downloadUpdate };
}

