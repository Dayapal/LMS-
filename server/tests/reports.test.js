import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Course, User } from '../src/models/index.js';
import { seedAssignments, seedCourses, seedDemoStudents } from '../src/seeds/course.seed.js';
import { seedDemoProgress } from '../src/seeds/progress.seed.js';
import { DEMO_PROGRESS, DEMO_SUBMISSIONS } from '../src/seeds/data/demoProgress.js';
import mern from '../src/seeds/data/mern.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { school } from './trainer-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const get = (path, query = {}, user = admin) =>
  api(app).get(`/api/v1${path}`).query(query).set(bearer(user));

describe('GET /reports/courses', () => {
  it('summarises every course, archived ones included, with totals', async () => {
    const f = await school(admin);
    const res = await get('/reports/courses');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.id).sort()).toEqual(
      [f.a.course.id, f.b.course.id, f.d.course.id, f.z.course.id].sort(),
    );
    const a = res.body.data.find((c) => c.id === f.a.course.id);
    expect(a).toMatchObject({ progress: { averagePercent: 75 }, overdue: 1 });
    expect(a).not.toHaveProperty('distribution');
    expect(res.body.meta).toMatchObject({ total: 4, page: 1, limit: 50 });
    expect(res.body.meta.totals).toEqual({
      courses: 4,
      enrollments: { active: 3, pending: 1, removed: 1 },
      completedEnrollments: 1,
      publishedAssignments: 4,
      reviews: { submitted: 2, resubmitted: 0, resubmit_requested: 0, reviewed: 1 },
      overdue: 2,
    });

    // The dashboard's course rows are the same numbers.
    const dashboard = await get('/dashboard/admin');
    expect(dashboard.body.data.courses.find((c) => c.id === f.a.course.id)).toEqual(a);
  });

  it('filters by status and title', async () => {
    const f = await school(admin);
    const archived = await get('/reports/courses', { status: 'archived' });
    expect(archived.body.data.map((c) => c.id)).toEqual([f.z.course.id]);
    expect(archived.body.meta.totals.courses).toBe(1);
    const titled = await get('/reports/courses', { q: f.b.course.title });
    expect(titled.body.data.map((c) => c.id)).toContain(f.b.course.id);
    expect((await get('/reports/courses', { q: 'no such course' })).body).toMatchObject({
      data: [],
      meta: { total: 0, totals: { courses: 0, overdue: 0 } },
    });
    expect((await get('/reports/courses', { status: 'gone' })).status).toBe(400);
    expect((await get('/reports/courses', { limit: 1000 })).status).toBe(400);
  });
});

