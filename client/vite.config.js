import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.HASH_FOOD_API_TARGET || 'http://127.0.0.1:3002';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5151,
    strictPort: true,
     allowedHosts: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest) => {
            proxyRequest.setHeader('origin', apiTarget);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
