import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const bypassHtml = (req: any) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return '/index.html';
  }
};

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('http://127.0.0.1:8000'),
    'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify('http://127.0.0.1:8000'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/activities': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/exams': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/grammar': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/speech': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/profile': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/users': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/simulation': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/admin-games': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/admin-news': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
