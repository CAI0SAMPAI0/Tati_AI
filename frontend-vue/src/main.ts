import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import router from './router';
import App from './App.vue';
import './globals.css';

const app = createApp(App);
const pinia = createPinia();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount('#app');
