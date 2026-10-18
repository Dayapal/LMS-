import { expect, homeLoaded, newStudent, register, signIn, test } from './support/fixtures.js';
import { TRAINER } from './support/env.js';

test.describe('sign-in and the refresh cookie', () => {
  test('a new student registers, stays signed in across reloads and signs out', async ({
    page,
    context,
  }, testInfo) => {
    const student = newStudent(testInfo);
    const response = await register(page, student);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // What the API sent through the proxy (spec §11a)…
    const setCookie = (await response.headerValue('set-cookie')) ?? '';
    const attributes = setCookie.split(';').map((part) => part.trim().toLowerCase());
    expect(attributes).toEqual(
      expect.arrayContaining(['httponly', 'secure', 'samesite=lax', 'path=/api/v1/auth']),
    );
    expect(attributes.some((a) => a.startsWith('domain='))).toBe(false);
    // …and what the browser stored: a host-only cookie for the app's own origin.
    // (Playwright's WebKit on Windows reports every cookie's SameSite as "None",
    // so the browser-side SameSite value is only checked in the other engines.)
    const [cookie] = (await context.cookies()).filter((c) => c.name === 'lms_rt');
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      path: '/api/v1/auth',
      domain: 'localhost',
    });
    if (testInfo.project.name !== 'webkit') expect(cookie.sameSite).toBe('Lax');
    // The access token is kept in memory only.
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).toBe(
      '{}',
    );

    // A reload loses the in-memory token; the cookie restores the session.
    const reloaded = homeLoaded(page);
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await reloaded;
    await expect(page.getByRole('link', { name: 'Courses' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).filter((c) => c.name === 'lms_rt')).toEqual([]);
  });

  test('wrong credentials show an error and no session', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(TRAINER.email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('not-the-password1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).filter((c) => c.name === 'lms_rt')).toEqual([]);
  });

  test('a student is kept out of the trainer area, and the trainer out of the student area', async ({
    page,
    browser,
  }, testInfo) => {
    await register(page, newStudent(testInfo));
    const redirected = homeLoaded(page);
    await page.goto('/admin/students');
    await expect(page).toHaveURL(/\/app$/);
    await redirected;

    const trainerContext = await browser.newContext();
    const trainerPage = await trainerContext.newPage();
    await signIn(trainerPage, TRAINER, /\/admin$/);
    const trainerHome = homeLoaded(trainerPage);
    await trainerPage.goto('/app/assignments');
    await expect(trainerPage).toHaveURL(/\/admin$/);
    await trainerHome;
    await trainerContext.close();
  });

  test('a stolen, already-rotated refresh token signs that device out', async ({
    page,
    context,
  }, testInfo) => {
    await register(page, newStudent(testInfo));
    const [original] = (await context.cookies()).filter((c) => c.name === 'lms_rt');

    // Rotate once (a reload refreshes), then replay the old token after the grace window.
    const reloaded = homeLoaded(page);
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await reloaded;
    await page.waitForTimeout(11_000);
    const replay = await page.request.post('/api/v1/auth/refresh', {
      headers: { Origin: new URL(page.url()).origin, Cookie: `lms_rt=${original.value}` },
    });
    expect(replay.status()).toBe(401);

    // The whole family is revoked: the current tab's session is gone too.
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
  });
});
