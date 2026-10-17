import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Course, Enrollment, LessonProgress, Submission, User } from '../src/models/index.js';
import { api, createUser } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { DAY, fromNow, makeAssignment, makeSubmission } from './assignment-helpers.js';

let app;
let admin;

beforeEach(async () => {
  app = createApp();
  ({ admin } = await actors());
});

const get = (user, path, query = {}) =>
  api(app).get(`/api/v1${path}`).query(query).set(bearer(user));
const names = (res) => res.body.data.map((row) => row.name);

const complete = (user, lesson, at = new Date()) =>
  LessonProgress.create({
    user: user._id,
    course: lesson.course,
    lesson: lesson._id,
    completedAt: at,
  });

/**
 * Course A counts 3 lessons (a draft one doesn't count); course B counts 2.
 * - Asha: active in A with all 3 done, and a pending request for B; her
 *   assignment in A is waiting for review
 * - Vikram: active in A (1 of 3) and B (0 of 2); overdue on one assignment in each
 * - Kiran: removed from A, with 2 completions and a reviewed submission kept
 * - Zoe: no enrollments
 */
async function fixture() {
  // `actors()` already made two students; these are the named ones for the list.
  const [asha, vikram, kiran, zoe] = await Promise.all(
    ['Asha Rao', 'Vikram Shah', 'Kiran Das', 'Zoe Lee'].map((name, i) =>
      createUser({ name, createdAt: new Date(Date.UTC(2026, 0, i + 1)) }),
    ),
  );
  const a = await makeCourse({
    shape: [{ lessons: ['published', 'published'] }, { lessons: ['published', 'draft'] }],
  });
  const b = await makeCourse({ shape: [{ lessons: ['published', 'published'] }] });
  const [a1, a2] = a.modules[0].lessons;
  const [a3] = a.modules[1].lessons;
  await Promise.all([
    enroll(asha, a.course),
    enroll(asha, b.course, 'pending'),
    enroll(vikram, a.course),
    enroll(vikram, b.course),
    enroll(kiran, a.course, 'removed'),
  ]);
  await Promise.all([
    complete(asha, a1),
    complete(asha, a2),
    complete(asha, a3),
    complete(vikram, a1),
    complete(kiran, a1),
    complete(kiran, a2),
  ]);
  const pastA = await makeAssignment(a.course, { title: 'Past A', dueAt: fromNow(-DAY) });
  const pastB = await makeAssignment(b.course, { title: 'Past B', dueAt: fromNow(-2 * DAY) });
  await makeAssignment(a.course, { title: 'Future A', dueAt: fromNow(3 * DAY) });
  await makeSubmission(pastA, asha, { submittedAt: fromNow(-2 * DAY) });
  await makeSubmission(pastA, kiran, {
    submittedAt: fromNow(-2 * DAY),
    status: 'reviewed',
    review: {
      marks: 80,
      finalMarks: 80,
      feedback: 'Good',
      reviewedBy: admin._id,
      reviewedAt: new Date(),
    },
  });
  return { asha, vikram, kiran, zoe, a, b, pastA, pastB };
}

/** Names in the list, without the two unnamed "Student" accounts from actors(). */
const namedOnly = (res) => names(res).filter((name) => name !== 'Student');

