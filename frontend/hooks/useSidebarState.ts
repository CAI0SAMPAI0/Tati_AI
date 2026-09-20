'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSidebarState() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize state based on localStorage and window size
  useEffect(() => {
    const syncState = () => {
      if (typeof window === 'undefined') return;
      try {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          setSidebarOpen(false);
        } else {
          const collapsed = localStorage.getItem('tati_sidebar_collapsed') === 'true';
          setSidebarOpen(!collapsed);
        }
      } catch {
        const isMobile = window.innerWidth < 768;
        setSidebarOpen(isMobile ? false : true);
      }
    };

    syncState();

    const handleCustomChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') {
        setSidebarOpen(detail);
      } else {
        syncState();
      }
    };

    window.addEventListener('tati_sidebar_changed', handleCustomChange);
    window.addEventListener('storage', syncState);
    return () => {
      window.removeEventListener('tati_sidebar_changed', handleCustomChange);
      window.removeEventListener('storage', syncState);
    };
  }, []);

  const handleToggle = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          localStorage.setItem('tati_sidebar_collapsed', String(!next));
        }
        window.dispatchEvent(new CustomEvent('tati_sidebar_changed', { detail: next }));
      } catch {}
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSidebarOpen(false);
    try {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        localStorage.setItem('tati_sidebar_collapsed', 'true');
      }
      window.dispatchEvent(new CustomEvent('tati_sidebar_changed', { detail: false }));
    } catch {}
  }, []);

  const handleOpen = useCallback(() => {
    setSidebarOpen(true);
    try {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        localStorage.setItem('tati_sidebar_collapsed', 'false');
      }
      window.dispatchEvent(new CustomEvent('tati_sidebar_changed', { detail: true }));
    } catch {}
  }, []);

  return {
    sidebarOpen,
    toggleSidebar: handleToggle,
    closeSidebar: handleClose,
    openSidebar: handleOpen,
    setSidebarOpen,
  };
}
