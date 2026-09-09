'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSidebarState() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize state based on localStorage and window size
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const collapsed = localStorage.getItem('tati_sidebar_collapsed') === 'true';
        const isMobile = window.innerWidth < 768;
        setSidebarOpen(isMobile ? false : !collapsed);
      } catch {
        const isMobile = window.innerWidth < 768;
        setSidebarOpen(isMobile ? false : true);
      }
    }
  }, []);

  const handleToggle = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tati_sidebar_collapsed', String(!next));
      } catch {}
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSidebarOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      try {
        localStorage.setItem('tati_sidebar_collapsed', 'true');
      } catch {}
    }
  }, []);

  const handleOpen = useCallback(() => {
    setSidebarOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      try {
        localStorage.setItem('tati_sidebar_collapsed', 'false');
      } catch {}
    }
  }, []);

  return {
    sidebarOpen,
    toggleSidebar: handleToggle,
    closeSidebar: handleClose,
    openSidebar: handleOpen,
    setSidebarOpen,
  };
}
