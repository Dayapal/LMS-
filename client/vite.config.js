import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The page headers Vercel adds in production (CSP and friends). `vite preview`
// sends the same ones, so the production build is tested under the real policy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const pageHeaders = Object.fromEntries(
  vercel.headers
    .find((rule) => rule.source === '/(.*)')
    .headers.filter(({ key }) => key !== 'Strict-Transport-Security') // http://localhost
    .map(({ key, value }) => [key, value]),
);

// The API is always reached through the client's own origin (/api), here via the
// dev/preview proxy and in production via the Vercel /api route, so the refresh
// cookie stays first-party. Like that route, this proxy (never the browser) adds
// the x-origin-secret header when the API requires it: PROXY_ORIGIN_SECRET is
// read here, in Node, and isn't a VITE_ variable, so it never reaches the bundle.
const apiProxy = {
  target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5000',
  ...(process.env.PROXY_ORIGIN_SECRET && {
    headers: { 'x-origin-secret': process.env.PROXY_ORIGIN_SECRET },
  }),
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': apiProxy },
  },
  preview: {
    headers: pageHeaders,
    // The E2E suite serves the build over HTTPS with a throwaway certificate (e2e/support/cert.js).
    ...(process.env.E2E_TLS_DIR && {
      https: {
        key: readFileSync(`${process.env.E2E_TLS_DIR}/key.pem`),
        cert: readFileSync(`${process.env.E2E_TLS_DIR}/cert.pem`),
      },
    }),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // Form tests type key by key; with every file running in parallel they can pass 5 s.
    testTimeout: 15_000,
  },
});
