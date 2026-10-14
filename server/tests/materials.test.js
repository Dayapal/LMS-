import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { FileAsset, Lesson, Material } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { attachFile, storedFiles, uploadPdf } from './file-helpers.js';

let app;
let admin;
let student;

beforeEach(async () => {
  app = createApp();
  ({ admin, student } = await actors());
});

const as = (user) => ({
  get: (path) => api(app).get(path).set(bearer(user)),
  post: (path, body) => api(app).post(path).set(bearer(user)).send(body),
  patch: (path, body) => api(app).patch(path).set(bearer(user)).send(body),
  delete: (path) => api(app).delete(path).set(bearer(user)),
});

const NOTE = { type: 'note', title: 'Overview', body: '# Hello\n\nSome **notes**.' };
const CODE = {
  type: 'code',
  title: 'Example',
  language: 'javascript',
  source: '  const answer = 42;\n',
  caption: 'Indentation is kept',
};
const LINK = { type: 'link', title: 'MDN reference', url: 'https://developer.mozilla.org/' };

async function lessonFixture(shape = [{ lessons: ['published'] }]) {
  const { course, modules } = await makeCourse({ shape });
  return { course, module: modules[0].module, lesson: modules[0].lessons[0], modules };
}

const createMaterial = (lesson, body) =>
  as(admin).post(`/api/v1/lessons/${lesson.id}/materials`, body);

