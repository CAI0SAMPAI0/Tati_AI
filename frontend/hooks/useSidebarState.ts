'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSidebarState() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize state based on localStorage and window size
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const collapsed = localStorage.getItem('tati_sidebar_collapsed') === 'true';
      const isMobile = window.innerWidth < 768;
      setSidebarOpen(isMobile ? false : !collapsed);
    }
  }, []);

  const handleToggle = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('tati_sidebar_collapsed', String(!next));
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSidebarOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('tati_sidebar_collapsed', 'true');
    }
  }, []);

  const handleOpen = useCallback(() => {
    setSidebarOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('tati_sidebar_collapsed', 'false');
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
