import { defineConfig, devices } from '@playwright/test';
import { API_PORT, BASE_URL, ORIGIN_SECRET, TLS_DIR, WEB_PORT } from './e2e/support/env.js';

/**
 * End-to-end tests against the production build: `vite build` served by
 * `vite preview` (which forwards /api like the Vercel rewrite and sends the
 * vercel.json security headers, and like the /api route adds x-origin-secret)
 * in front of the API in production mode, with
 * a throwaway database and in-memory S3 storage. See e2e/README.md.
 */
const desktop = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...desktop },
      testIgnore: /mobile\.spec/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], ...desktop },
      testIgnore: /mobile\.spec/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], ...desktop },
      testIgnore: /mobile\.spec/,
    },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    {
      command: 'node e2e/support/stack.js',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `node e2e/support/cert.js && ${process.env.E2E_SKIP_BUILD ? '' : 'npm run build -w client && '}npm run preview -w client -- --port ${WEB_PORT} --strictPort`,
      url: BASE_URL,
      ignoreHTTPSErrors: true,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
        E2E_TLS_DIR: TLS_DIR,
        // Only the proxy knows the secret; the build step's secret scan checks it isn't bundled.
        PROXY_ORIGIN_SECRET: ORIGIN_SECRET,
      },
    },
  ],
});
