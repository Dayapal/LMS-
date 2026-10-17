import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import {
  Course,
  CourseModule,
  Enrollment,
  Lesson,
  LessonProgress,
  Submission,
} from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { makeAssignment, makeSubmission } from './assignment-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});

const complete = (user, lesson) =>
  api(app).post(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(user));
const uncomplete = (user, lesson) =>
  api(app).delete(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(user));
const roadmap = (user, course) =>
  api(app).get(`/api/v1/courses/${course.id}/roadmap`).set(bearer(user));
const myCourses = (user) => api(app).get('/api/v1/me/courses').set(bearer(user));

/** A published course with 2 published modules of 2 published lessons each. */
async function publishedCourse() {
  const { course, modules } = await makeCourse({
    shape: [{ lessons: ['published', 'published'] }, { lessons: ['published', 'published'] }],
  });
  return { course, modules, lessons: modules.flatMap((m) => m.lessons) };
}

const progressOf = async (user, course) => (await roadmap(user, course)).body.data.progress;

describe('POST /lessons/:id/complete', () => {
  it('marks the lesson complete for the caller and returns the new course progress', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);

    const res = await complete(student, lessons[0]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      lessonId: lessons[0].id,
      courseId: course.id,
      completed: true,
      courseProgress: {
        completedLessons: 1,
        totalLessons: 4,
        percent: 25,
        completed: false,
        nextLesson: { id: lessons[1].id, kind: 'next' },
      },
    });
    const record = await LessonProgress.findOne({ lesson: lessons[0]._id });
    expect(record.user.equals(student._id)).toBe(true);
    expect(record.course.equals(course._id)).toBe(true);
  });

  it('is idempotent and keeps the first completion date', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    const first = await complete(student, lessons[0]);
    const second = await complete(student, lessons[0]);
    expect(second.status).toBe(200);
    expect(second.body.data.completedAt).toBe(first.body.data.completedAt);
    expect(await LessonProgress.countDocuments()).toBe(1);
  });

  it('ignores everything in the body: user, course, date and percentages', async () => {
    const { course, lessons } = await publishedCourse();
    const other = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);

    const res = await complete(student, lessons[0]).send({
      user: otherStudent.id,
      course: other.course.id,
      completedAt: '2000-01-01T00:00:00.000Z',
      percent: 100,
      completedLessons: 4,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.courseProgress.percent).toBe(25);
    const record = await LessonProgress.findOne();
    expect(record.user.equals(student._id)).toBe(true);
    expect(record.course.equals(course._id)).toBe(true);
    expect(record.completedAt.getUTCFullYear()).toBeGreaterThan(2000);
  });

  it('is backed by a unique index on student and lesson', async () => {
    const { course, lessons } = await publishedCourse();
    const indexes = await LessonProgress.collection.indexes();
    const unique = indexes.find((i) => i.unique);
    expect(unique.key).toEqual({ user: 1, lesson: 1 });
    expect(indexes.map((i) => i.key)).toEqual(
      expect.arrayContaining([{ user: 1, course: 1 }, { lesson: 1 }, { course: 1 }]),
    );
    const record = { user: student._id, course: course._id, lesson: lessons[0]._id };
    await LessonProgress.create({ ...record, completedAt: new Date() });
    await expect(LessonProgress.create({ ...record, completedAt: new Date() })).rejects.toThrow(
      /duplicate key/,
    );
  });

  it('handles concurrent complete and uncomplete requests without duplicates', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 ? uncomplete(student, lessons[0]) : complete(student, lessons[0]),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await LessonProgress.countDocuments()).toBeLessThanOrEqual(1);
  });

  it('handles two concurrent requests for the same lesson', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    const results = await Promise.all([
      complete(student, lessons[0]),
      complete(student, lessons[0]),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await LessonProgress.countDocuments()).toBe(1);
  });

  it.each([
    ['not enrolled', null],
    ['with a pending request', 'pending'],
    ['after being removed', 'removed'],
  ])('returns 404 to a student %s', async (_label, status) => {
    const { course, lessons } = await publishedCourse();
    if (status) await enroll(student, course, status);
    const res = await complete(student, lessons[0]);
    expect(res.status).toBe(404);
    expect(await LessonProgress.countDocuments()).toBe(0);
  });

  it('returns 404 for unpublished lessons, modules and courses', async () => {
    const { course, modules } = await makeCourse({
      shape: [
        { lessons: ['draft', 'archived', 'published'] },
        { status: 'draft', lessons: ['published'] },
      ],
    });
    await enroll(student, course);
    const [draft, archived, visible] = modules[0].lessons;
    const [inDraftModule] = modules[1].lessons;
    for (const lesson of [draft, archived, inDraftModule]) {
      expect((await complete(student, lesson)).status).toBe(404);
    }

    await Course.updateOne({ _id: course._id }, { status: 'archived' });
    expect((await complete(student, visible)).status).toBe(404);
    expect(await LessonProgress.countDocuments()).toBe(0);
  });

  it('is for students only: 403 for the trainer, 401 anonymous, 400/404 for bad ids', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    expect((await complete(admin, lessons[0])).status).toBe(403);
    expect((await uncomplete(admin, lessons[0])).status).toBe(403);
    expect((await api(app).post(`/api/v1/lessons/${lessons[0].id}/complete`)).status).toBe(401);
    expect((await complete(student, { id: 'not-an-id' })).status).toBe(400);
    expect((await complete(student, { id: '64b7f0000000000000000000' })).status).toBe(404);
  });
});

