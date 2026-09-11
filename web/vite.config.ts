/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies the API so the auth cookie stays same-origin (no CORS / SameSite setup
// needed locally). The browser's Origin header is dropped on the way through: the backend would
// otherwise treat localhost:5173 -> localhost:8080 as a cross-origin request.
const backend = process.env.WAYPOINT_BACKEND ?? 'http://localhost:8080';

export default defineConfig({
  // Relative asset paths so the same build works at https://<user>.github.io/<repo>/ or any sub-path.
  base: './',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
      '/ws': {
        target: backend,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => proxy.on('proxyReqWs', (req) => req.removeHeader('origin')),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
