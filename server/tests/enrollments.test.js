import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Enrollment } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});

const request = (user, course) =>
  api(app).post(`/api/v1/courses/${course.id}/enroll`).set(bearer(user));

describe('POST /courses/:id/enroll (student request)', () => {
  it('creates a pending request, idempotently', async () => {
    const { course } = await makeCourse();
    const first = await request(student, course);
    const second = await request(student, course);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ status: 'pending', enrolledAt: null });
    expect(second.body.data.status).toBe('pending');
    expect(await Enrollment.countDocuments()).toBe(1);
  });

  it('shows the request on the course for that student only', async () => {
    const { course } = await makeCourse();
    await request(student, course);
    const mine = await api(app).get(`/api/v1/courses/${course.id}`).set(bearer(student));
    const theirs = await api(app).get(`/api/v1/courses/${course.id}`).set(bearer(otherStudent));
    expect(mine.body.data.enrollment.status).toBe('pending');
    expect(theirs.body.data.enrollment).toBeNull();
  });

  it('re-opens a removed enrollment as a new request', async () => {
    const { course } = await makeCourse();
    await enroll(student, course, 'removed');
    const res = await request(student, course);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects requests for a course the student is already in', async () => {
    const { course } = await makeCourse();
    await enroll(student, course, 'active');
    expect((await request(student, course)).status).toBe(409);
  });

  it('returns 404 for unpublished courses and 403 for admins', async () => {
    const { course: draft } = await makeCourse({ status: 'draft' });
    expect((await request(student, draft)).status).toBe(404);
    const { course } = await makeCourse();
    expect((await request(admin, course)).status).toBe(403);
  });
});

describe('/admin/enrollments', () => {
  it('lists enrollments with student and course details, filtered', async () => {
    const { course } = await makeCourse();
    const { course: other } = await makeCourse();
    await enroll(student, course, 'pending');
    await enroll(otherStudent, course, 'active');
    await enroll(student, other, 'pending');

    const res = await api(app)
      .get(`/api/v1/admin/enrollments?course=${course.id}&status=pending`)
      .set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      status: 'pending',
      user: { id: student.id, name: student.name, email: student.email },
      course: { id: course.id, title: course.title },
    });
  });

  it('approves and removes enrollments', async () => {
    const { course } = await makeCourse();
    const pending = await enroll(student, course, 'pending');

    const approved = await api(app)
      .patch(`/api/v1/admin/enrollments/${pending.id}`)
      .set(bearer(admin))
      .send({ status: 'active' });
    expect(approved.body.data.status).toBe('active');
    expect(approved.body.data.enrolledAt).toBeTruthy();

    const removed = await api(app)
      .patch(`/api/v1/admin/enrollments/${pending.id}`)
      .set(bearer(admin))
      .send({ status: 'removed' });
    expect(removed.body.data.status).toBe('removed');

    const invalid = await api(app)
      .patch(`/api/v1/admin/enrollments/${pending.id}`)
      .set(bearer(admin))
      .send({ status: 'pending' });
    expect(invalid.status).toBe(400);
  });

  it('enrolls a student directly by email, approving a pending request', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    await enroll(student, course, 'pending');
    const res = await api(app)
      .post('/api/v1/admin/enrollments')
      .set(bearer(admin))
      .send({ courseId: course.id, email: student.email.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'active', user: { email: student.email } });
    expect(await Enrollment.countDocuments()).toBe(1);

    const again = await api(app)
      .post('/api/v1/admin/enrollments')
      .set(bearer(admin))
      .send({ courseId: course.id, email: student.email });
    expect(again.status).toBe(409);
  });

  it('only enrolls existing student accounts', async () => {
    const { course } = await makeCourse();
    for (const email of ['nobody@example.com', admin.email]) {
      const res = await api(app)
        .post('/api/v1/admin/enrollments')
        .set(bearer(admin))
        .send({ courseId: course.id, email });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe('email');
    }
  });

  it('is admin-only', async () => {
    const { course } = await makeCourse();
    const pending = await enroll(student, course, 'pending');
    const h = bearer(student);
    const results = await Promise.all([
      api(app).get('/api/v1/admin/enrollments').set(h),
      api(app)
        .post('/api/v1/admin/enrollments')
        .set(h)
        .send({ courseId: course.id, email: student.email }),
      api(app).patch(`/api/v1/admin/enrollments/${pending.id}`).set(h).send({ status: 'active' }),
    ]);
    for (const res of results) expect(res.status).toBe(403);
    expect((await Enrollment.findById(pending.id)).status).toBe('pending');
  });
});
