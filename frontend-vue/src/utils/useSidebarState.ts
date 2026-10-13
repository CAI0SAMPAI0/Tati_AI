import { ref } from 'vue';

const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
const initialCollapsed =
  typeof window !== 'undefined'
    ? localStorage.getItem('tati_sidebar_collapsed') === 'true'
    : false;

export const isSidebarOpen = ref(!isMobile && !initialCollapsed);

export function useSidebarState() {
  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('tati_sidebar_collapsed', String(!isSidebarOpen.value));
    }
  }

  function closeSidebar() {
    isSidebarOpen.value = false;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('tati_sidebar_collapsed', 'true');
    }
  }

  function openSidebar() {
    isSidebarOpen.value = true;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem('tati_sidebar_collapsed', 'false');
    }
  }

  return {
    sidebarOpen: isSidebarOpen,
    toggleSidebar,
    closeSidebar,
    openSidebar,
  };
}
