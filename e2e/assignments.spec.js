import { apiAs, expect, newStudent, register, signIn, test } from './support/fixtures.js';
import { TRAINER } from './support/env.js';
import { makePdf } from './support/pdf.js';

const ASSIGNMENT = 'Big-O Analysis Worksheet'; // seeded in DSA: PDF or code, 30 marks

test('a student hands in a PDF, the trainer grades it, and the student sees the feedback', async ({
  page,
  browser,
}, testInfo) => {
  const student = newStudent(testInfo, 'submitter');
  await register(page, student);

  // Setup through the API: the trainer enrolls the student in DSA directly.
  const trainerApi = await apiAs(TRAINER);
  const { body: courses } = await trainerApi.get('/courses?limit=100');
  const dsa = courses.data.find((c) => c.slug === 'dsa-with-javascript');
  expect(
    (await trainerApi.post('/admin/enrollments', { courseId: dsa.id, email: student.email }))
      .status,
  ).toBe(201);
  await trainerApi.dispose();

  // The student hands in a PDF.
  await page.getByRole('link', { name: 'Assignments' }).first().click();
  await page.getByRole('link', { name: ASSIGNMENT }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: ASSIGNMENT })).toBeVisible();
  await page.getByLabel('PDF file').setInputFiles({
    name: 'big-o-answers.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf('My Big-O answers'),
  });
  const upload = page.waitForResponse(/\/api\/v1\/assignments\/[0-9a-f]{24}\/files$/);
  await page.getByRole('button', { name: 'Submit' }).click();
  expect((await upload).status()).toBe(201);
  await expect(page.getByText('big-o-answers.pdf').first()).toBeVisible();

  // The trainer finds it in the review queue and grades it.
  const trainerContext = await browser.newContext();
  const trainer = await trainerContext.newPage();
  await signIn(trainer, TRAINER, /\/admin$/);
  await trainer.getByRole('link', { name: 'Reviews' }).first().click();
  await trainer
    .getByRole('link', { name: `Review ${student.name}'s submission for ${ASSIGNMENT}` })
    .click();
  await expect(trainer.getByText(/not scanned for viruses/)).toBeVisible();
  await trainer.getByRole('button', { name: 'View PDF' }).click();
  await expect(trainer.locator('iframe[title^="PDF viewer"]')).toHaveAttribute('src', /^blob:/);
  await trainer.getByRole('spinbutton', { name: /Marks \(out of 30\)/ }).fill('27');
  await trainer
    .getByRole('textbox', { name: 'Feedback' })
    .fill('Clear reasoning on the nested loops.');
  await trainer.getByRole('button', { name: 'Save review' }).click();
  await expect(trainer.getByRole('button', { name: 'Update review' })).toBeVisible();
  await trainerContext.close();

  // The student is notified and sees the marks and feedback.
  await page.reload();
  await expect(page.getByRole('button', { name: /Notifications, 1 unread/ }).first()).toBeVisible();
  await expect(page.getByText('Clear reasoning on the nested loops.')).toBeVisible();
  await expect(page.getByText(/27/).first()).toBeVisible();
});