describe('GET /admin/students', () => {
  it('lists students by name with enrollments, progress, reviews and overdue work', async () => {
    const f = await fixture();
    const res = await get(admin, '/admin/students', { limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(6);
    expect(names(res)).toEqual([
      'Asha Rao',
      'Kiran Das',
      'Student',
      'Student',
      'Vikram Shah',
      'Zoe Lee',
    ]);
    const rows = Object.fromEntries(res.body.data.map((row) => [row.name, row]));

    expect(rows['Asha Rao']).toMatchObject({
      id: f.asha.id,
      email: f.asha.email,
      enrollments: { active: 1, pending: 1, removed: 0 },
      awaitingReview: 1,
      overdue: 0,
    });
    const ashaCourses = Object.fromEntries(rows['Asha Rao'].courses.map((c) => [c.id, c]));
    expect(ashaCourses[f.a.course.id]).toMatchObject({
      enrollmentStatus: 'active',
      progress: { completedLessons: 3, totalLessons: 3, percent: 100, completed: true },
    });
    expect(ashaCourses[f.b.course.id]).toMatchObject({
      enrollmentStatus: 'pending',
      progress: null,
    });

    expect(rows['Vikram Shah']).toMatchObject({ awaitingReview: 0, overdue: 2 });
    expect(rows['Kiran Das']).toMatchObject({
      enrollments: { active: 0, pending: 0, removed: 1 },
      overdue: 0,
    });
    // Removed enrollments keep their progress.
    expect(rows['Kiran Das'].courses[0].progress).toMatchObject({
      completedLessons: 2,
      percent: 66,
    });
    expect(rows['Zoe Lee']).toMatchObject({
      courses: [],
      enrollments: { active: 0, pending: 0, removed: 0 },
    });
    // Never the password hash or session data.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });

  it('searches names and emails', async () => {
    const f = await fixture();
    expect(names(await get(admin, '/admin/students', { q: 'vik' }))).toEqual(['Vikram Shah']);
    expect(names(await get(admin, '/admin/students', { q: f.zoe.email }))).toEqual(['Zoe Lee']);
    expect((await get(admin, '/admin/students', { q: '(' })).body.data).toEqual([]);
  });

  it('filters by course, enrollment status and learning state', async () => {
    const f = await fixture();
    const list = async (query) => namedOnly(await get(admin, '/admin/students', query));
    expect(await list({ course: f.a.course.id })).toEqual(['Asha Rao', 'Kiran Das', 'Vikram Shah']);
    expect(await list({ course: f.a.course.id, enrollment: 'active' })).toEqual([
      'Asha Rao',
      'Vikram Shah',
    ]);
    expect(await list({ enrollment: 'pending' })).toEqual(['Asha Rao']);
    expect(await list({ enrollment: 'removed' })).toEqual(['Kiran Das']);
    expect(await list({ enrollment: 'none' })).toEqual(['Zoe Lee']);
    expect(await list({ course: f.b.course.id, enrollment: 'none' })).toEqual([
      'Kiran Das',
      'Zoe Lee',
    ]);

    expect(await list({ learning: 'to_review' })).toEqual(['Asha Rao']);
    expect(await list({ learning: 'overdue' })).toEqual(['Vikram Shah']);
    expect(await list({ learning: 'completed' })).toEqual(['Asha Rao']);
    expect(await list({ learning: 'in_progress' })).toEqual(['Vikram Shah']);
    expect(await list({ learning: 'not_started' })).toEqual(['Vikram Shah']);
    expect(await list({ learning: 'not_started', course: f.a.course.id })).toEqual([]);
    expect(await list({ learning: 'overdue', course: f.b.course.id })).toEqual(['Vikram Shah']);
    // Removed students are not "in progress": only active enrollments count.
    expect(await list({ learning: 'in_progress', course: f.a.course.id })).toEqual(['Vikram Shah']);
  });

  it('paginates and sorts', async () => {
    await fixture();
    const first = await get(admin, '/admin/students', { limit: 4 });
    expect(first.body.meta).toMatchObject({ total: 6, totalPages: 2 });
    expect(first.body.data).toHaveLength(4);
    expect((await get(admin, '/admin/students', { limit: 4, page: 2 })).body.data).toHaveLength(2);
    expect((await get(admin, '/admin/students', { limit: 4, page: 3 })).body.data).toEqual([]);
    const newest = await get(admin, '/admin/students', { sort: 'newest' });
    // Newest sign-up first: the named students signed up on Jan 4, 3, 2 and 1.
    expect(namedOnly(newest)).toEqual(['Zoe Lee', 'Kiran Das', 'Vikram Shah', 'Asha Rao']);
  });

  it('is empty when there are no students', async () => {
    await User.deleteMany({ role: 'student' });
    const res = await get(admin, '/admin/students');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ total: 0, totalPages: 1 });
  });

  it('validates the query and is for the trainer only', async () => {
    const f = await fixture();
    for (const query of [
      { limit: 0 },
      { limit: 101 },
      { page: -1 },
      { enrollment: 'banned' },
      { learning: 'lazy' },
      { course: 'x' },
      { sort: 'email' },
    ]) {
      expect((await get(admin, '/admin/students', query)).status, JSON.stringify(query)).toBe(400);
    }
    const brackets = await api(app)
      .get('/api/v1/admin/students?role[$ne]=student')
      .set(bearer(admin));
    expect(brackets.status).toBe(200);
    // Still students only: the trainer never appears in the list.
    expect(brackets.body.data.every((row) => row.id !== admin.id)).toBe(true);

    expect((await get(f.asha, '/admin/students')).status).toBe(403);
    expect((await get(f.asha, `/admin/students/${f.vikram.id}`)).status).toBe(403);
    expect((await get(f.asha, `/reports/students/${f.asha.id}`)).status).toBe(403);
    expect((await api(app).get('/api/v1/admin/students')).status).toBe(401);
  });
});

describe('GET /admin/students/:id', () => {
  it('shows the profile, every enrollment with progress, and assignment states', async () => {
    const f = await fixture();
    const res = await get(admin, `/admin/students/${f.asha.id}`);
    expect(res.status).toBe(200);
    const { student, summary, enrollments } = res.body.data;
    expect(student).toMatchObject({ id: f.asha.id, name: 'Asha Rao', email: f.asha.email });
    expect(student).not.toHaveProperty('passwordHash');
    expect(summary).toMatchObject({
      activeCourses: 1,
      pendingRequests: 1,
      removedCourses: 0,
      completedCourses: 1,
      lessonsCompleted: 3,
      awaitingReview: 1,
    });
    const byCourse = Object.fromEntries(enrollments.map((e) => [e.course.id, e]));
    expect(byCourse[f.a.course.id]).toMatchObject({
      status: 'active',
      awaitingReview: 1,
      overdue: 0,
      progress: { percent: 100, completed: true },
    });
    expect(byCourse[f.b.course.id]).toMatchObject({ status: 'pending', progress: null });
    expect(byCourse[f.b.course.id].id).toEqual(expect.any(String));
  });

  it('counts the same assignment states the student sees on their own page', async () => {
    const f = await fixture();
    for (const who of [f.asha, f.vikram, f.kiran, f.zoe]) {
      const detail = await get(admin, `/admin/students/${who.id}`);
      const own = await get(who, '/me/assignments');
      expect(detail.body.data.summary.assignments).toEqual(own.body.meta.counts);
    }
    const vikram = await get(admin, `/admin/students/${f.vikram.id}`);
    expect(vikram.body.data.summary.assignments).toMatchObject({ overdue: 2, pending: 1 });
    expect(vikram.body.data.enrollments.map((e) => e.overdue).sort()).toEqual([1, 1]);
  });

  it('keeps history when an enrollment is removed or a course archived', async () => {
    const f = await fixture();
    await Enrollment.updateOne(
      { user: f.vikram._id, course: f.a.course._id },
      { status: 'removed' },
    );
    await Course.updateOne({ _id: f.b.course._id }, { status: 'archived' });
    await makeSubmission(f.pastB, f.vikram, { submittedAt: fromNow(-DAY) });

    const res = await get(admin, `/admin/students/${f.vikram.id}`);
    const byCourse = Object.fromEntries(res.body.data.enrollments.map((e) => [e.course.id, e]));
    expect(byCourse[f.a.course.id]).toMatchObject({
      status: 'removed',
      progress: { completedLessons: 1, totalLessons: 3 },
    });
    expect(byCourse[f.b.course.id]).toMatchObject({
      status: 'active',
      course: { status: 'archived' },
      awaitingReview: 1,
    });
    // The student no longer sees either course, but nothing was deleted.
    expect((await get(f.vikram, '/me/courses')).body.data).toEqual([]);
    expect(await LessonProgress.countDocuments({ user: f.vikram._id })).toBe(1);

    const report = await get(admin, `/reports/students/${f.vikram.id}`);
    expect(report.body.data.submissions.map((s) => s.assignment.title)).toEqual(['Past B']);
    expect(report.body.data.courses.map((c) => [c.course.id, c.enrollmentStatus]).sort()).toEqual(
      [
        [f.a.course.id, 'removed'],
        [f.b.course.id, 'active'],
      ].sort(),
    );

    // Re-enrolling brings the same progress back.
    await Enrollment.updateOne(
      { user: f.vikram._id, course: f.a.course._id },
      { status: 'active' },
    );
    const again = await get(admin, `/admin/students/${f.vikram.id}`);
    expect(again.body.data.summary.lessonsCompleted).toBe(1);
  });

  it('supports the existing enrollment actions', async () => {
    const f = await fixture();
    const pending = (await get(admin, `/admin/students/${f.asha.id}`)).body.data.enrollments.find(
      (e) => e.status === 'pending',
    );
    const approve = await api(app)
      .patch(`/api/v1/admin/enrollments/${pending.id}`)
      .set(bearer(admin))
      .send({ status: 'active' });
    expect(approve.status).toBe(200);
    const enrollZoe = await api(app)
      .post('/api/v1/admin/enrollments')
      .set(bearer(admin))
      .send({ courseId: f.a.course.id, email: f.zoe.email });
    expect(enrollZoe.status).toBe(201);

    const asha = (await get(admin, `/admin/students/${f.asha.id}`)).body.data;
    expect(asha.summary).toMatchObject({ activeCourses: 2, pendingRequests: 0 });
    expect(asha.enrollments.find((e) => e.course.id === f.b.course.id).progress).toMatchObject({
      completedLessons: 0,
      totalLessons: 2,
    });
    const zoe = (await get(admin, `/admin/students/${f.zoe.id}`)).body.data;
    expect(zoe.summary).toMatchObject({ activeCourses: 1 });
    // Zoe now sees the overdue assignment in A, like every active student.
    expect(zoe.summary.assignments.overdue).toBe(1);
  });

  it('is 404 for unknown ids and for the trainer, 400 for malformed ids', async () => {
    await fixture();
    expect((await get(admin, '/admin/students/64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await get(admin, `/admin/students/${admin.id}`)).status).toBe(404);
    expect((await get(admin, `/reports/students/${admin.id}`)).status).toBe(404);
    expect((await get(admin, '/admin/students/nope')).status).toBe(400);
  });
});

describe('GET /reports/students/:id', () => {
  it('reports progress by module, assignment states, submissions, marks and activity', async () => {
    const f = await fixture();
    // Real requests, so they are logged.
    await api(app).post(`/api/v1/courses/${f.b.course.id}/enroll`).set(bearer(f.zoe));
    const res = await get(admin, `/reports/students/${f.asha.id}`);
    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.student).toMatchObject({ id: f.asha.id, name: 'Asha Rao' });
    // Pending courses are left out; the draft lesson doesn't count.
    expect(report.courses).toHaveLength(1);
    expect(report.courses[0]).toMatchObject({
      course: { id: f.a.course.id },
      enrollmentStatus: 'active',
      progress: { completedLessons: 3, totalLessons: 3, percent: 100, completed: true },
    });
    expect(
      report.courses[0].modules.map((m) => [m.completedLessons, m.totalLessons, m.percent]),
    ).toEqual([
      [2, 2, 100],
      [1, 1, 100],
    ]);
    expect(report.assignments.counts).toMatchObject({ all: 2, submitted: 1, pending: 1 });
    expect(report.assignments.items.map((a) => [a.title, a.state])).toEqual([
      ['Past A', 'submitted'],
      ['Future A', 'pending'],
    ]);
    expect(report.submissions).toHaveLength(1);
    expect(report.submissions[0]).toMatchObject({ attempt: 1, attempts: 1, status: 'submitted' });
    expect(report.submissions[0]).not.toHaveProperty('items');
    expect(report.marks).toEqual({ reviewed: 0, averagePercent: null });
    expect(report.activity).toEqual([]);

    const kiran = (await get(admin, `/reports/students/${f.kiran.id}`)).body.data;
    expect(kiran.marks).toEqual({ reviewed: 1, averagePercent: 80 });
    expect(kiran.courses[0]).toMatchObject({
      enrollmentStatus: 'removed',
      progress: { percent: 66 },
    });
    // Removed from the course: no current assignments, but the history stays.
    expect(kiran.assignments.items).toEqual([]);
    expect(kiran.submissions[0].review).toMatchObject({ marks: 80, finalMarks: 80 });

    const zoe = (await get(admin, `/reports/students/${f.zoe.id}`)).body.data;
    expect(zoe.activity.map((a) => [a.type, a.course?.id])).toEqual([
      ['enrollment_requested', f.b.course.id],
    ]);
    expect(await Submission.countDocuments()).toBe(2);
  });
});
