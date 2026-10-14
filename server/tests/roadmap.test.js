import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { CourseModule, Lesson } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, makeCourse } from './content-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const orderOf = async (Model, filter) =>
  (await Model.find(filter).sort({ order: 1 })).map((d) => d.id);

describe('modules', () => {
  it('appends new modules in order', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    const titles = ['Basics', 'Intermediate', 'Advanced'];
    for (const title of titles) {
      const res = await api(app)
        .post(`/api/v1/courses/${course.id}/modules`)
        .set(bearer(admin))
        .send({ title });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
    }
    const modules = await CourseModule.find({ course: course._id }).sort({ order: 1 });
    expect(modules.map((m) => m.title)).toEqual(titles);
    expect(modules.map((m) => m.order)).toEqual([0, 1, 2]);
  });

  it('returns 404 when the course does not exist', async () => {
    const res = await api(app)
      .post('/api/v1/courses/64b7f0000000000000000000/modules')
      .set(bearer(admin))
      .send({ title: 'Orphan' });
    expect(res.status).toBe(404);
  });

  it('updates title, description and status', async () => {
    const { modules } = await makeCourse({ shape: [{ status: 'draft' }] });
    const res = await api(app)
      .patch(`/api/v1/modules/${modules[0].module.id}`)
      .set(bearer(admin))
      .send({ title: 'Renamed module', description: 'Now with details', status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Renamed module',
      description: 'Now with details',
      status: 'published',
    });
  });

  it('reorders modules and persists the new order', async () => {
    const { course, modules } = await makeCourse({ shape: [{}, {}, {}] });
    const [a, b, c] = modules.map((m) => m.module.id);

    const res = await api(app)
      .patch(`/api/v1/courses/${course.id}/modules/reorder`)
      .set(bearer(admin))
      .send({ ids: [c, a, b] });
    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.id)).toEqual([c, a, b]);
    expect(await orderOf(CourseModule, { course: course._id })).toEqual([c, a, b]);
  });

  it('rejects a reorder that is missing, duplicating or foreign ids', async () => {
    const { course, modules } = await makeCourse({ shape: [{}, {}] });
    const other = await makeCourse({ shape: [{}] });
    const [a, b] = modules.map((m) => m.module.id);
    const url = `/api/v1/courses/${course.id}/modules/reorder`;

    for (const ids of [
      [a],
      [a, a],
      [a, b, other.modules[0].module.id],
      [a, other.modules[0].module.id],
    ]) {
      const res = await api(app).patch(url).set(bearer(admin)).send({ ids });
      expect(res.status).toBe(400);
    }
    expect(await orderOf(CourseModule, { course: course._id })).toEqual([a, b]);
  });

  it('deletes an unpublished module and its unpublished lessons', async () => {
    const { modules } = await makeCourse({
      shape: [{ status: 'draft', lessons: ['draft', 'archived'] }],
    });
    const res = await api(app).delete(`/api/v1/modules/${modules[0].module.id}`).set(bearer(admin));
    expect(res.status).toBe(204);
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it('refuses to delete a published module or one with published lessons', async () => {
    const { modules } = await makeCourse({
      shape: [
        { status: 'published', lessons: [] },
        { status: 'draft', lessons: ['published'] },
      ],
    });
    for (const { module } of modules) {
      const res = await api(app).delete(`/api/v1/modules/${module.id}`).set(bearer(admin));
      expect(res.status).toBe(409);
    }
    expect(await CourseModule.countDocuments()).toBe(2);
  });
});

