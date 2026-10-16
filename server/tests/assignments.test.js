import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Assignment, CourseModule, FileAsset, Lesson, Submission } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { PDF_MIME, samplePdf, storedFiles, upload, uploadPdf } from './file-helpers.js';
import { DAY, fromNow, makeAssignment, makeSubmission } from './assignment-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});

const iso = (date) => date.toISOString();

const validBody = (course, overrides = {}) => ({
  courseId: course.id,
  title: 'Portfolio page',
  instructions: '## Build it\n\nUse semantic HTML.',
  objectives: ['Use semantic tags'],
  dueAt: iso(fromNow(7 * DAY)),
  maxMarks: 100,
  allowedSubmissionTypes: ['github_url', 'project_url'],
  ...overrides,
});

const create = (user, body) => api(app).post('/api/v1/assignments').set(bearer(user)).send(body);
const update = (user, id, body) =>
  api(app).patch(`/api/v1/assignments/${id}`).set(bearer(user)).send(body);
const get = (user, id) => api(app).get(`/api/v1/assignments/${id}`).set(bearer(user));
const list = (user, query = {}) =>
  api(app).get('/api/v1/assignments').query(query).set(bearer(user));

const uploadHandout = async (course) => {
  const res = await upload(app, admin, {
    buffer: samplePdf('Brief'),
    filename: 'brief.pdf',
    contentType: PDF_MIME,
    courseId: course.id,
    purpose: 'assignment',
  });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('POST /assignments', () => {
  it('creates a draft assignment with defaults', async () => {
    const { course } = await makeCourse();
    const res = await create(admin, validBody(course));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      courseId: course.id,
      moduleId: null,
      lessonId: null,
      title: 'Portfolio page',
      maxMarks: 100,
      allowedSubmissionTypes: ['github_url', 'project_url'],
      latePolicy: { allowLate: false, lateUntil: null, penaltyPercent: 0 },
      maxAttempts: null,
      status: 'draft',
      attachments: [],
      course: { id: course.id, title: course.title },
      stats: { students: 0, awaitingReview: 0 },
    });
    expect(res.body.data.closesAt).toBe(res.body.data.dueAt);
  });

  it('stores dates in UTC whatever offset the client used', async () => {
    const { course } = await makeCourse();
    const res = await create(admin, validBody(course, { dueAt: '2030-01-15T23:59:00+05:30' }));
    expect(res.body.data.dueAt).toBe('2030-01-15T18:29:00.000Z');
  });

  it('places it in a lesson, which implies the lesson’s module', async () => {
    const { course, modules } = await makeCourse({
      shape: [{ lessons: ['published'] }, { lessons: ['published'] }],
    });
    const [lesson] = modules[1].lessons;
    const res = await create(admin, validBody(course, { lessonId: lesson.id }));
    expect(res.body.data).toMatchObject({
      moduleId: modules[1].module.id,
      lessonId: lesson.id,
      module: { id: modules[1].module.id, title: 'Module 2' },
      lesson: { id: lesson.id, title: 'Lesson 2.1' },
    });

    const mismatch = await create(
      admin,
      validBody(course, { moduleId: modules[0].module.id, lessonId: lesson.id }),
    );
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.details).toEqual([
      { path: 'lessonId', message: 'This lesson is not in the chosen module' },
    ]);
  });

  it('refuses modules and lessons of another course', async () => {
    const { course } = await makeCourse();
    const other = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const byModule = await create(
      admin,
      validBody(course, { moduleId: other.modules[0].module.id }),
    );
    expect(byModule.body.error.details[0].path).toBe('moduleId');
    const byLesson = await create(
      admin,
      validBody(course, { lessonId: other.modules[0].lessons[0].id }),
    );
    expect(byLesson.body.error.details[0].path).toBe('lessonId');
  });

  it('validates the fields', async () => {
    const { course } = await makeCourse();
    const res = await create(admin, {
      courseId: course.id,
      title: 'ab',
      dueAt: 'next friday',
      maxMarks: 0,
      allowedSubmissionTypes: ['zip'],
      maxAttempts: 50,
    });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'title',
        'dueAt',
        'maxMarks',
        'allowedSubmissionTypes.0',
        'maxAttempts',
      ]),
    );

    const none = await create(admin, validBody(course, { allowedSubmissionTypes: [] }));
    expect(none.body.error.details[0]).toEqual({
      path: 'allowedSubmissionTypes',
      message: 'Allow at least one way to submit',
    });

    const unknownCourse = await create(
      admin,
      validBody(course, { courseId: '0123456789abcdef01234567' }),
    );
    expect(unknownCourse.body.error.details).toEqual([
      { path: 'courseId', message: 'Course not found' },
    ]);
  });

  it('requires a late cutoff after the due date when late work is allowed', async () => {
    const { course } = await makeCourse();
    const dueAt = fromNow(7 * DAY);
    const missing = await create(
      admin,
      validBody(course, { dueAt: iso(dueAt), latePolicy: { allowLate: true, penaltyPercent: 10 } }),
    );
    expect(missing.body.error.details[0].path).toBe('latePolicy.lateUntil');

    const early = await create(
      admin,
      validBody(course, {
        dueAt: iso(dueAt),
        latePolicy: { allowLate: true, lateUntil: iso(dueAt), penaltyPercent: 10 },
      }),
    );
    expect(early.body.error.details[0]).toEqual({
      path: 'latePolicy.lateUntil',
      message: 'The late cutoff must be after the due date',
    });

    const lateUntil = new Date(dueAt.getTime() + 2 * DAY);
    const ok = await create(
      admin,
      validBody(course, {
        dueAt: iso(dueAt),
        latePolicy: { allowLate: true, lateUntil: iso(lateUntil), penaltyPercent: 15 },
      }),
    );
    expect(ok.body.data.latePolicy).toEqual({
      allowLate: true,
      lateUntil: iso(lateUntil),
      penaltyPercent: 15,
    });
    expect(ok.body.data.closesAt).toBe(iso(lateUntil));

    const penaltyRange = await create(
      admin,
      validBody(course, {
        latePolicy: { allowLate: true, lateUntil: iso(lateUntil), penaltyPercent: 120 },
      }),
    );
    expect(penaltyRange.body.error.details[0].path).toBe('latePolicy.penaltyPercent');
  });

  it('drops the penalty and cutoff when late work is not allowed', async () => {
    const { course } = await makeCourse();
    const res = await create(
      admin,
      validBody(course, {
        latePolicy: { allowLate: false, lateUntil: iso(fromNow(30 * DAY)), penaltyPercent: 50 },
      }),
    );
    expect(res.body.data.latePolicy).toEqual({
      allowLate: false,
      lateUntil: null,
      penaltyPercent: 0,
    });
  });

  it('attaches handouts uploaded for the same course only', async () => {
    const { course } = await makeCourse();
    const other = await makeCourse();
    const handout = await uploadHandout(course);
    const material = await uploadPdf(app, admin, course);
    const foreign = await uploadHandout(other.course);

    const res = await create(admin, validBody(course, { attachmentIds: [handout.id] }));
    expect(res.body.data.attachments).toEqual([
      expect.objectContaining({ id: handout.id, originalName: 'brief.pdf', purpose: 'assignment' }),
    ]);
    for (const fileId of [material.id, foreign.id]) {
      const refused = await create(admin, validBody(course, { attachmentIds: [fileId] }));
      expect(refused.status).toBe(400);
      expect(refused.body.error.details[0].path).toBe('attachmentIds');
    }
  });

  it('ignores client-supplied server fields and is admin-only', async () => {
    const { course } = await makeCourse();
    const res = await create(admin, validBody(course, { createdBy: student.id, stats: { x: 1 } }));
    const stored = await Assignment.findById(res.body.data.id);
    expect(stored.createdBy.equals(admin._id)).toBe(true);

    expect((await create(student, validBody(course))).status).toBe(403);
    expect((await api(app).post('/api/v1/assignments').send(validBody(course))).status).toBe(401);
  });
});