describe('GET /reports/courses/:id', () => {
  it('reports class progress, module completion, assignments and students', async () => {
    const f = await school(admin);
    const res = await get(`/reports/courses/${f.a.course.id}`);
    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.course).toMatchObject({
      id: f.a.course.id,
      lessons: 2,
      modules: 1,
      enrollments: { active: 2, pending: 1, removed: 0 },
      progress: { students: 2, averagePercent: 75, completedStudents: 1 },
    });
    expect(report.distribution.map((band) => [band.label, band.students])).toEqual([
      ['Not started', 0],
      ['1–24%', 0],
      ['25–49%', 0],
      ['50–74%', 1],
      ['75–99%', 0],
      ['Completed', 1],
    ]);
    // 3 completions out of 2 lessons × 2 active students.
    expect(report.modules).toEqual([
      expect.objectContaining({ lessons: 2, completions: 3, percent: 75 }),
    ]);

    const rows = Object.fromEntries(report.assignments.map((a) => [a.title, a]));
    expect(report.assignments.map((a) => a.title)).toEqual([
      'Past A',
      'Draft A',
      'Soon A',
      'Later A',
    ]);
    expect(rows['Past A'].stats).toMatchObject({
      openToStudents: true,
      expected: 2,
      handedIn: 1,
      pending: 0,
      overdue: 1,
      submitted: 1,
      reviewed: 0,
      averageMarks: null,
    });
    expect(rows['Draft A'].stats).toMatchObject({ openToStudents: false, expected: 0, overdue: 0 });
    expect(rows['Soon A'].stats).toMatchObject({
      handedIn: 1,
      pending: 1,
      reviewed: 1,
      averageMarks: 45,
    });
    expect(rows['Later A'].stats).toMatchObject({ expected: 2, handedIn: 0, pending: 2 });

    expect(report.students.map((s) => [s.student.name, s.progress.percent, s.overdue])).toEqual([
      ['Asha Rao', 100, 0],
      ['Bela Iyer', 50, 1],
    ]);
    expect(report.students[0]).toMatchObject({
      status: 'active',
      reviews: { all: 2, submitted: 1, reviewed: 1 },
      progress: { completedLessons: 2, totalLessons: 2, completed: true },
    });
    expect(res.body.meta).toMatchObject({ total: 2, page: 1, totalPages: 1 });
  });

  it('sorts, searches, pages and switches to pending or removed students', async () => {
    const f = await school(admin);
    const path = `/reports/courses/${f.a.course.id}`;
    const order = async (query) =>
      (await get(path, query)).body.data.students.map((s) => s.student.name);
    expect(await order({ sort: 'progress_asc' })).toEqual(['Bela Iyer', 'Asha Rao']);
    expect(await order({ sort: 'progress_desc' })).toEqual(['Asha Rao', 'Bela Iyer']);
    expect(await order({ q: 'bela' })).toEqual(['Bela Iyer']);
    const paged = await get(path, { limit: 1, page: 2 });
    expect(paged.body.data.students.map((s) => s.student.name)).toEqual(['Bela Iyer']);
    expect(paged.body.meta).toMatchObject({ total: 2, totalPages: 2 });

    const pending = await get(path, { enrollment: 'pending' });
    expect(pending.body.data.students).toEqual([
      expect.objectContaining({
        status: 'pending',
        progress: null,
        student: expect.objectContaining({ name: 'Dev Malhotra' }),
      }),
    ]);
    const removed = await get(`/reports/courses/${f.b.course.id}`, { enrollment: 'removed' });
    expect(removed.body.data.students[0]).toMatchObject({
      status: 'removed',
      student: { name: 'Esha Nair' },
      reviews: { submitted: 1 },
      // Overdue counts only active enrollments.
      overdue: 0,
    });
  });

  it('handles a course without lessons or students', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    const res = await get(`/reports/courses/${course.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      course: { lessons: 0, modules: 0, progress: { students: 0, averagePercent: null } },
      modules: [],
      assignments: [],
      students: [],
    });
    expect(res.body.data.distribution.every((band) => band.students === 0)).toBe(true);

    await enroll(student, course);
    const enrolled = await get(`/reports/courses/${course.id}`);
    // Nothing to complete: 0%, never "completed".
    expect(enrolled.body.data.students[0].progress).toMatchObject({ percent: 0, completed: false });
    expect(enrolled.body.data.course.progress).toMatchObject({ averagePercent: 0, notStarted: 1 });
  });

  it('validates and is for the trainer only', async () => {
    const f = await school(admin);
    expect((await get('/reports/courses/64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await get('/reports/courses/nope')).status).toBe(400);
    for (const query of [{ sort: 'grade' }, { enrollment: 'none' }, { limit: 0 }, { page: 'x' }]) {
      expect((await get(`/reports/courses/${f.a.course.id}`, query)).status).toBe(400);
    }
    expect((await get(`/reports/courses/${f.a.course.id}`, {}, f.s1)).status).toBe(403);
    expect((await get('/reports/courses', {}, f.s1)).status).toBe(403);
    expect((await api(app).get(`/api/v1/reports/courses/${f.a.course.id}`)).status).toBe(401);
  });
});

describe('reports on the seed data', () => {
  it('match the seed fixtures', async () => {
    await User.deleteMany({ role: 'student' });
    const now = new Date();
    await seedCourses();
    await seedAssignments({ createdBy: admin._id, now });
    await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });
    await seedDemoProgress({ reviewer: admin._id, now });

    const mernLessons = mern.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const percents = DEMO_PROGRESS.map((d) => Math.floor((d.lessonsCompleted * 100) / mernLessons));
    // Aarav 8 and Neha 3 of the 38 MERN lessons: 21% and 7%.
    expect(mernLessons).toBe(38);
    expect(percents).toEqual([21, 7]);

    const dashboard = (await get('/dashboard/admin')).body.data;
    expect(dashboard.summary).toMatchObject({
      students: { total: 3, enrolled: 2 },
      // Aarav and Neha in MERN; Neha's Java and Kabir's DSA requests.
      enrollments: { active: 2, pending: 2, removed: 0 },
      reviews: { all: 2, submitted: 0, resubmit_requested: 1, reviewed: 1 },
      // Seeded due dates are in the future.
      overdue: { total: 0, students: 0 },
    });
    expect(dashboard.pendingRequests.total).toBe(2);
    // The seed's activity: lesson completions, the two submissions and their reviews.
    expect(dashboard.recentActivity.map((a) => a.type)).toEqual(
      expect.arrayContaining(['submission_reviewed', 'resubmission_requested', 'lesson_completed']),
    );

    const course = await Course.findOne({ slug: mern.slug });
    const report = (await get(`/reports/courses/${course.id}`, { sort: 'progress_desc' })).body
      .data;
    expect(report.course).toMatchObject({
      lessons: 38,
      enrollments: { active: 2, pending: 0 },
      progress: { students: 2, averagePercent: Math.floor((21 + 7) / 2), completedStudents: 0 },
      reviews: { reviewed: 1, resubmit_requested: 1 },
    });
    expect(
      report.students.map((s) => [
        s.student.email,
        s.progress.completedLessons,
        s.progress.percent,
      ]),
    ).toEqual(DEMO_PROGRESS.map((d, i) => [d.email, d.lessonsCompleted, percents[i]]));
    const profile = report.assignments.find((a) => a.title === DEMO_SUBMISSIONS[0].assignment);
    expect(profile.stats).toMatchObject({
      expected: 2,
      handedIn: 2,
      reviewed: 1,
      resubmit_requested: 1,
      averageMarks: DEMO_SUBMISSIONS[0].marks,
    });

    const aarav = await User.findOne({ email: DEMO_PROGRESS[0].email });
    const detail = (await get(`/admin/students/${aarav.id}`)).body.data;
    expect(detail.summary).toMatchObject({ activeCourses: 1, lessonsCompleted: 8 });
    const studentReport = (await get(`/reports/students/${aarav.id}`)).body.data;
    expect(studentReport.marks).toEqual({ reviewed: 1, averagePercent: 86 });
  }, 60_000);
});
