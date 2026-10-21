import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false);
  const theme = ref<'light' | 'dark' | 'system'>('system');

  function initTheme() {
    if (typeof window === 'undefined') return;
    const stored = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    setTheme(stored);
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const shouldBeDark =
      theme.value === 'dark' ||
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    isDark.value = shouldBeDark;
    if (shouldBeDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }

  function setTheme(t: 'light' | 'dark' | 'system') {
    theme.value = t;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', t);
    }
    applyTheme();
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  return {
    isDark,
    theme,
    initTheme,
    setTheme,
    toggleTheme,
  };
});
