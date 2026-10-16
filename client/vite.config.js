import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API is always reached through the client's own origin (/api), here via the
// dev proxy and in production via the Vercel rewrite, so the refresh cookie stays first-party.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5000' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // Form tests type key by key; with every file running in parallel they can pass 5 s.
    testTimeout: 15_000,
  },
});
