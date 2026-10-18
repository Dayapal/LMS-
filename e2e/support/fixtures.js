import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import { BASE_URL, TRAINER } from './env.js';

/**
 * Shared fixtures. Every test fails on an uncaught page error or a Content
 * Security Policy violation, so the production CSP (vercel.json, also served
 * by `vite preview`) is checked on every page the suite visits.
 */
export const test = base.extend({
  pageProblems: [
    async ({ page }, use) => {
      const problems = [];
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('console', (message) => {
        const text = message.text();
        if (
          /Content[- ]Security[- ]Policy|Refused to (load|execute|apply|frame|connect)/i.test(text)
        ) {
          problems.push(`CSP: ${text}`);
        }
      });
      await use(problems);
      expect(problems, 'page errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

let counter = 0;
/** A unique student for this test, browser and run. */
export function newStudent(testInfo, label = 'student') {
  counter += 1;
  const suffix = `${counter}${Math.random().toString(36).slice(2, 6)}`;
  const id = `${testInfo.project.name}-${Date.now().toString(36)}-${suffix}`;
  return {
    name: `E2E ${label} ${testInfo.project.name} ${suffix}`,
    email: `e2e.${label}.${id}@example.com`.toLowerCase(),
    password: 'E2eStudent123',
  };
}

/** Signs in through the login form and waits for the role's home page. */
export async function signIn(page, { email, password }, home = /\/(app|admin)$/) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  const loaded = homeLoaded(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(home);
  await loaded;
}

/**
 * Resolves once a role's home page has its data (dashboard and unread count).
 * A test that navigates away while those requests are in flight makes WebKit
 * report the cancelled requests as page errors ("… due to access control checks").
 * Start it before the action that opens the home page.
 */
export const homeLoaded = (page) =>
  Promise.all([
    page.waitForResponse(/\/api\/v1\/dashboard\/(student|admin)$/),
    page.waitForResponse(/\/api\/v1\/notifications\/unread-count$/),
  ]);

export async function register(page, student) {
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Full name' }).fill(student.name);
  await page.getByRole('textbox', { name: 'Email' }).fill(student.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(student.password);
  await page.getByRole('textbox', { name: 'Confirm password' }).fill(student.password);
  const response = page.waitForResponse('**/api/v1/auth/register');
  const loaded = homeLoaded(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await loaded;
  return response;
}

/**
 * A bearer-token API client for test setup and API-level checks. Goes through
 * the same /api proxy as the browser. `account` is signed in, or registered
 * first when it has a `name`.
 */
export async function apiAs(account = TRAINER) {
  const context = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });
  const path = account.name ? '/api/v1/auth/register' : '/api/v1/auth/login';
  const signin = await context.post(path, { data: account });
  expect(signin.ok(), `API sign-in for ${account.email}`).toBe(true);
  const { accessToken, user } = (await signin.json()).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const call = async (method, url, options = {}) => {
    const res = await context.fetch(`/api/v1${url}`, { method, headers, ...options });
    const type = res.headers()['content-type'] ?? '';
    const body = type.includes('json') ? await res.json() : await res.body();
    return { status: res.status(), headers: res.headers(), body };
  };
  return {
    user,
    get: (url) => call('GET', url),
    post: (url, data) => call('POST', url, { data: data ?? {} }),
    patch: (url, data) => call('PATCH', url, { data: data ?? {} }),
    upload: (url, file, fields = {}) => call('POST', url, { multipart: { ...fields, file } }),
    dispose: () => context.dispose(),
  };
}