describe('creating materials', () => {
  it('creates each type as a draft, appended in order', async () => {
    const { course, lesson } = await lessonFixture();
    const file = await uploadPdf(app, admin, course);

    const note = await createMaterial(lesson, NOTE);
    const code = await createMaterial(lesson, CODE);
    const pdf = await createMaterial(lesson, { type: 'file', title: 'Handout', fileId: file.id });
    const link = await createMaterial(lesson, LINK);

    for (const res of [note, code, pdf, link]) expect(res.status).toBe(201);
    expect(note.body.data).toMatchObject({
      type: 'note',
      status: 'draft',
      order: 0,
      body: NOTE.body,
    });
    expect(code.body.data).toMatchObject({
      type: 'code',
      order: 1,
      language: 'javascript',
      source: CODE.source,
      caption: CODE.caption,
    });
    expect(pdf.body.data).toMatchObject({
      type: 'file',
      order: 2,
      downloadable: true,
      file: { id: file.id, originalName: 'handout.pdf', mimeType: 'application/pdf' },
    });
    expect(link.body.data).toMatchObject({
      type: 'link',
      order: 3,
      url: LINK.url,
      description: '',
    });
    expect(note.body.data).not.toHaveProperty('source');
    expect(link.body.data).not.toHaveProperty('body');
    expect(note.body.data.courseId).toBe(course.id);
  });

  it('stores Markdown exactly as written, including raw HTML', async () => {
    const { lesson } = await lessonFixture();
    const body = 'Hi <script>alert("x")</script> [link](javascript:alert(1))';
    const res = await createMaterial(lesson, { ...NOTE, body });
    expect(res.body.data.body).toBe(body);
  });

  it.each([
    ['an unknown type', { type: 'video', title: 'Lecture' }, 'type'],
    ['a note without a body', { type: 'note', title: 'Empty', body: '   ' }, 'body'],
    ['an unsupported language', { ...CODE, language: 'cobol' }, 'language'],
    ['whitespace-only code', { ...CODE, source: ' \n ' }, 'source'],
    ['a non-https link', { ...LINK, url: 'http://example.com' }, 'url'],
    ['a javascript: link', { ...LINK, url: 'javascript:alert(1)' }, 'url'],
    ['a short title', { ...NOTE, title: 'A' }, 'title'],
    ['a file without fileId', { type: 'file', title: 'Handout' }, 'fileId'],
  ])('rejects %s', async (_label, body, path) => {
    const { lesson } = await lessonFixture();
    const res = await createMaterial(lesson, body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });

  it('only attaches material files uploaded for the same course', async () => {
    const { lesson } = await lessonFixture();
    const { course: otherCourse } = await makeCourse();
    const foreign = await uploadPdf(app, admin, otherCourse);

    for (const fileId of [foreign.id, '0123456789abcdef01234567']) {
      const res = await createMaterial(lesson, { type: 'file', title: 'Handout', fileId });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe('fileId');
    }
  });

  it('ignores client-supplied lesson, course and order', async () => {
    const { lesson } = await lessonFixture();
    const { course: other } = await makeCourse();
    const res = await createMaterial(lesson, { ...NOTE, course: other.id, order: 99, lesson: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      lessonId: lesson.id,
      courseId: lesson.course.toString(),
    });
    expect(res.body.data.order).toBe(0);
  });

  it('returns 404 for an unknown lesson', async () => {
    const res = await as(admin).post('/api/v1/lessons/0123456789abcdef01234567/materials', NOTE);
    expect(res.status).toBe(404);
  });
});

describe('updating materials', () => {
  it('updates the fields of the material type', async () => {
    const { lesson } = await lessonFixture();
    const created = (await createMaterial(lesson, CODE)).body.data;
    const res = await as(admin).patch(`/api/v1/materials/${created.id}`, {
      language: 'java',
      source: 'class A {}',
      status: 'published',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      language: 'java',
      source: 'class A {}',
      status: 'published',
    });
  });

  it('rejects fields from another type and never changes the type', async () => {
    const { lesson } = await lessonFixture();
    const created = (await createMaterial(lesson, NOTE)).body.data;

    const foreign = await as(admin).patch(`/api/v1/materials/${created.id}`, { source: 'x()' });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.details[0]).toMatchObject({ path: 'source' });

    const typeOnly = await as(admin).patch(`/api/v1/materials/${created.id}`, { type: 'code' });
    expect(typeOnly.status).toBe(400);
    expect((await Material.findById(created.id)).type).toBe('note');
  });

  it('replacing a file deletes the old one when nothing else uses it', async () => {
    const { course, lesson } = await lessonFixture();
    const first = await uploadPdf(app, admin, course, 'v1.pdf');
    const second = await uploadPdf(app, admin, course, 'v2.pdf');
    const material = (
      await createMaterial(lesson, { type: 'file', title: 'Sheet', fileId: first.id })
    ).body.data;

    const res = await as(admin).patch(`/api/v1/materials/${material.id}`, {
      fileId: second.id,
      downloadable: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ downloadable: false, file: { id: second.id } });
    expect(await FileAsset.exists({ _id: first.id })).toBeNull();
    expect(await storedFiles()).toHaveLength(1);
  });
});

describe('listing materials', () => {
  async function lessonWithMaterials() {
    const fixture = await lessonFixture();
    const make = (title, status) =>
      Material.create({
        lesson: fixture.lesson._id,
        course: fixture.course._id,
        type: 'note',
        title,
        body: title,
        status,
        order: ['First', 'Draft', 'Second', 'Old'].indexOf(title),
      });
    await make('Second', 'published');
    await make('Draft', 'draft');
    await make('First', 'published');
    await make('Old', 'archived');
    return fixture;
  }

  it('shows an enrolled student only published materials, in order', async () => {
    const { course, lesson } = await lessonWithMaterials();
    await enroll(student, course);
    const res = await as(student).get(`/api/v1/lessons/${lesson.id}/materials`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.title)).toEqual(['First', 'Second']);
  });

  it('shows the trainer every material', async () => {
    const { lesson } = await lessonWithMaterials();
    const res = await as(admin).get(`/api/v1/lessons/${lesson.id}/materials`);
    expect(res.body.data.map((m) => m.title)).toEqual(['First', 'Draft', 'Second', 'Old']);
  });

  it.each([
    ['not enrolled', null, 'published'],
    ['pending', 'pending', 'published'],
    ['removed', 'removed', 'published'],
    ['enrolled, draft lesson', 'active', 'draft'],
  ])('returns 404 to a student (%s)', async (_label, enrollment, lessonStatus) => {
    const { course, lesson } = await lessonWithMaterials();
    if (enrollment) await enroll(student, course, enrollment);
    await Lesson.updateOne({ _id: lesson._id }, { status: lessonStatus });
    const res = await as(student).get(`/api/v1/lessons/${lesson.id}/materials`);
    expect(res.status).toBe(404);
  });

  it('returns 404 to an enrolled student when the course is archived', async () => {
    const { course, lesson } = await lessonWithMaterials();
    await enroll(student, course);
    course.status = 'archived';
    await course.save();
    expect((await as(student).get(`/api/v1/lessons/${lesson.id}/materials`)).status).toBe(404);
  });
});

