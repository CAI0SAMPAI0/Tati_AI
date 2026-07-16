'use client';

import { useAppUpdate } from '@/hooks/useAppUpdate';

export function UpdateBanner() {
  const { updateAvailable, latestVersion, dismissUpdate, downloadUpdate } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface px-4 py-3 shadow-lg md:left-auto md:right-6 md:max-w-sm animate-fade-in">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">
          New version available
        </p>
        <p className="text-xs text-text-muted truncate">
          v{latestVersion} — Tap to update
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={downloadUpdate}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          Update
        </button>
        <button
          onClick={dismissUpdate}
          className="rounded-lg px-2 py-1.5 text-xs text-text-muted transition hover:text-text"
        >
          Later
        </button>
      </div>
    </div>
  );
}
