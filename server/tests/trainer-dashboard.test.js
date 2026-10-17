import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Activity,
  Assignment,
  Course,
  CourseModule,
  Enrollment,
  User,
} from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer } from './content-helpers.js';
import { DAY, fromNow } from './assignment-helpers.js';
import { school } from './trainer-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const dashboard = (user = admin) => api(app).get('/api/v1/dashboard/admin').set(bearer(user));

describe('GET /dashboard/admin', () => {
  it('summarises students, enrollments, reviews and overdue work from the data', async () => {
    await school(admin);
    const res = await dashboard();
    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    // 5 named students and the 2 from actors(); 3 of them are actively enrolled.
    expect(summary.students).toMatchObject({ total: 7, newThisWeek: 7, enrolled: 3 });
    expect(summary.enrollments).toEqual({ active: 3, pending: 1, removed: 1 });
    // Latest attempts: Past A (s1) and Past B (s5, removed) wait; Soon A is reviewed.
    expect(summary.reviews).toEqual({
      all: 3,
      submitted: 2,
      resubmitted: 0,
      resubmit_requested: 0,
      reviewed: 1,
    });
    // s2 on Past A and s3 on Past B. The draft and the removed student don't count.
    expect(summary.overdue).toEqual({ total: 2, students: 2 });
  });

  it('agrees with the review queue and with every student’s own assignment page', async () => {
    const f = await school(admin);
    const { summary } = (await dashboard()).body.data;
    const queue = await api(app).get('/api/v1/admin/submissions').set(bearer(admin));
    expect(summary.reviews).toEqual(queue.body.meta.counts);

    let overdue = 0;
    for (const s of [f.s1, f.s2, f.s3, f.s4, f.s5, student]) {
      overdue += (await api(app).get('/api/v1/me/assignments').set(bearer(s))).body.meta.counts
        .overdue;
    }
    expect(summary.overdue.total).toBe(overdue);
  });

  it('summarises each course that isn’t archived', async () => {
    const f = await school(admin);
    const { courses } = (await dashboard()).body.data;
    const byId = Object.fromEntries(courses.map((c) => [c.id, c]));
    expect(Object.keys(byId).sort()).toEqual([f.a.course.id, f.b.course.id, f.d.course.id].sort());
    expect(byId[f.a.course.id]).toMatchObject({
      status: 'published',
      lessons: 2,
      enrollments: { active: 2, pending: 1, removed: 0 },
      // (100% + 50%) / 2
      progress: {
        students: 2,
        averagePercent: 75,
        completedStudents: 1,
        notStarted: 0,
        inProgress: 1,
      },
      assignments: { published: 3, draft: 1, archived: 0 },
      reviews: { submitted: 1, reviewed: 1 },
      overdue: 1,
    });
    expect(byId[f.b.course.id]).toMatchObject({
      enrollments: { active: 1, pending: 0, removed: 1 },
      progress: { students: 1, averagePercent: 0, notStarted: 1 },
      reviews: { submitted: 1 },
      overdue: 1,
    });
    expect(byId[f.d.course.id]).toMatchObject({
      status: 'draft',
      progress: { students: 0, averagePercent: null },
      overdue: 0,
    });
  });

  it('lists the review queue, pending requests, upcoming and overdue assignments', async () => {
    const f = await school(admin);
    const data = (await dashboard()).body.data;
    // Waiting longest first.
    expect(data.reviewQueue.map((r) => [r.student.name, r.assignment.title])).toEqual([
      ['Esha Nair', 'Past B'],
      ['Asha Rao', 'Past A'],
    ]);
    expect(data.pendingRequests.total).toBe(1);
    expect(data.pendingRequests.items[0]).toMatchObject({
      user: { id: f.s4.id, name: 'Dev Malhotra' },
      course: { id: f.a.course.id },
      status: 'pending',
    });

    // Due within 7 days; "Later A" (10 days) is not upcoming yet.
    expect(data.upcoming.map((a) => a.title)).toEqual(['Soon A']);
    expect(data.upcoming[0]).toMatchObject({
      course: { id: f.a.course.id },
      maxMarks: 50,
      stats: { expected: 2, handedIn: 1, pending: 1, overdue: 0, reviewed: 1, averageMarks: 45 },
    });
    // Most recently due first; the draft is left out.
    expect(data.overdue.map((a) => a.title)).toEqual(['Past A', 'Past B']);
    expect(data.overdue[0].stats).toMatchObject({
      expected: 2,
      handedIn: 1,
      overdue: 1,
      submitted: 1,
    });
    // s5 handed in Past B, but was removed: only s3 is expected.
    expect(data.overdue[1].stats).toMatchObject({
      expected: 1,
      handedIn: 0,
      overdue: 1,
      students: 1,
    });
  });

  it('leaves out assignments in unpublished modules and courses', async () => {
    const f = await school(admin);
    const moduleB = f.b.modules[0].module;
    await Assignment.updateOne({ _id: f.pastB._id }, { module: moduleB._id });
    await CourseModule.updateOne({ _id: moduleB._id }, { status: 'draft' });
    const res = (await dashboard()).body.data;
    expect(res.summary.overdue).toEqual({ total: 1, students: 1 });
    expect(res.overdue.map((a) => a.title)).toEqual(['Past A']);
    // The student no longer sees it either.
    const own = await api(app).get('/api/v1/me/assignments').set(bearer(f.s3));
    expect(own.body.meta.counts.all).toBe(0);
    await Course.updateOne({ _id: f.a.course._id }, { status: 'archived' });
    const later = (await dashboard()).body.data;
    expect(later.summary.overdue.total).toBe(0);
    expect(later.courses.map((c) => c.id)).not.toContain(f.a.course.id);
  });

  it('shows recent activity without sign-ins, and counts active learners', async () => {
    const f = await school(admin);
    await Activity.create([
      { user: f.s1._id, type: 'login', createdAt: fromNow(-60_000) },
      {
        user: f.s2._id,
        type: 'lesson_completed',
        course: f.a.course._id,
        lesson: f.a.modules[0].lessons[0]._id,
      },
      { user: f.s3._id, type: 'login', createdAt: fromNow(-10 * DAY) },
    ]);
    const data = (await dashboard()).body.data;
    expect(data.recentActivity.map((a) => [a.type, a.student.name, a.lesson?.title])).toEqual([
      ['lesson_completed', 'Bela Iyer', 'Lesson 1.1'],
    ]);
    // s1 signed in and s2 completed a lesson this week; s3's sign-in is older.
    expect(data.summary.students.activeThisWeek).toBe(2);
  });

  it('is all zeros for a new install', async () => {
    await User.deleteMany({ role: 'student' });
    const data = (await dashboard()).body.data;
    expect(data.summary).toEqual({
      students: { total: 0, newThisWeek: 0, enrolled: 0, activeThisWeek: 0 },
      enrollments: { active: 0, pending: 0, removed: 0 },
      reviews: { all: 0, submitted: 0, resubmitted: 0, resubmit_requested: 0, reviewed: 0 },
      overdue: { total: 0, students: 0 },
    });
    expect(data).toMatchObject({
      courses: [],
      reviewQueue: [],
      pendingRequests: { total: 0, items: [] },
      upcoming: [],
      overdue: [],
      recentActivity: [],
    });
  });

  it('is for the trainer only', async () => {
    expect((await dashboard(student)).status).toBe(403);
    expect((await api(app).get('/api/v1/dashboard/admin')).status).toBe(401);
    expect(await Enrollment.countDocuments()).toBe(0);
  });
});