describe('DELETE /lessons/:id/complete', () => {
  it('marks the lesson incomplete again, and is idempotent', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await complete(student, lessons[1]);

    const res = await uncomplete(student, lessons[0]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      completed: false,
      completedAt: null,
      courseProgress: { completedLessons: 1, percent: 25 },
    });
    expect((await uncomplete(student, lessons[0])).status).toBe(200);
    expect(await LessonProgress.countDocuments()).toBe(1);
  });

  it("never touches another student's record", async () => {
    const { course, lessons } = await publishedCourse();
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    await complete(otherStudent, lessons[0]);
    await uncomplete(student, lessons[0]);
    expect(await LessonProgress.countDocuments({ user: otherStudent._id })).toBe(1);
  });

  it('applies the same visibility rules as completing', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await Enrollment.updateOne({ user: student._id }, { status: 'removed' });
    expect((await uncomplete(student, lessons[0])).status).toBe(404);
    // The record survives the removal.
    expect(await LessonProgress.countDocuments()).toBe(1);
  });
});

describe('progress follows the published content', () => {
  it('drops when the trainer adds a lesson', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await complete(student, lessons[1]);
    expect((await progressOf(student, course)).percent).toBe(50);

    await Lesson.create({
      course: course._id,
      module: modules[1].module._id,
      title: 'New lesson',
      slug: 'new-lesson',
      order: 9,
      status: 'published',
    });
    expect(await progressOf(student, course)).toMatchObject({
      completedLessons: 2,
      totalLessons: 5,
      percent: 40,
    });
  });

  it('ignores draft lessons the trainer adds', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await Lesson.create({
      course: course._id,
      module: modules[0].module._id,
      title: 'Draft lesson',
      slug: 'draft-lesson',
      order: 9,
      status: 'draft',
    });
    expect((await progressOf(student, course)).totalLessons).toBe(4);
  });

  it('leaves out an unpublished or archived lesson, and counts it again when it returns', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await complete(student, lessons[1]);

    await Lesson.updateOne({ _id: lessons[0]._id }, { status: 'draft' });
    expect(await progressOf(student, course)).toMatchObject({
      completedLessons: 1,
      totalLessons: 3,
      percent: 33,
    });
    await Lesson.updateOne({ _id: lessons[0]._id }, { status: 'archived' });
    expect((await progressOf(student, course)).totalLessons).toBe(3);

    await Lesson.updateOne({ _id: lessons[0]._id }, { status: 'published' });
    expect(await progressOf(student, course)).toMatchObject({
      completedLessons: 2,
      totalLessons: 4,
      percent: 50,
    });
  });

  it('leaves out every lesson of an unpublished module', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await complete(student, lessons[2]);
    await CourseModule.updateOne({ _id: modules[1].module._id }, { status: 'draft' });
    expect(await progressOf(student, course)).toMatchObject({
      completedLessons: 1,
      totalLessons: 2,
      percent: 50,
    });
  });

  it('gives the same numbers on the roadmap, my courses, the dashboard and after completing', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[2]);
    await CourseModule.updateOne({ _id: modules[1].module._id }, { status: 'draft' });
    await Lesson.updateOne({ _id: lessons[1]._id }, { status: 'archived' });

    const expected = { completedLessons: 0, totalLessons: 1, percent: 0 };
    expect(await progressOf(student, course)).toMatchObject(expected);
    expect((await myCourses(student)).body.data[0].progress).toMatchObject(expected);
    const dashboard = await api(app).get('/api/v1/dashboard/student').set(bearer(student));
    expect(dashboard.body.data.courses[0].progress).toMatchObject(expected);
    expect(dashboard.body.data.summary.lessonsCompleted).toBe(0);

    const after = await complete(student, lessons[0]);
    expect(after.body.data.courseProgress).toMatchObject({
      completedLessons: 1,
      totalLessons: 1,
      percent: 100,
      completed: true,
    });
  });

  it('reaches 100% only when every lesson is done, and stays correct after one is added', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    for (const lesson of lessons) await complete(student, lesson);
    expect(await progressOf(student, course)).toMatchObject({
      percent: 100,
      completed: true,
      nextLesson: null,
    });

    const added = await Lesson.create({
      course: course._id,
      module: modules[0].module._id,
      title: 'Bonus',
      slug: 'bonus',
      order: 9,
      status: 'published',
    });
    expect(await progressOf(student, course)).toMatchObject({
      percent: 80,
      completed: false,
      nextLesson: { id: added.id },
    });
  });

  it('keeps progress through enrollment removal and restores it on re-enrollment', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await Enrollment.updateOne({ user: student._id }, { status: 'removed' });
    expect((await myCourses(student)).body.data).toEqual([]);

    await Enrollment.updateOne({ user: student._id }, { status: 'active' });
    expect((await progressOf(student, course)).completedLessons).toBe(1);
  });
});