describe('PATCH /assignments/:id', () => {
  it('updates fields, placement and status, keeping the course', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const assignment = await makeAssignment(course, { status: 'draft' });
    const other = await makeCourse();

    const res = await update(admin, assignment.id, {
      title: 'Portfolio v2',
      moduleId: modules[0].module.id,
      status: 'published',
      courseId: other.course.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Portfolio v2',
      moduleId: modules[0].module.id,
      lessonId: null,
      status: 'published',
      courseId: course.id,
    });

    const cleared = await update(admin, assignment.id, { moduleId: null });
    expect(cleared.body.data.moduleId).toBeNull();
  });

  it('checks the late cutoff against a changed due date', async () => {
    const { course } = await makeCourse();
    const assignment = await makeAssignment(course, {
      dueAt: fromNow(DAY),
      latePolicy: { allowLate: true, lateUntil: fromNow(2 * DAY), penaltyPercent: 10 },
    });
    const res = await update(admin, assignment.id, { dueAt: iso(fromNow(3 * DAY)) });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('latePolicy.lateUntil');
  });

  it('refuses to lower maxMarks below marks already awarded', async () => {
    const { course } = await makeCourse();
    const assignment = await makeAssignment(course);
    await makeSubmission(assignment, student, {
      status: 'reviewed',
      review: { marks: 80, finalMarks: 80 },
    });
    const refused = await update(admin, assignment.id, { maxMarks: 50 });
    expect(refused.status).toBe(400);
    expect(refused.body.error.details[0].path).toBe('maxMarks');
    expect((await update(admin, assignment.id, { maxMarks: 80 })).status).toBe(200);
  });

  it('deletes a removed attachment once nothing uses it', async () => {
    const { course } = await makeCourse();
    const handout = await uploadHandout(course);
    const created = await create(admin, validBody(course, { attachmentIds: [handout.id] }));
    expect(await storedFiles()).toHaveLength(1);

    const res = await update(admin, created.body.data.id, { attachmentIds: [] });
    expect(res.body.data.attachments).toEqual([]);
    expect(await FileAsset.findById(handout.id)).toBeNull();
    expect(await storedFiles()).toEqual([]);
  });

  it('is admin-only and 404s for unknown ids', async () => {
    const { course } = await makeCourse();
    const assignment = await makeAssignment(course);
    expect((await update(student, assignment.id, { title: 'Hacked' })).status).toBe(403);
    expect((await update(admin, '0123456789abcdef01234567', { title: 'Nope' })).status).toBe(404);
    expect((await update(admin, 'not-an-id', { title: 'Nope' })).status).toBe(400);
  });
});

