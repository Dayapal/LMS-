import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { CourseModule, Lesson } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const get = (path, user) => api(app).get(path).set(bearer(user));

describe('students and unpublished courses', () => {
  for (const status of ['draft', 'archived']) {
    it(`returns 404 for every read of a ${status} course`, async () => {
      const { course, modules } = await makeCourse({
        status,
        shape: [{ status: 'published', lessons: ['published'] }],
      });
      await enroll(student, course);
      const moduleId = modules[0].module.id;
      const lessonId = modules[0].lessons[0].id;

      for (const path of [
        `/api/v1/courses/${course.id}`,
        `/api/v1/courses/${course.id}/roadmap`,
        `/api/v1/courses/${course.id}/modules`,
        `/api/v1/modules/${moduleId}/lessons`,
        `/api/v1/lessons/${lessonId}`,
      ]) {
        const res = await get(path, student);
        expect(res.status, path).toBe(404);
        expect((await get(path, admin)).status, `admin ${path}`).toBe(200);
      }
    });
  }
});

describe('students and unpublished modules or lessons', () => {
  it('hides draft modules and their lessons', async () => {
    const { modules } = await makeCourse({ shape: [{ status: 'draft', lessons: ['published'] }] });
    expect((await get(`/api/v1/modules/${modules[0].module.id}/lessons`, student)).status).toBe(
      404,
    );
  });

  it('hides draft lessons from enrolled students', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['draft'] }] });
    await enroll(student, course);
    expect((await get(`/api/v1/lessons/${modules[0].lessons[0].id}`, student)).status).toBe(404);
  });

  it('lists only published modules and lessons', async () => {
    const { course, modules } = await makeCourse({
      shape: [{ lessons: ['published', 'draft'] }, { status: 'draft' }],
    });
    const mods = await get(`/api/v1/courses/${course.id}/modules`, student);
    expect(mods.body.data).toHaveLength(1);
    const lessons = await get(`/api/v1/modules/${modules[0].module.id}/lessons`, student);
    expect(lessons.body.data.map((l) => l.status)).toEqual(['published']);
  });
});

describe('lesson access requires an active enrollment', () => {
  it.each([
    ['no enrollment', null],
    ['a pending request', 'pending'],
    ['a removed enrollment', 'removed'],
  ])('returns 404 with %s', async (_label, status) => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    if (status) await enroll(student, course, status);
    expect((await get(`/api/v1/lessons/${modules[0].lessons[0].id}`, student)).status).toBe(404);
  });

  it('returns the lesson with its module and course for an enrolled student', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);
    const res = await get(`/api/v1/lessons/${modules[0].lessons[0].id}`, student);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Lesson 1.1',
      module: { id: modules[0].module.id, title: 'Module 1' },
      course: { id: course.id, title: course.title },
    });
  });

  it('lets students see the roadmap of a published course without enrolling', async () => {
    const { course } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const res = await get(`/api/v1/courses/${course.id}/roadmap`, student);
    expect(res.status).toBe(200);
    expect(res.body.data.modules[0].lessons).toHaveLength(1);
  });
});

describe('students cannot modify content', () => {
  it('gets 403 on every write endpoint and nothing changes', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['draft'] }] });
    const moduleId = modules[0].module.id;
    const lessonId = modules[0].lessons[0].id;
    const h = bearer(student);

    const attempts = [
      api(app).post(`/api/v1/courses/${course.id}/modules`).set(h).send({ title: 'Injected' }),
      api(app)
        .patch(`/api/v1/courses/${course.id}/modules/reorder`)
        .set(h)
        .send({ ids: [moduleId] }),
      api(app).patch(`/api/v1/modules/${moduleId}`).set(h).send({ title: 'Changed' }),
      api(app).delete(`/api/v1/modules/${moduleId}`).set(h),
      api(app).post(`/api/v1/modules/${moduleId}/lessons`).set(h).send({ title: 'Injected' }),
      api(app)
        .patch(`/api/v1/modules/${moduleId}/lessons/reorder`)
        .set(h)
        .send({ ids: [lessonId] }),
      api(app).patch(`/api/v1/lessons/${lessonId}`).set(h).send({ status: 'published' }),
      api(app).delete(`/api/v1/lessons/${lessonId}`).set(h),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);

    expect(await CourseModule.countDocuments()).toBe(1);
    expect(await Lesson.countDocuments()).toBe(1);
    expect((await Lesson.findById(lessonId)).status).toBe('draft');
  });
});
