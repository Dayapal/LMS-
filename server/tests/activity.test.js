import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Activity, Course, Enrollment } from '../src/models/index.js';
import { api, PASSWORD, registerStudent } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import {
  githubItem,
  makeAssignment,
  requestResubmission,
  review,
  submit,
} from './assignment-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

afterEach(() => vi.restoreAllMocks());

const events = async (filter = {}) =>
  (await Activity.find(filter).sort({ createdAt: 1, _id: 1 }).lean()).map((a) => a.type);

const login = (user) =>
  api(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });

describe('Activity log', () => {
  it('records sign-ups, and sign-ins of students only', async () => {
    const { res } = await registerStudent(app);
    expect(res.status).toBe(201);
    const userId = res.body.data.user.id;
    expect(await events({ user: userId })).toEqual(['registered']);

    expect((await login(student)).status).toBe(200);
    expect((await login(admin)).status).toBe(200);
    expect(await events({ user: student._id })).toEqual(['login']);
    expect(await Activity.countDocuments({ user: admin._id })).toBe(0);
    // A failed sign-in records nothing.
    await api(app).post('/api/v1/auth/login').send({ email: student.email, password: 'Wrong1234' });
    expect(await Activity.countDocuments({ user: student._id })).toBe(1);
  });

  it('records enrollment requests and the trainer’s decisions, with the trainer as actor', async () => {
    const { course } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await api(app).post(`/api/v1/courses/${course.id}/enroll`).set(bearer(student));
    // Asking again while pending changes nothing.
    await api(app).post(`/api/v1/courses/${course.id}/enroll`).set(bearer(student));
    const enrollment = await Enrollment.findOne({ user: student._id });
    const decide = (status) =>
      api(app)
        .patch(`/api/v1/admin/enrollments/${enrollment.id}`)
        .set(bearer(admin))
        .send({ status });
    await decide('active');
    await decide('active'); // no change, no event
    await decide('removed');
    await api(app)
      .post('/api/v1/admin/enrollments')
      .set(bearer(admin))
      .send({ courseId: course.id, email: student.email });

    const rows = await Activity.find({ user: student._id }).sort({ createdAt: 1, _id: 1 }).lean();
    expect(rows.map((r) => [r.type, r.actor?.toString() ?? null])).toEqual([
      ['enrollment_requested', null],
      ['enrolled', admin.id],
      ['enrollment_removed', admin.id],
      ['enrolled', admin.id],
    ]);
    expect(rows.every((r) => r.course.equals(course._id))).toBe(true);
  });

  it('records a lesson completion once, and submissions, reviews and resubmission requests', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);
    const lesson = modules[0].lessons[0];
    for (let i = 0; i < 2; i += 1) {
      await api(app).post(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(student));
    }
    await api(app).delete(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(student));

    const assignment = await makeAssignment(course, { maxAttempts: 2 });
    const first = await submit(app, student, assignment, {
      items: [githubItem()],
      note: 'secret note',
    });
    await requestResubmission(app, admin, first.body.data.id, { feedback: 'Private feedback' });
    const second = await submit(app, student, assignment, { items: [githubItem('v2')] });
    await review(app, admin, second.body.data.id, { marks: 90, feedback: 'More private feedback' });

    const rows = await Activity.find({ user: student._id }).sort({ createdAt: 1, _id: 1 }).lean();
    expect(rows.map((r) => [r.type, r.attempt])).toEqual([
      ['lesson_completed', null],
      ['submission_created', 1],
      ['resubmission_requested', 1],
      ['submission_created', 2],
      ['submission_reviewed', 2],
    ]);
    expect(rows[0].lesson.equals(lesson._id)).toBe(true);
    expect(rows[4]).toMatchObject({ actor: admin._id, assignment: assignment._id });
    expect(rows[4].submission.toString()).toBe(second.body.data.id);

    // Ids only: no work, notes, feedback, passwords, tokens or addresses. The
    // schema has no field that could hold marks either (checked below).
    const stored = JSON.stringify(await Activity.find().lean());
    for (const secret of ['secret note', 'Private feedback', 'github.com', PASSWORD]) {
      expect(stored).not.toContain(secret);
    }
    expect(Object.keys(Activity.schema.paths).sort()).toEqual(
      [
        '__v',
        '_id',
        'actor',
        'assignment',
        'attempt',
        'course',
        'createdAt',
        'lesson',
        'submission',
        'type',
        'user',
      ].sort(),
    );
  });

  it('never fails the action when the log can’t be written', async () => {
    vi.spyOn(Activity, 'create').mockRejectedValue(new Error('disk full'));
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);
    const res = await api(app)
      .post(`/api/v1/lessons/${modules[0].lessons[0].id}/complete`)
      .set(bearer(student));
    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(true);
    expect((await login(student)).status).toBe(200);
  });

  it('expires after a year and is indexed for the feeds', async () => {
    const indexes = await Activity.collection.indexes();
    const ttl = indexes.find((i) => i.key.createdAt === 1 && Object.keys(i.key).length === 1);
    expect(ttl.expireAfterSeconds).toBe(365 * 24 * 60 * 60);
    expect(indexes.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        { user: 1, createdAt: -1 },
        { course: 1, createdAt: -1 },
      ]),
    );
  });

  it('is removed with a deleted course and isn’t readable by students', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    await Enrollment.create({ user: student._id, course: course._id, status: 'removed' });
    await Activity.create({ user: student._id, type: 'enrollment_removed', course: course._id });
    expect((await api(app).delete(`/api/v1/courses/${course.id}`).set(bearer(admin))).status).toBe(
      204,
    );
    expect(await Course.exists({ _id: course._id })).toBeNull();
    expect(await Activity.countDocuments({ course: course._id })).toBe(0);
    expect(
      (await api(app).get(`/api/v1/reports/students/${student.id}`).set(bearer(student))).status,
    ).toBe(403);
  });
});
