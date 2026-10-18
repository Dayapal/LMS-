import { apiAs, expect, signIn, test } from './support/fixtures.js';
import { DEMO, TRAINER } from './support/env.js';

// Phone emulation (Pixel 7 in Chromium, iPhone 14 in WebKit): viewport, touch
// and user agent only. It is not a real device; see the manual checklist.

async function noSidewaysScroll(page, path) {
  await page.goto(path);
  await page.getByRole('main').waitFor();
  await expect(page.getByRole('status', { name: /^Loading/ })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  return overflow > 0 ? [`${path}: ${overflow}px`] : [];
}

async function mernIds() {
  const trainer = await apiAs(TRAINER);
  const mern = (await trainer.get('/courses?limit=100')).body.data.find(
    (c) => c.slug === 'full-stack-mern-development',
  );
  const roadmap = (await trainer.get(`/courses/${mern.id}/roadmap`)).body.data;
  await trainer.dispose();
  return { course: mern.id, lesson: roadmap.modules[0].lessons[0].id };
}

test('student pages fit the phone screen, and the menu and PDF viewer work', async ({ page }) => {
  test.setTimeout(180_000);
  const ids = await mernIds();
  await signIn(page, DEMO.aarav, /\/app$/);
  const course = `/app/courses/${ids.course}`;
  const overflowing = [];
  for (const path of [
    '/app',
    '/app/courses',
    course,
    `${course}/lessons/${ids.lesson}`,
    '/app/assignments',
    '/app/notifications',
    '/app/profile',
  ]) {
    overflowing.push(...(await noSidewaysScroll(page, path)));
  }
  expect(overflowing).toEqual([]);

  // The navigation is behind a menu button that traps and returns focus.
  await page.goto('/app');
  const open = page.getByRole('button', { name: 'Open navigation' });
  await open.click();
  const close = page.getByRole('button', { name: 'Close navigation' });
  await expect(close).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(close).toBeHidden();
  await expect(open).toBeFocused();

  // PDFs: the viewer gets a blob: URL, and phones that can't show a framed PDF
  // (iOS shows only the first page) get a link to open it in a new tab.
  await page.goto(`${course}/lessons/${ids.lesson}`);
  await page.getByRole('button', { name: 'View PDF' }).first().click();
  await expect(page.locator('iframe[title^="PDF viewer"]')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('link', { name: 'Open it in a new tab' })).toHaveAttribute(
    'href',
    /^blob:/,
  );
});

test('trainer pages fit the phone screen', async ({ page }) => {
  test.setTimeout(180_000);
  const ids = await mernIds();
  await signIn(page, TRAINER, /\/admin$/);
  const overflowing = [];
  for (const path of [
    '/admin',
    '/admin/courses',
    `/admin/courses/${ids.course}`,
    `/admin/courses/${ids.course}/lessons/${ids.lesson}`,
    '/admin/reviews',
    '/admin/students',
    '/admin/reports',
    `/admin/reports/courses/${ids.course}`,
    '/admin/notifications',
  ]) {
    overflowing.push(...(await noSidewaysScroll(page, path)));
  }
  expect(overflowing).toEqual([]);
});
