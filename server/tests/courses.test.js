import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Course, CourseModule, Enrollment, Lesson } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const asAdmin = () => ({ ...bearer(admin) });

describe('POST /courses', () => {
  it('creates a draft course with a unique slug', async () => {
    const body = {
      title: 'Advanced React Patterns',
      summary: 'Hooks, context and performance.',
      level: 'advanced',
      estimatedHours: 30,
      tags: ['React', 'react', 'hooks'],
    };
    const first = await api(app).post('/api/v1/courses').set(asAdmin()).send(body);
    const second = await api(app).post('/api/v1/courses').set(asAdmin()).send(body);

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      title: 'Advanced React Patterns',
      slug: 'advanced-react-patterns',
      status: 'draft',
      level: 'advanced',
      tags: ['react', 'hooks'],
      stats: { moduleCount: 0, lessonCount: 0, totalMinutes: 0 },
    });
    expect(second.body.data.slug).toBe('advanced-react-patterns-2');
  });

  it('validates input', async () => {
    const res = await api(app)
      .post('/api/v1/courses')
      .set(asAdmin())
      .send({ title: 'JS', level: 'expert', thumbnailUrl: 'http://insecure.example/x.png' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(
      ['level', 'thumbnailUrl', 'title'].sort(),
    );
  });

  it('ignores a client-supplied status and createdBy', async () => {
    const res = await api(app)
      .post('/api/v1/courses')
      .set(asAdmin())
      .send({ title: 'Sneaky Course', status: 'published', createdBy: student.id });
    expect(res.body.data.status).toBe('draft');
    expect((await Course.findById(res.body.data.id)).createdBy.toString()).toBe(admin.id);
  });

  it('is admin-only', async () => {
    const res = await api(app).post('/api/v1/courses').set(bearer(student)).send({ title: 'Mine' });
    expect(res.status).toBe(403);
    expect(await Course.countDocuments()).toBe(0);
  });
});

describe('GET /courses', () => {
  beforeEach(async () => {
    await makeCourse({ status: 'published' });
    await makeCourse({ status: 'draft' });
    await makeCourse({ status: 'archived' });
  });

  it('shows admins every course and supports status filters', async () => {
    const all = await api(app).get('/api/v1/courses').set(asAdmin());
    expect(all.body.data).toHaveLength(3);
    expect(all.body.meta).toMatchObject({ page: 1, total: 3, totalPages: 1 });

    const drafts = await api(app).get('/api/v1/courses?status=draft').set(asAdmin());
    expect(drafts.body.data.map((c) => c.status)).toEqual(['draft']);
  });

  it('leaves the Markdown description out of list rows; the course itself has it', async () => {
    const course = await Course.create({
      title: 'Long read',
      slug: 'long-read',
      status: 'published',
      description: 'x'.repeat(9_000),
    });
    const list = await api(app).get('/api/v1/courses').set(asAdmin());
    expect(list.body.data).toHaveLength(4);
    for (const row of list.body.data) expect(row).not.toHaveProperty('description');
    expect(list.body.data[0]).toMatchObject({ title: expect.any(String), summary: '' });

    const one = await api(app).get(`/api/v1/courses/${course.id}`).set(bearer(student));
    expect(one.body.data.description).toHaveLength(9_000);
  });

  it('shows students only published courses, even when they ask for drafts', async () => {
    const res = await api(app).get('/api/v1/courses?status=draft').set(bearer(student));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.status)).toEqual(['published']);
    expect(res.body.data[0]).toHaveProperty('enrollment', null);
  });

  it('searches titles literally and paginates', async () => {
    await Course.create({ title: 'Regex (a+b)* course', slug: 'regex', status: 'published' });
    const search = await api(app)
      .get(`/api/v1/courses?q=${encodeURIComponent('(a+b)*')}`)
      .set(asAdmin());
    expect(search.body.data.map((c) => c.slug)).toEqual(['regex']);

    const page = await api(app).get('/api/v1/courses?limit=2&page=2').set(asAdmin());
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
  });

  it('rejects invalid query parameters', async () => {
    const res = await api(app).get('/api/v1/courses?limit=500').set(asAdmin());
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await api(app).get('/api/v1/courses')).status).toBe(401);
  });
});

