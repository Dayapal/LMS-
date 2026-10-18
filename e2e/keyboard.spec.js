import { expect, test } from './support/fixtures.js';
import { TRAINER } from './support/env.js';

test('sign-in works with the keyboard alone, with errors tied to their fields', async ({
  page,
}) => {
  await page.goto('/login');
  const email = page.getByRole('textbox', { name: 'Email' });
  const password = page.getByRole('textbox', { name: 'Password', exact: true });

  // An empty submit: each field is marked invalid and described by its message.
  await email.focus();
  await page.keyboard.press('Enter');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await email.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const message = await page.locator(`[id="${describedBy.split(' ')[0]}"]`).textContent();
  expect(message.trim().length).toBeGreaterThan(0);

  await email.fill(TRAINER.email);
  await password.fill(TRAINER.password);
  await password.press('Enter');
  await expect(page).toHaveURL(/\/admin$/);

  // Focus moves to the page after a client-side navigation.
  await page.getByRole('link', { name: 'Reviews' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/reviews$/);
  await expect(page.getByRole('main')).toBeFocused();
});

test('the skip link is the first stop and moves focus to the content', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit, like Safari by default, does not stop on links with Tab (Option+Tab does); checked manually',
  );
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(TRAINER.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(TRAINER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('a dialog keeps Tab inside and Escape closes it', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(TRAINER.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(TRAINER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Courses' }).first().click();
  const newCourse = page.getByRole('button', { name: /New course/ });
  await newCourse.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/course/i);

  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(newCourse).toBeFocused();
});
