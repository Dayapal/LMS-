import { expect, newStudent, register, signIn, test } from './support/fixtures.js';
import { TRAINER } from './support/env.js';

const MERN = 'Full-Stack MERN Development';

test('a student requests a course, the trainer approves, and the student studies a lesson with its PDF', async ({
  page,
  browser,
}, testInfo) => {
  const student = newStudent(testInfo, 'learner');
  await register(page, student);

  // Request enrollment from the catalogue.
  await page.getByRole('link', { name: 'Courses' }).first().click();
  await page.getByRole('link', { name: MERN }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: MERN })).toBeVisible();
  await page.getByRole('button', { name: 'Request enrollment' }).click();
  await expect(page.getByText('Request sent.')).toBeVisible();

  // The trainer approves it from the dashboard.
  const trainerContext = await browser.newContext();
  const trainer = await trainerContext.newPage();
  await signIn(trainer, TRAINER, /\/admin$/);
  const requests = trainer.getByRole('region', { name: 'Enrollment requests' });
  await requests.getByRole('button', { name: `Approve ${student.name} for ${MERN}` }).click();
  await expect(trainer.getByText(`${student.name} enrolled.`)).toBeVisible();
  await trainerContext.close();

  // The lessons open for the student.
  await page.reload();
  await expect(page.getByText(/You.re enrolled in this course/)).toBeVisible();
  await page.getByRole('link', { name: /^Start: / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How the Web Works' })).toBeVisible();

  // The seeded cheat sheet: fetched with the bearer token from S3 storage, shown from a blob: URL.
  const pdfResponse = page.waitForResponse(/\/api\/v1\/files\/[0-9a-f]{24}$/);
  await page.getByRole('button', { name: 'View PDF' }).first().click();
  const response = await pdfResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect(response.headers()['cache-control']).toBe('private, no-store');
  const viewer = page.locator('iframe[title^="PDF viewer"]');
  await expect(viewer).toHaveAttribute('src', /^blob:/);

  // The file URL itself is useless without the in-memory token.
  const direct = await page.request.get(new URL(response.url()).pathname);
  expect(direct.status()).toBe(404);

  // Completing the lesson reports progress inside the lesson's own panel.
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  const panel = page.getByRole('region', { name: 'Lesson completion' });
  await expect(panel).toContainText('Lesson completed.');
  await expect(page.getByRole('button', { name: 'Mark as not completed' })).toBeVisible();

  const dashboard = page.waitForResponse(/\/api\/v1\/dashboard\/student$/);
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await dashboard;
  await expect(page.getByText(/1 of \d+ lessons/).first()).toBeVisible();
});