describe('DELETE /assignments/:id', () => {
  const remove = (user, id) => api(app).delete(`/api/v1/assignments/${id}`).set(bearer(user));

  it('deletes a draft with its unused attachments', async () => {
    const { course } = await makeCourse();
    const handout = await uploadHandout(course);
    const created = await create(admin, validBody(course, { attachmentIds: [handout.id] }));
    expect((await remove(admin, created.body.data.id)).status).toBe(204);
    expect(await Assignment.countDocuments()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it('refuses published assignments and ones with submissions', async () => {
    const { course } = await makeCourse();
    const published = await makeAssignment(course);
    expect((await remove(admin, published.id)).status).toBe(409);

    const archived = await makeAssignment(course, { status: 'archived' });
    await makeSubmission(archived, student);
    const res = await remove(admin, archived.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Archive it instead/);
    expect((await remove(student, archived.id)).status).toBe(403);
  });
});

describe('who can see assignments', () => {
  async function setup() {
    const { course, modules } = await makeCourse({
      shape: [{ lessons: ['published', 'draft'] }, { status: 'draft', lessons: ['published'] }],
    });
    await enroll(student, course);
    const [published, draftLesson] = modules[0].lessons;
    const items = {
      courseLevel: await makeAssignment(course, { title: 'Course level', dueAt: fromNow(DAY) }),
      inLesson: await makeAssignment(course, {
        title: 'In lesson',
        module: modules[0].module._id,
        lesson: published._id,
        dueAt: fromNow(2 * DAY),
      }),
      draft: await makeAssignment(course, { title: 'Draft', status: 'draft' }),
      archived: await makeAssignment(course, { title: 'Archived', status: 'archived' }),
      inDraftLesson: await makeAssignment(course, {
        title: 'In draft lesson',
        module: modules[0].module._id,
        lesson: draftLesson._id,
      }),
      inDraftModule: await makeAssignment(course, {
        title: 'In draft module',
        module: modules[1].module._id,
      }),
    };
    return { course, modules, items };
  }

  it('lists only published assignments of visible lessons and modules to enrolled students', async () => {
    const { course, items } = await setup();
    const res = await list(student, { course: course.id });
    expect(res.status).toBe(200);
    expect(res.body.data.map((a) => a.title)).toEqual(['Course level', 'In lesson']);
    expect(res.body.data[0]).not.toHaveProperty('stats');
    expect(res.body.data[0].mySubmission).toMatchObject({
      status: 'pending',
      attempts: 0,
      latest: null,
      canSubmit: true,
      canEdit: false,
    });

    for (const hidden of [items.draft, items.archived, items.inDraftLesson, items.inDraftModule]) {
      expect((await get(student, hidden.id)).status).toBe(404);
    }
    expect((await get(student, items.inLesson.id)).body.data.lesson.title).toBe('Lesson 1.1');
  });

  it('lets the trainer see and filter everything, with submission stats', async () => {
    const { course, modules, items } = await setup();
    await makeSubmission(items.courseLevel, student);
    await makeSubmission(items.courseLevel, otherStudent, { status: 'reviewed' });

    const all = await list(admin, { course: course.id });
    expect(all.body.data).toHaveLength(6);
    expect(all.body.data.find((a) => a.title === 'Course level').stats).toEqual({
      students: 2,
      awaitingReview: 1,
    });
    const drafts = await list(admin, { course: course.id, status: 'draft' });
    expect(drafts.body.data.map((a) => a.title)).toEqual(['Draft']);
    const byLesson = await list(admin, { lesson: modules[0].lessons[0].id });
    expect(byLesson.body.data.map((a) => a.title)).toEqual(['In lesson']);
    const byModule = await list(admin, { module: modules[1].module.id });
    expect(byModule.body.data.map((a) => a.title)).toEqual(['In draft module']);
  });

  it('ignores a status filter from students', async () => {
    const { course } = await setup();
    const res = await list(student, { course: course.id, status: 'draft' });
    expect(res.body.data.map((a) => a.title)).toEqual(['Course level', 'In lesson']);
  });

  it('hides everything without an active enrollment or a published course', async () => {
    const { course, items } = await setup();
    expect((await list(otherStudent, { course: course.id })).body.data).toEqual([]);
    expect((await get(otherStudent, items.courseLevel.id)).status).toBe(404);

    await enroll(otherStudent, course, 'pending');
    expect((await get(otherStudent, items.courseLevel.id)).status).toBe(404);

    course.status = 'archived';
    await course.save();
    expect((await list(student, { course: course.id })).body.data).toEqual([]);
    expect((await get(student, items.courseLevel.id)).status).toBe(404);
  });

  it('lists a student’s assignments across enrolled courses without a course filter', async () => {
    const { items } = await setup();
    const other = await makeCourse();
    await makeAssignment(other.course, { title: 'Not enrolled' });
    const res = await list(student);
    expect(res.body.data.map((a) => a.id)).toEqual([items.courseLevel.id, items.inLesson.id]);
  });

  it('reports the derived state of each assignment to the student', async () => {
    const { course } = await makeCourse();
    await enroll(student, course);
    await makeAssignment(course, { title: 'Overdue', dueAt: fromNow(-DAY) });
    const done = await makeAssignment(course, { title: 'Done', dueAt: fromNow(DAY) });
    await makeSubmission(done, student, {
      status: 'reviewed',
      review: { marks: 90, finalMarks: 90 },
    });
    const res = await list(student, { course: course.id });
    const byTitle = Object.fromEntries(res.body.data.map((a) => [a.title, a.mySubmission]));
    expect(byTitle.Overdue).toMatchObject({
      status: 'overdue',
      canSubmit: false,
      blockedReason: 'The submission window has closed.',
    });
    expect(byTitle.Done).toMatchObject({
      status: 'reviewed',
      attempts: 1,
      canSubmit: false,
      canEdit: false,
      latest: { attempt: 1, status: 'reviewed', finalMarks: 90 },
    });
  });
});

describe('assignment attachments', () => {
  const fetchFile = (user, fileId) => api(app).get(`/api/v1/files/${fileId}`).set(bearer(user));

  it('follow the visibility of their assignment', async () => {
    const { course } = await makeCourse();
    await enroll(student, course);
    const handout = await uploadHandout(course);
    const created = await create(
      admin,
      validBody(course, { attachmentIds: [handout.id], status: 'draft' }),
    );

    expect((await fetchFile(student, handout.id)).status).toBe(404);
    await update(admin, created.body.data.id, { status: 'published' });
    const res = await fetchFile(student, handout.id);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(PDF_MIME);
    expect((await fetchFile(otherStudent, handout.id)).status).toBe(404);
    expect((await api(app).get(`/api/v1/files/${handout.id}`)).status).toBe(404);
  });

  it('can only be uploaded by the trainer', async () => {
    const { course } = await makeCourse();
    const res = await upload(app, student, {
      buffer: samplePdf(),
      filename: 'brief.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
      purpose: 'assignment',
    });
    expect(res.status).toBe(403);
  });

  it('refuses a submission purpose on the trainer upload route', async () => {
    const { course } = await makeCourse();
    const res = await upload(app, admin, {
      buffer: samplePdf(),
      filename: 'work.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
      purpose: 'submission',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('purpose');
  });
});

describe('course content deletion with assignments', () => {
  const del = (path) => api(app).delete(`/api/v1${path}`).set(bearer(admin));

  it('refuses to delete a module or lesson that has assignments', async () => {
    const { course, modules } = await makeCourse({
      status: 'draft',
      shape: [{ status: 'draft', lessons: ['draft', 'draft'] }],
    });
    const [first, second] = modules[0].lessons;
    await makeAssignment(course, { module: modules[0].module._id, lesson: first._id });

    const lesson = await del(`/lessons/${first.id}`);
    expect(lesson.status).toBe(409);
    expect(lesson.body.error.message).toMatch(/This lesson has 1 assignment/);
    const module = await del(`/modules/${modules[0].module.id}`);
    expect(module.status).toBe(409);
    expect(module.body.error.message).toMatch(/This module has 1 assignment/);
    expect((await del(`/lessons/${second.id}`)).status).toBe(204);
  });

  it('deletes a course’s assignments with it, but not when work was submitted', async () => {
    const { course } = await makeCourse({ status: 'draft' });
    const handout = await uploadHandout(course);
    const created = await create(admin, validBody(course, { attachmentIds: [handout.id] }));

    const withWork = await makeAssignment(course, { status: 'archived' });
    await makeSubmission(withWork, student);
    await enroll(student, course, 'removed');
    const refused = await del(`/courses/${course.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/submitted work/);

    await withWork.deleteOne();
    await Submission.deleteMany({});
    expect((await del(`/courses/${course.id}`)).status).toBe(204);
    expect(await Assignment.findById(created.body.data.id)).toBeNull();
    expect(await storedFiles()).toEqual([]);
  });

  it('moves a lesson’s assignments with the lesson to its new module', async () => {
    const { course, modules } = await makeCourse({
      shape: [{ lessons: ['published'] }, { lessons: [] }],
    });
    const [lesson] = modules[0].lessons;
    const assignment = await makeAssignment(course, {
      module: modules[0].module._id,
      lesson: lesson._id,
    });
    const res = await api(app)
      .patch(`/api/v1/lessons/${lesson.id}`)
      .set(bearer(admin))
      .send({ moduleId: modules[1].module.id });
    expect(res.status).toBe(200);
    const moved = await Assignment.findById(assignment.id);
    expect(moved.module.equals(modules[1].module._id)).toBe(true);
    expect(moved.lesson.equals(lesson._id)).toBe(true);
    expect(await Lesson.countDocuments({ module: modules[1].module._id })).toBe(1);
    expect(await CourseModule.countDocuments()).toBe(2);
  });
});