describe('GET /courses/:id/roadmap with progress', () => {
  it("gives an enrolled student their own completion flags and progress, nobody else's", async () => {
    const { course, lessons } = await publishedCourse();
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    await complete(student, lessons[0]);
    await complete(student, lessons[2]);

    const mine = (await roadmap(student, course)).body.data;
    expect(mine.modules.map((m) => m.lessons.map((l) => l.completed))).toEqual([
      [true, false],
      [true, false],
    ]);
    expect(mine.progress).toMatchObject({ completedLessons: 2, totalLessons: 4, percent: 50 });

    const theirs = (await roadmap(otherStudent, course)).body.data;
    expect(theirs.modules.flatMap((m) => m.lessons).some((l) => l.completed)).toBe(false);
    expect(theirs.progress).toMatchObject({ completedLessons: 0, nextLesson: { kind: 'start' } });
  });

  it('has no progress for students who are not enrolled, and none for the trainer', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);

    const visitor = (await roadmap(otherStudent, course)).body.data;
    expect(visitor.progress).toBeNull();
    expect(visitor.modules[0].lessons[0]).not.toHaveProperty('completed');

    const trainer = (await roadmap(admin, course)).body.data;
    expect(trainer).not.toHaveProperty('progress');
    expect(trainer.modules[0].lessons[0]).not.toHaveProperty('completed');
  });
});

describe('reading is read-only', () => {
  /** Every document of every collection, to compare before and after. */
  const snapshot = async () => {
    const collections = await mongoose.connection.db.collections();
    const entries = await Promise.all(
      collections.map(async (c) => [c.collectionName, await c.find().sort({ _id: 1 }).toArray()]),
    );
    return JSON.stringify(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))));
  };

  it('GET requests for lessons, progress and dashboards change nothing', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    const before = await snapshot();

    const lessonPaths = lessons.flatMap((l) => [
      `/lessons/${l.id}`,
      `/lessons/${l.id}/materials`,
      `/lessons/${l.id}/navigation`,
    ]);
    const paths = [
      ...lessonPaths,
      `/courses/${course.id}`,
      `/courses/${course.id}/roadmap`,
      '/me/courses',
      '/me/assignments',
      '/dashboard/student',
      '/assignments',
    ];
    for (const path of paths) {
      const res = await api(app).get(`/api/v1${path}`).set(bearer(student));
      expect(res.status, path).toBe(200);
    }
    await api(app).get(`/api/v1/lessons/${lessons[1].id}`).set(bearer(admin));
    expect(await snapshot()).toBe(before);
  });

  it('GET /lessons/:id returns the student’s own completion only', async () => {
    const { course, lessons } = await publishedCourse();
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    await complete(otherStudent, lessons[0]);
    const mine = await api(app).get(`/api/v1/lessons/${lessons[0].id}`).set(bearer(student));
    expect(mine.body.data.completion).toEqual({ completed: false, completedAt: null });
    await complete(student, lessons[0]);
    const after = await api(app).get(`/api/v1/lessons/${lessons[0].id}`).set(bearer(student));
    expect(after.body.data.completion.completed).toBe(true);
    const trainer = await api(app).get(`/api/v1/lessons/${lessons[0].id}`).set(bearer(admin));
    expect(trainer.body.data).not.toHaveProperty('completion');
  });
});