describe('reordering and deleting materials', () => {
  it('reorders materials from a complete id list', async () => {
    const { lesson } = await lessonFixture();
    const a = (await createMaterial(lesson, NOTE)).body.data;
    const b = (await createMaterial(lesson, CODE)).body.data;

    const res = await as(admin).patch(`/api/v1/lessons/${lesson.id}/materials/reorder`, {
      ids: [b.id, a.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.id)).toEqual([b.id, a.id]);

    const partial = await as(admin).patch(`/api/v1/lessons/${lesson.id}/materials/reorder`, {
      ids: [b.id],
    });
    expect(partial.status).toBe(400);
  });

  it('refuses to delete a published material', async () => {
    const { lesson } = await lessonFixture();
    const material = (await createMaterial(lesson, { ...NOTE, status: 'published' })).body.data;
    const res = await as(admin).delete(`/api/v1/materials/${material.id}`);
    expect(res.status).toBe(409);
    expect(await Material.exists({ _id: material.id })).toBeTruthy();
  });

  it('deletes a draft file material together with its file', async () => {
    const { course, lesson } = await lessonFixture();
    const file = await uploadPdf(app, admin, course);
    const material = (
      await createMaterial(lesson, { type: 'file', title: 'Sheet', fileId: file.id })
    ).body.data;

    expect((await as(admin).delete(`/api/v1/materials/${material.id}`)).status).toBe(204);
    expect(await Material.countDocuments()).toBe(0);
    expect(await FileAsset.countDocuments()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it('keeps a file that another material still uses', async () => {
    const { course, lesson, modules } = await lessonFixture([{ lessons: ['published', 'draft'] }]);
    const file = await uploadPdf(app, admin, course);
    const first = await attachFile(lesson, file.id, { status: 'draft' });
    await attachFile(modules[0].lessons[1], file.id);

    expect((await as(admin).delete(`/api/v1/materials/${first.id}`)).status).toBe(204);
    expect(await FileAsset.exists({ _id: file.id })).toBeTruthy();
    expect(await storedFiles()).toHaveLength(1);
  });

  it('deleting a lesson, module or course removes its materials and files', async () => {
    for (const level of ['lesson', 'module', 'course']) {
      const { course, module, lesson } = await lessonFixture([
        { status: 'draft', lessons: ['draft'] },
      ]);
      course.status = 'draft';
      await course.save();
      const file = await uploadPdf(app, admin, course);
      await attachFile(lesson, file.id);
      await Material.create({
        lesson: lesson._id,
        course: course._id,
        type: 'note',
        title: 'Notes',
        body: 'x',
        order: 1,
      });
      // Uploaded but never attached: removed with the course only.
      await uploadPdf(app, admin, course, 'unused.pdf');

      const target = { lesson, module, course }[level];
      const path = { lesson: 'lessons', module: 'modules', course: 'courses' }[level];
      expect((await as(admin).delete(`/api/v1/${path}/${target.id}`)).status, level).toBe(204);
      expect(await Material.countDocuments({ course: course._id }), level).toBe(0);
      expect(await FileAsset.exists({ _id: file.id }), level).toBeNull();
      expect(await FileAsset.countDocuments({ course: course._id }), level).toBe(
        level === 'course' ? 0 : 1,
      );
    }
  });
});

describe('students cannot change materials', () => {
  it('returns 403 for every write', async () => {
    const { course, lesson } = await lessonFixture();
    await enroll(student, course);
    const material = (await createMaterial(lesson, NOTE)).body.data;

    const writes = [
      as(student).post(`/api/v1/lessons/${lesson.id}/materials`, NOTE),
      as(student).patch(`/api/v1/lessons/${lesson.id}/materials/reorder`, { ids: [material.id] }),
      as(student).patch(`/api/v1/materials/${material.id}`, { title: 'Hacked title' }),
      as(student).delete(`/api/v1/materials/${material.id}`),
    ];
    for (const res of await Promise.all(writes)) expect(res.status).toBe(403);
    expect((await Material.findById(material.id)).title).toBe(NOTE.title);
  });
});

describe('GET /lessons/:id/navigation', () => {
  // Module 1: published [L1.1 published, L1.2 draft, L1.3 published]
  // Module 2: draft [L2.1 published]
  // Module 3: published [L3.1 published]
  async function courseFixture() {
    const { course, modules } = await makeCourse({
      shape: [
        { lessons: ['published', 'draft', 'published'] },
        { status: 'draft', lessons: ['published'] },
        { lessons: ['published'] },
      ],
    });
    const lessons = modules.flatMap((m) => m.lessons);
    return { course, modules, byTitle: Object.fromEntries(lessons.map((l) => [l.title, l])) };
  }

  const nav = (user, lesson) => as(user).get(`/api/v1/lessons/${lesson.id}/navigation`);

  it('skips lessons and modules a student cannot open', async () => {
    const { course, byTitle } = await courseFixture();
    await enroll(student, course);

    const first = await nav(student, byTitle['Lesson 1.1']);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      previous: null,
      next: { id: byTitle['Lesson 1.3'].id, title: 'Lesson 1.3', moduleTitle: 'Module 1' },
      position: 1,
      total: 3,
    });

    const middle = (await nav(student, byTitle['Lesson 1.3'])).body.data;
    expect(middle.previous.title).toBe('Lesson 1.1');
    expect(middle.next).toMatchObject({ title: 'Lesson 3.1', moduleTitle: 'Module 3' });

    const last = (await nav(student, byTitle['Lesson 3.1'])).body.data;
    expect(last).toMatchObject({ next: null, position: 3, total: 3 });
  });

  it('follows module order, not creation order', async () => {
    const { course, modules, byTitle } = await courseFixture();
    await enroll(student, course);
    // Module 3 moves to the front.
    for (const [index, order] of [1, 2, 0].entries()) {
      modules[index].module.order = order;
      await modules[index].module.save();
    }
    const res = (await nav(student, byTitle['Lesson 3.1'])).body.data;
    expect(res).toMatchObject({ previous: null, position: 1 });
    expect(res.next.title).toBe('Lesson 1.1');
  });

  it('includes every lesson for the trainer', async () => {
    const { byTitle } = await courseFixture();
    const res = (await nav(admin, byTitle['Lesson 1.3'])).body.data;
    expect(res).toMatchObject({ position: 3, total: 5 });
    expect(res.previous.title).toBe('Lesson 1.2');
    expect(res.next.title).toBe('Lesson 2.1');
  });

  it('returns 404 to students who cannot open the lesson', async () => {
    const { course, byTitle } = await courseFixture();
    expect((await nav(student, byTitle['Lesson 1.1'])).status).toBe(404);
    await enroll(student, course);
    expect((await nav(student, byTitle['Lesson 1.2'])).status).toBe(404);
    expect((await nav(student, byTitle['Lesson 2.1'])).status).toBe(404);
  });
});
