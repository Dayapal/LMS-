import AxeBuilder from '@axe-core/playwright';
import { apiAs, expect, newStudent, signIn, test } from './support/fixtures.js';
import { DEMO, TRAINER } from './support/env.js';

/**
 * Automated WCAG 2.2 A/AA scan (axe-core) of every main page, as an anonymous
 * visitor, a student with progress and graded work (seeded Aarav) and the
 * trainer. Automated checks find only part of the WCAG issues; the manual
 * checklist is in docs/phase-reports/phase-8.md.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page, path) {
  await page.goto(path);
  await page.getByRole('main').waitFor();
  // Let lazy pages and their data settle: no loading indicators left.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('status', { name: /^Loading/ })).toHaveCount(0);
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => ({
    page: path,
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

/**
 * Ids for the seeded pages, looked up as the trainer. A fresh student also
 * hands in work, so the trainer's pages always include an unread notification
 * and a submission waiting for review, whatever ran before.
 */
async function seededIds() {
  const trainer = await apiAs(TRAINER);
  const courses = (await trainer.get('/courses?limit=100')).body.data;
  const mern = courses.find((c) => c.slug === 'full-stack-mern-development');
  const roadmap = (await trainer.get(`/courses/${mern.id}/roadmap`)).body.data;
  const lesson = roadmap.modules[0].lessons[0];
  const reviewed = (await trainer.get('/admin/submissions?status=reviewed&q=aarav')).body.data[0];

  const student = await apiAs(newStudent(test.info(), 'axe'));
  await trainer.post('/admin/enrollments', { courseId: mern.id, email: student.user.email });
  const handedIn = await student.post(`/assignments/${reviewed.assignment.id}/submissions`, {
    items: [{ type: 'github_url', url: 'https://github.com/e2e-axe/profile-page' }],
  });
  expect(handedIn.status).toBe(201);
  await Promise.all([trainer.dispose(), student.dispose()]);
  return {
    course: mern.id,
    lesson: lesson.id,
    assignment: reviewed.assignment.id,
    submission: reviewed.id,
    student: reviewed.student.id,
  };
}

test.describe('axe scan (WCAG 2.2 A and AA)', () => {
  // Up to 16 pages per test; Firefox and WebKit run axe more slowly.
  test.describe.configure({ timeout: 300_000 });

  test('anonymous pages', async ({ page }) => {
    const violations = [];
    for (const path of ['/login', '/register', '/no-such-page'])
      violations.push(...(await scan(page, path)));
    expect(violations).toEqual([]);
  });

  test('student pages', async ({ page }) => {
    const ids = await seededIds();
    await signIn(page, DEMO.aarav, /\/app$/);
    const course = `/app/courses/${ids.course}`;
    const violations = [];
    for (const path of [
      '/app',
      '/app/courses',
      course,
      `${course}/lessons/${ids.lesson}`,
      '/app/assignments',
      `${course}/assignments/${ids.assignment}`,
      '/app/notifications',
      '/app/profile',
    ]) {
      violations.push(...(await scan(page, path)));
    }
    expect(violations).toEqual([]);
  });

  test('trainer pages', async ({ page }) => {
    const ids = await seededIds();
    await signIn(page, TRAINER, /\/admin$/);
    const course = `/admin/courses/${ids.course}`;
    const violations = [];
    for (const path of [
      '/admin',
      '/admin/courses',
      course,
      `${course}/lessons/${ids.lesson}`,
      `${course}/lessons/${ids.lesson}/preview`,
      `${course}/assignments/new`,
      `${course}/assignments/${ids.assignment}`,
      `${course}/assignments/${ids.assignment}/edit`,
      `${course}/assignments/${ids.assignment}/submissions/${ids.submission}`,
      '/admin/reviews',
      '/admin/students',
      `/admin/students/${ids.student}`,
      '/admin/reports',
      `/admin/reports/courses/${ids.course}`,
      '/admin/notifications',
      '/admin/profile',
    ]) {
      violations.push(...(await scan(page, path)));
    }
    expect(violations).toEqual([]);
  });

  test('a form dialog (add a note, with its live preview)', async ({ page }) => {
    const ids = await seededIds();
    await signIn(page, TRAINER, /\/admin$/);
    await page.goto(`/admin/courses/${ids.course}/lessons/${ids.lesson}`);
    await page.getByRole('button', { name: 'Add note' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add note' });
    await dialog
      .getByRole('textbox', { name: /Note \(Markdown\)/ })
      .fill('## Heading\n\nSome **bold** text.');
    await expect(dialog.getByRole('heading', { name: 'Heading' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(TAGS)
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