describe('lessons', () => {
  it('creates lessons in order with unique slugs per course', async () => {
    const { modules } = await makeCourse({ shape: [{}, {}] });
    const [first, second] = modules.map((m) => m.module.id);
    const body = {
      title: 'Closures in Depth',
      summary: 'Functions that remember.',
      objectives: ['Explain closures', 'Use them for private state'],
      prerequisites: ['Functions'],
      estimatedMinutes: 45,
    };

    const a = await api(app).post(`/api/v1/modules/${first}/lessons`).set(bearer(admin)).send(body);
    const b = await api(app)
      .post(`/api/v1/modules/${second}/lessons`)
      .set(bearer(admin))
      .send(body);

    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({
      ...body,
      slug: 'closures-in-depth',
      order: 0,
      status: 'draft',
    });
    expect(b.body.data.slug).toBe('closures-in-depth-2');
  });

  it('validates lesson input', async () => {
    const { modules } = await makeCourse({ shape: [{}] });
    const res = await api(app)
      .post(`/api/v1/modules/${modules[0].module.id}/lessons`)
      .set(bearer(admin))
      .send({ title: '', objectives: [''], estimatedMinutes: -5 });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'objectives.0', 'estimatedMinutes']));
  });

  it('reorders lessons within a module', async () => {
    const { modules } = await makeCourse({
      shape: [{ lessons: ['published', 'published', 'draft'] }],
    });
    const module = modules[0].module;
    const [a, b, c] = modules[0].lessons.map((l) => l.id);
    const res = await api(app)
      .patch(`/api/v1/modules/${module.id}/lessons/reorder`)
      .set(bearer(admin))
      .send({ ids: [b, c, a] });
    expect(res.status).toBe(200);
    expect(await orderOf(Lesson, { module: module._id })).toEqual([b, c, a]);
  });

  it('moves a lesson to the end of another module in the same course', async () => {
    const { modules } = await makeCourse({
      shape: [{ lessons: ['published'] }, { lessons: ['published', 'published'] }],
    });
    const lesson = modules[0].lessons[0];
    const target = modules[1].module;
    const res = await api(app)
      .patch(`/api/v1/lessons/${lesson.id}`)
      .set(bearer(admin))
      .send({ moduleId: target.id, title: 'Moved lesson' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ moduleId: target.id, order: 2, title: 'Moved lesson' });
  });

  it('refuses to move a lesson into another course', async () => {
    const { modules } = await makeCourse({ shape: [{ lessons: ['draft'] }] });
    const other = await makeCourse({ shape: [{}] });
    const res = await api(app)
      .patch(`/api/v1/lessons/${modules[0].lessons[0].id}`)
      .set(bearer(admin))
      .send({ moduleId: other.modules[0].module.id });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('moduleId');
  });

  it('deletes unpublished lessons but not published ones', async () => {
    const { modules } = await makeCourse({ shape: [{ lessons: ['draft', 'published'] }] });
    const [draft, published] = modules[0].lessons;
    expect((await api(app).delete(`/api/v1/lessons/${draft.id}`).set(bearer(admin))).status).toBe(
      204,
    );
    expect(
      (await api(app).delete(`/api/v1/lessons/${published.id}`).set(bearer(admin))).status,
    ).toBe(409);
  });
});

describe('GET /courses/:id/roadmap', () => {
  it('returns ordered modules with ordered lessons for the trainer', async () => {
    const { course, modules } = await makeCourse({
      shape: [
        { status: 'published', lessons: ['published', 'draft'] },
        { status: 'draft', lessons: ['draft'] },
      ],
    });
    await CourseModule.updateOne({ _id: modules[0].module._id }, { order: 5 });

    const res = await api(app).get(`/api/v1/courses/${course.id}/roadmap`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.course.id).toBe(course.id);
    expect(res.body.data.modules.map((m) => m.title)).toEqual(['Module 2', 'Module 1']);
    expect(res.body.data.modules[1].lessons.map((l) => l.title)).toEqual([
      'Lesson 1.1',
      'Lesson 1.2',
    ]);
  });

  it('shows students only published modules and lessons', async () => {
    const { course } = await makeCourse({
      shape: [
        { status: 'published', lessons: ['published', 'draft', 'archived'] },
        { status: 'draft', lessons: ['published'] },
        { status: 'archived', lessons: ['published'] },
      ],
    });
    const res = await api(app).get(`/api/v1/courses/${course.id}/roadmap`).set(bearer(student));
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0].lessons.map((l) => l.title)).toEqual(['Lesson 1.1']);
    expect(res.body.data.course.enrollment).toBeNull();
  });
});