describe('POST /lessons/:id/visit (continue learning)', () => {
  const visit = (user, lesson) =>
    api(app).post(`/api/v1/lessons/${lesson.id}/visit`).set(bearer(user));
  const enrollmentOf = (user) => Enrollment.findOne({ user: user._id }).lean();

  it('records the lesson as the student’s continue point', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);

    const res = await visit(student, lessons[2]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ lessonId: lessons[2].id, courseId: course.id });
    const enrollment = await enrollmentOf(student);
    expect(enrollment.lastLesson.equals(lessons[2]._id)).toBe(true);
    expect(enrollment.lastAccessedAt.toISOString()).toBe(res.body.data.visitedAt);
    expect((await progressOf(student, course)).nextLesson).toMatchObject({
      id: lessons[2].id,
      kind: 'resume',
      moduleTitle: 'Module 2',
    });
  });

  it('updates only the caller’s enrollment and ignores the body', async () => {
    const { course, lessons } = await publishedCourse();
    const other = await publishedCourse();
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    await visit(otherStudent, lessons[1]);
    const theirsBefore = await enrollmentOf(otherStudent);

    const res = await visit(student, lessons[3]).send({
      user: otherStudent.id,
      lessonId: lessons[0].id,
      courseId: other.course.id,
      lastAccessedAt: '2000-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const mine = await enrollmentOf(student);
    expect(mine.lastLesson.equals(lessons[3]._id)).toBe(true);
    expect(mine.lastAccessedAt.getUTCFullYear()).toBeGreaterThan(2000);
    expect(await enrollmentOf(otherStudent)).toEqual(theirsBefore);
    expect(await Enrollment.countDocuments()).toBe(2);
  });

  it('refuses lessons the student cannot open, without moving the continue point', async () => {
    const { course, modules, lessons } = await makeCourse({
      shape: [
        { lessons: ['published', 'draft', 'archived'] },
        { status: 'draft', lessons: ['published'] },
      ],
    }).then((c) => ({ ...c, lessons: c.modules.flatMap((m) => m.lessons) }));
    await enroll(student, course);
    await visit(student, lessons[0]);
    const before = await enrollmentOf(student);

    const otherCourse = await publishedCourse();
    for (const lesson of [lessons[1], lessons[2], modules[1].lessons[0], otherCourse.lessons[0]]) {
      expect((await visit(student, lesson)).status).toBe(404);
    }
    expect((await visit(student, { id: '64b7f0000000000000000000' })).status).toBe(404);
    expect((await visit(student, { id: 'not-an-id' })).status).toBe(400);
    expect(await enrollmentOf(student)).toEqual(before);
  });

  it.each(['pending', 'removed'])(
    'returns 404 with a %s enrollment and changes nothing',
    async (status) => {
      const { course, lessons } = await publishedCourse();
      await enroll(student, course, status);
      const before = await enrollmentOf(student);
      expect((await visit(student, lessons[0])).status).toBe(404);
      expect(await enrollmentOf(student)).toEqual(before);
    },
  );

  it('is for students only and needs a token', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    expect((await visit(admin, lessons[0])).status).toBe(403);
    expect((await api(app).post(`/api/v1/lessons/${lessons[0].id}/visit`)).status).toBe(401);
    expect((await enrollmentOf(student)).lastLesson).toBeUndefined();
  });

  it('moves on to the next lesson after completing the one visited', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await visit(student, lessons[1]);
    await complete(student, lessons[1]);
    expect((await progressOf(student, course)).nextLesson).toMatchObject({
      id: lessons[2].id,
      kind: 'next',
    });
  });
});