describe('course stats', () => {
  it('counts only content the viewer can see', async () => {
    await makeCourse({
      shape: [
        { status: 'published', lessons: ['published', 'draft'] },
        { status: 'draft', lessons: ['published'] },
      ],
    });
    const forAdmin = await api(app).get('/api/v1/courses').set(asAdmin());
    const forStudent = await api(app).get('/api/v1/courses').set(bearer(student));

    expect(forAdmin.body.data[0].stats).toEqual({
      moduleCount: 2,
      lessonCount: 3,
      totalMinutes: 90,
    });
    expect(forStudent.body.data[0].stats).toEqual({
      moduleCount: 1,
      lessonCount: 1,
      totalMinutes: 30,
    });
  });
});

describe('PATCH /courses/:id and status', () => {
  it('updates fields and clears the thumbnail', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    await Course.updateOne({ _id: course._id }, { thumbnailUrl: 'https://img.example/a.png' });

    const res = await api(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set(asAdmin())
      .send({ title: 'Renamed Course', thumbnailUrl: '', estimatedHours: 12 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Renamed Course',
      thumbnailUrl: null,
      estimatedHours: 12,
      slug: course.slug,
    });
  });

  it('publishes, archives and restores a course', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    for (const status of ['published', 'archived', 'draft']) {
      const res = await api(app)
        .patch(`/api/v1/courses/${course.id}/status`)
        .set(asAdmin())
        .send({ status });
      expect(res.body.data.status).toBe(status);
    }
    const bad = await api(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set(asAdmin())
      .send({ status: 'live' });
    expect(bad.status).toBe(400);
  });

  it('returns 404 for unknown ids and 400 for malformed ids', async () => {
    const missing = await api(app)
      .patch('/api/v1/courses/64b7f0000000000000000000')
      .set(asAdmin())
      .send({ title: 'Anything' });
    expect(missing.status).toBe(404);
    const malformed = await api(app).get('/api/v1/courses/not-an-id').set(asAdmin());
    expect(malformed.status).toBe(400);
  });

  it('is admin-only', async () => {
    const { course } = await makeCourse();
    const edit = await api(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set(bearer(student))
      .send({ title: 'Hacked' });
    const status = await api(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set(bearer(student))
      .send({ status: 'archived' });
    expect(edit.status).toBe(403);
    expect(status.status).toBe(403);
    expect((await Course.findById(course.id)).title).toBe(course.title);
  });
});

describe('DELETE /courses/:id', () => {
  it('deletes an unpublished course with its modules and lessons', async () => {
    const { course } = await makeCourse({
      status: 'draft',
      shape: [{ status: 'draft', lessons: ['draft', 'draft'] }],
    });
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(asAdmin());
    expect(res.status).toBe(204);
    expect(await Course.countDocuments()).toBe(0);
    expect(await CourseModule.countDocuments()).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it('refuses to delete a published course', async () => {
    const { course } = await makeCourse({ status: 'published' });
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(asAdmin());
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/archive/i);
  });

  it('refuses to delete a course with enrolled or pending students', async () => {
    const { course } = await makeCourse({ status: 'archived' });
    await enroll(student, course, 'pending');
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(asAdmin());
    expect(res.status).toBe(409);
    expect(await Course.exists({ _id: course._id })).toBeTruthy();
  });

  it('allows deletion when only removed enrollments remain, and cleans them up', async () => {
    const { course } = await makeCourse({ status: 'archived' });
    await enroll(student, course, 'removed');
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(asAdmin());
    expect(res.status).toBe(204);
    expect(await Enrollment.countDocuments()).toBe(0);
  });

  it('is admin-only', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(bearer(student));
    expect(res.status).toBe(403);
  });
});
