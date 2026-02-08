import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            const contentType = proxyRes.headers['content-type'] || '';
            if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
              if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
              }
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