describe('GET /me/courses', () => {
  it('reports a course without published lessons as empty, not finished', async () => {
    const { course } = await makeCourse({ shape: [{ lessons: ['draft'] }] });
    await enroll(student, course);
    const [item] = (await myCourses(student)).body.data;
    expect(item.progress).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      percent: 0,
      completed: false,
      lastCompletedAt: null,
      nextLesson: null,
    });
  });

  it('lists active courses by recent activity with progress, then pending requests', async () => {
    const a = await publishedCourse();
    const b = await publishedCourse();
    const pending = await publishedCourse();
    const archived = await publishedCourse();
    const removed = await publishedCourse();
    await enroll(student, a.course);
    await enroll(student, b.course);
    await enroll(student, pending.course, 'pending');
    await enroll(student, archived.course);
    await enroll(student, removed.course, 'removed');
    await Course.updateOne({ _id: archived.course._id }, { status: 'archived' });
    await complete(student, a.lessons[0]);
    await complete(student, b.lessons[0]);
    await complete(student, b.lessons[1]); // B was studied last.

    const res = await myCourses(student);
    expect(res.status).toBe(200);
    expect(res.body.data.map((item) => item.course.id)).toEqual([
      b.course.id,
      a.course.id,
      pending.course.id,
    ]);
    const [first, , request] = res.body.data;
    expect(first).toMatchObject({
      course: { title: b.course.title },
      enrollment: { status: 'active' },
      progress: { completedLessons: 2, percent: 50, nextLesson: { id: b.lessons[2].id } },
    });
    expect(first.course).not.toHaveProperty('description');
    expect(request).toMatchObject({ enrollment: { status: 'pending' }, progress: null });
  });

  it('shows only the caller’s own progress', async () => {
    const { course, lessons } = await publishedCourse();
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    await complete(otherStudent, lessons[0]);
    const [item] = (await myCourses(student)).body.data;
    expect(item.progress.completedLessons).toBe(0);
  });

  it('is empty for a new student and refused to the trainer', async () => {
    expect((await myCourses(student)).body.data).toEqual([]);
    expect((await myCourses(admin)).status).toBe(403);
    expect((await api(app).get('/api/v1/me/courses')).status).toBe(401);
  });
});

describe('deleting content with progress', () => {
  it('refuses a lesson students completed, even after it is unpublished', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await Lesson.updateOne({ _id: lessons[0]._id }, { status: 'archived' });

    const res = await api(app).delete(`/api/v1/lessons/${lessons[0].id}`).set(bearer(admin));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/completed this lesson/);
    expect(await Lesson.exists({ _id: lessons[0]._id })).toBeTruthy();

    await Lesson.updateOne({ _id: lessons[1]._id }, { status: 'draft' });
    const free = await api(app).delete(`/api/v1/lessons/${lessons[1].id}`).set(bearer(admin));
    expect(free.status).toBe(204);
  });

  it('refuses a module with completed lessons', async () => {
    const { course, modules, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[2]);
    await CourseModule.updateOne({ _id: modules[1].module._id }, { status: 'draft' });
    await Lesson.updateMany({ module: modules[1].module._id }, { status: 'draft' });

    const res = await api(app).delete(`/api/v1/modules/${modules[1].module.id}`).set(bearer(admin));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/completed lessons in this module/);
    expect(await Lesson.countDocuments({ module: modules[1].module._id })).toBe(2);
  });

  it('refuses a course with progress, even when the student was removed', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    await Enrollment.updateOne({ user: student._id }, { status: 'removed' });
    await Course.updateOne({ _id: course._id }, { status: 'archived' });

    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(bearer(admin));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/completed lessons in this course/);
    expect(await LessonProgress.countDocuments()).toBe(1);
  });

  it('keeps progress and submissions through archiving and brings them back on republishing', async () => {
    const { course, lessons } = await publishedCourse();
    await enroll(student, course);
    await complete(student, lessons[0]);
    const assignment = await makeAssignment(course);
    await makeSubmission(assignment, student);

    await api(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set(bearer(admin))
      .send({ status: 'archived' });
    expect((await myCourses(student)).body.data).toEqual([]);
    expect((await complete(student, lessons[1])).status).toBe(404);
    const refused = await api(app).delete(`/api/v1/courses/${course.id}`).set(bearer(admin));
    expect(refused.status).toBe(409);
    expect(await LessonProgress.countDocuments()).toBe(1);
    expect(await Submission.countDocuments()).toBe(1);

    await api(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set(bearer(admin))
      .send({ status: 'published' });
    const [item] = (await myCourses(student)).body.data;
    expect(item.progress).toMatchObject({ completedLessons: 1, percent: 25 });
  });

  it('still deletes a course nobody has progress in', async () => {
    const { course } = await publishedCourse();
    await Course.updateOne({ _id: course._id }, { status: 'draft' });
    const res = await api(app).delete(`/api/v1/courses/${course.id}`).set(bearer(admin));
    expect(res.status).toBe(204);
  });
});
