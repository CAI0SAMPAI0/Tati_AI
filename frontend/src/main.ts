import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import './assets/styles/globals.css';

// Trata falhas de carregamento assíncrono de chunks do Vite (ex: novos deploys no Vercel)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Falha ao pré-carregar chunk do novo deploy. Recarregando a página...', event);
    const lastReload = sessionStorage.getItem('vite_preload_reload');
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 5000) {
      sessionStorage.setItem('vite_preload_reload', String(now));
      window.location.reload();
    }
  });
}

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin);

app.mount('#app');
