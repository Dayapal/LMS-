import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { Notification, ROLES } from '../src/models/index.js';
import {
  refreshDeadlineReminders,
  resetDeadlineChecks,
} from '../src/services/deadlineReminders.js';
import { api, createUser } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import {
  DAY,
  HOUR,
  fromNow,
  githubItem,
  makeAssignment,
  makeSubmission,
  requestResubmission,
  review,
  submit,
  editSubmission,
} from './assignment-helpers.js';

let app;
let admin;
let student;
let otherStudent;
const defaultInterval = config.notifications.deadlineCheckIntervalMs;

beforeEach(async () => {
  app = createApp();
  resetDeadlineChecks();
  ({ admin, student, otherStudent } = await actors());
});

afterEach(() => {
  config.notifications.deadlineCheckIntervalMs = defaultInterval;
  vi.restoreAllMocks();
});

const as = (user) => ({
  get: (path, query = {}) => api(app).get(path).query(query).set(bearer(user)),
  post: (path, body) => api(app).post(path).set(bearer(user)).send(body),
  patch: (path, body) => api(app).patch(path).set(bearer(user)).send(body),
});

const NOTE = { type: 'note', title: 'Overview', body: 'Some **notes**.' };

const notificationsOf = (user) =>
  Notification.find({ user: user._id }).sort({ createdAt: -1 }).lean();

const assignmentBody = (course, overrides = {}) => ({
  courseId: course.id,
  title: 'Portfolio page',
  instructions: 'Build it.',
  dueAt: fromNow(7 * DAY).toISOString(),
  maxMarks: 100,
  allowedSubmissionTypes: ['github_url'],
  ...overrides,
});

/** A published course with one published lesson; `student` enrolled. */
async function enrolledLesson(shape = [{ lessons: ['published'] }], courseStatus = 'published') {
  const { course, modules } = await makeCourse({ status: courseStatus, shape });
  await enroll(student, course);
  return { course, module: modules[0].module, lesson: modules[0].lessons[0] };
}

describe('material_published', () => {
  it('tells actively enrolled students once, with a link to the lesson', async () => {
    const { course, lesson } = await enrolledLesson();
    const pending = await createUser();
    const removed = await createUser();
    const inactive = await createUser({ isActive: false });
    await Promise.all([
      enroll(pending, course, 'pending'),
      enroll(removed, course, 'removed'),
      enroll(inactive, course),
    ]);

    const res = await as(admin).post(`/api/v1/lessons/${lesson.id}/materials`, {
      ...NOTE,
      status: 'published',
    });
    expect(res.status).toBe(201);

    const [notification] = await notificationsOf(student);
    expect(notification).toMatchObject({
      type: 'material_published',
      title: 'New material: Overview',
      body: `${lesson.title} · ${course.title}`,
      link: `/app/courses/${course.id}/lessons/${lesson.id}`,
      readAt: null,
    });
    for (const user of [pending, removed, inactive, otherStudent, admin]) {
      expect(await notificationsOf(user)).toHaveLength(0);
    }
  });

  it('notifies when a draft is published, and never twice for the same material', async () => {
    const { lesson } = await enrolledLesson();
    const created = await as(admin).post(`/api/v1/lessons/${lesson.id}/materials`, NOTE);
    expect(await notificationsOf(student)).toHaveLength(0);

    const id = created.body.data.id;
    await as(admin).patch(`/api/v1/materials/${id}`, { status: 'published' });
    await as(admin).patch(`/api/v1/materials/${id}`, { title: 'Overview, edited' });
    await as(admin).patch(`/api/v1/materials/${id}`, { status: 'draft' });
    await as(admin).patch(`/api/v1/materials/${id}`, { status: 'published' });

    const list = await notificationsOf(student);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('New material: Overview');
  });

  it.each([
    ['a draft lesson', [{ lessons: ['draft'] }], 'published'],
    ['a draft module', [{ status: 'draft', lessons: ['published'] }], 'published'],
    ['a draft course', [{ lessons: ['published'] }], 'draft'],
  ])('stays quiet for materials in %s, which students cannot open', async (_, shape, status) => {
    const { lesson } = await enrolledLesson(shape, status);
    await as(admin).post(`/api/v1/lessons/${lesson.id}/materials`, {
      ...NOTE,
      status: 'published',
    });
    expect(await notificationsOf(student)).toHaveLength(0);
  });
});

describe('assignment_published', () => {
  it('tells enrolled students when an assignment is created as published', async () => {
    const { course } = await enrolledLesson();
    const res = await as(admin).post(
      '/api/v1/assignments',
      assignmentBody(course, { status: 'published' }),
    );
    expect(res.status).toBe(201);
    const [notification] = await notificationsOf(student);
    expect(notification).toMatchObject({
      type: 'assignment_published',
      title: 'New assignment: Portfolio page',
      body: course.title,
      link: `/app/courses/${course.id}/assignments/${res.body.data.id}`,
    });
    expect(await notificationsOf(otherStudent)).toHaveLength(0);
  });

  it('notifies on the move to published only, once', async () => {
    const { course } = await enrolledLesson();
    const created = await as(admin).post('/api/v1/assignments', assignmentBody(course));
    const id = created.body.data.id;
    expect(await notificationsOf(student)).toHaveLength(0);

    await as(admin).patch(`/api/v1/assignments/${id}`, { status: 'published' });
    await as(admin).patch(`/api/v1/assignments/${id}`, { maxMarks: 50 });
    await as(admin).patch(`/api/v1/assignments/${id}`, { status: 'archived' });
    await as(admin).patch(`/api/v1/assignments/${id}`, { status: 'published' });
    expect(await notificationsOf(student)).toHaveLength(1);
  });

  it('stays quiet for an assignment in a module students cannot see', async () => {
    const { course, module } = await enrolledLesson([{ status: 'draft', lessons: ['draft'] }]);
    await as(admin).post(
      '/api/v1/assignments',
      assignmentBody(course, { status: 'published', moduleId: module.id }),
    );
    expect(await notificationsOf(student)).toHaveLength(0);
  });
});

describe('submission_received', () => {
  it('tells active trainers about new attempts, not about edits', async () => {
    const { course } = await enrolledLesson();
    const retired = await createUser({ role: ROLES.ADMIN, isActive: false });
    const assignment = await makeAssignment(course, { allowedSubmissionTypes: ['github_url'] });

    const first = await submit(app, student, assignment, { items: [githubItem()] });
    expect(first.status).toBe(201);
    const [notification] = await notificationsOf(admin);
    expect(notification).toMatchObject({
      type: 'submission_received',
      title: 'New submission: Build a portfolio',
      body: 'Student handed in their work.',
      link: `/admin/courses/${course.id}/assignments/${assignment.id}/submissions/${first.body.data.id}`,
    });

    await editSubmission(app, student, first.body.data.id, { items: [githubItem('v2')] });
    expect(await notificationsOf(admin)).toHaveLength(1);
    expect(await notificationsOf(retired)).toHaveLength(0);
    expect(await notificationsOf(student)).toHaveLength(0);

    await requestResubmission(app, admin, first.body.data.id, { feedback: 'Add tests' });
    await submit(app, student, assignment, { items: [githubItem('v3')] });
    const [latest] = await notificationsOf(admin);
    expect(latest.body).toBe('Student handed in attempt 2.');
    expect(await notificationsOf(admin)).toHaveLength(2);
  });
});

describe('submission_reviewed and resubmit_requested', () => {
  it('tells the student, keeping one notification per attempt with the latest decision', async () => {
    const { course } = await enrolledLesson();
    const assignment = await makeAssignment(course);
    const submission = await makeSubmission(assignment, student);
    const link = `/app/courses/${course.id}/assignments/${assignment.id}`;

    await review(app, admin, submission.id, { marks: 70, feedback: 'Good' });
    let list = await notificationsOf(student);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      type: 'submission_reviewed',
      title: 'Feedback on Build a portfolio',
      link,
      readAt: null,
    });
    // Nothing about marks or feedback is copied into the notification. (Only the
    // text fields: random ObjectIds in the ids and link can contain "70".)
    expect(`${list[0].title} ${list[0].body}`).not.toMatch(/70|Good/);

    await as(student).patch(`/api/v1/notifications/${list[0]._id}/read`);
    await review(app, admin, submission.id, { marks: 80, feedback: 'Better' });
    list = await notificationsOf(student);
    expect(list).toHaveLength(1);
    expect(list[0].readAt).toBeNull();

    await requestResubmission(app, admin, submission.id, { feedback: 'One more go' });
    list = await notificationsOf(student);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      type: 'resubmit_requested',
      title: 'New attempt requested: Build a portfolio',
      link,
    });
    expect(await notificationsOf(otherStudent)).toHaveLength(0);
  });
});

describe('deadline_soon', () => {
  const count = (user) => as(user).get('/api/v1/notifications/unread-count');

  it('reminds a student of work due within 24 hours that they have not handed in', async () => {
    config.notifications.deadlineCheckIntervalMs = 0;
    const { course } = await enrolledLesson();
    const soon = await makeAssignment(course, { title: 'Soon', dueAt: fromNow(12 * HOUR) });
    const done = await makeAssignment(course, { title: 'Done', dueAt: fromNow(6 * HOUR) });
    await makeSubmission(done, student);
    // A requested resubmission can be handed in after the deadline, so no reminder.
    const again = await makeAssignment(course, { title: 'Again', dueAt: fromNow(6 * HOUR) });
    await makeSubmission(again, student, { status: 'resubmit_requested' });
    await makeAssignment(course, { title: 'Later', dueAt: fromNow(3 * DAY) });
    await makeAssignment(course, { title: 'Past', dueAt: fromNow(-HOUR) });
    await makeAssignment(course, { title: 'Draft', dueAt: fromNow(HOUR), status: 'draft' });
    const other = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await makeAssignment(other.course, { title: 'Not enrolled', dueAt: fromNow(HOUR) });

    const res = await count(student);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ count: 1 });
    const [reminder] = await notificationsOf(student);
    expect(reminder).toMatchObject({
      type: 'deadline_soon',
      title: 'Due soon: Soon',
      link: `/app/courses/${course.id}/assignments/${soon.id}`,
    });

    // Checking again doesn't repeat it; moving the deadline reminds again.
    await count(student);
    expect(await notificationsOf(student)).toHaveLength(1);
    soon.dueAt = fromNow(20 * HOUR);
    await soon.save();
    await count(student);
    expect(await notificationsOf(student)).toHaveLength(2);
  });

  it('works out each student’s reminders at most once per interval', async () => {
    const { course } = await enrolledLesson();
    const start = new Date();
    await refreshDeadlineReminders(student, start);
    await makeAssignment(course, { dueAt: fromNow(2 * HOUR) });

    await refreshDeadlineReminders(student, new Date(start.getTime() + 60_000));
    expect(await notificationsOf(student)).toHaveLength(0);
    await refreshDeadlineReminders(student, new Date(start.getTime() + defaultInterval));
    expect(await notificationsOf(student)).toHaveLength(1);
  });

  it('is never sent to the trainer', async () => {
    config.notifications.deadlineCheckIntervalMs = 0;
    const { course } = await enrolledLesson();
    await makeAssignment(course, { dueAt: fromNow(HOUR) });
    expect((await count(admin)).body.data).toEqual({ count: 0 });
  });
});

describe('notification endpoints', () => {
  async function seedNotifications() {
    const base = Date.now();
    const mine = await Notification.insertMany(
      [1, 2, 3].map((i) => ({
        user: student._id,
        type: 'assignment_published',
        key: `k${i}`,
        title: `Notice ${i}`,
        createdAt: new Date(base - i * 60_000),
        readAt: i === 3 ? new Date() : null,
      })),
    );
    const theirs = await Notification.create({
      user: otherStudent._id,
      type: 'assignment_published',
      key: 'k1',
      title: 'Not yours',
    });
    return { mine, theirs };
  }

  it('lists only the user’s own notifications, newest first, with the unread count', async () => {
    await seedNotifications();
    const res = await as(student).get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.map((n) => n.title)).toEqual(['Notice 1', 'Notice 2', 'Notice 3']);
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      type: 'assignment_published',
      title: 'Notice 1',
      body: '',
      link: null,
      read: false,
      readAt: null,
      createdAt: expect.any(String),
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1, unread: 2 });

    const unread = await as(student).get('/api/v1/notifications', { status: 'unread' });
    expect(unread.body.data.map((n) => n.title)).toEqual(['Notice 1', 'Notice 2']);
    const paged = await as(student).get('/api/v1/notifications', { limit: 2, page: 2 });
    expect(paged.body.data.map((n) => n.title)).toEqual(['Notice 3']);
    expect(paged.body.meta.totalPages).toBe(2);

    expect((await as(student).get('/api/v1/notifications/unread-count')).body.data).toEqual({
      count: 2,
    });
  });

  it('marks one as read, keeping the first read time, and refuses anyone else’s (404)', async () => {
    const { mine, theirs } = await seedNotifications();
    const res = await as(student).patch(`/api/v1/notifications/${mine[0].id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: mine[0].id, read: true });
    expect(res.body.meta).toEqual({ unread: 1 });

    const firstReadAt = res.body.data.readAt;
    const again = await as(student).patch(`/api/v1/notifications/${mine[0].id}/read`);
    expect(again.body.data.readAt).toBe(firstReadAt);

    const foreign = await as(student).patch(`/api/v1/notifications/${theirs.id}/read`);
    expect(foreign.status).toBe(404);
    expect((await Notification.findById(theirs.id)).readAt).toBeNull();
    const byTrainer = await as(admin).patch(`/api/v1/notifications/${theirs.id}/read`);
    expect(byTrainer.status).toBe(404);

    const missing = new mongoose.Types.ObjectId().toString();
    expect((await as(student).patch(`/api/v1/notifications/${missing}/read`)).status).toBe(404);
    expect((await as(student).patch('/api/v1/notifications/not-an-id/read')).status).toBe(400);
  });

  it('marks all of the user’s own as read, and nobody else’s', async () => {
    const { theirs } = await seedNotifications();
    const res = await as(student).patch('/api/v1/notifications/read-all', {
      user: otherStudent.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 2 });
    expect(res.body.meta).toEqual({ unread: 0 });
    expect(await Notification.countDocuments({ user: student._id, readAt: null })).toBe(0);
    expect((await Notification.findById(theirs.id)).readAt).toBeNull();
  });

  it('requires a signed-in user', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const requests = [
      api(app).get('/api/v1/notifications'),
      api(app).get('/api/v1/notifications/unread-count'),
      api(app).patch('/api/v1/notifications/read-all'),
      api(app).patch(`/api/v1/notifications/${id}/read`),
    ];
    for (const res of await Promise.all(requests)) expect(res.status).toBe(401);
  });

  it.each([
    [{ limit: 51 }],
    [{ limit: 0 }],
    [{ page: 0 }],
    [{ page: 10_001 }],
    [{ status: 'read' }],
  ])('rejects invalid list parameters %j', async (query) => {
    const res = await as(student).get('/api/v1/notifications', query);
    expect(res.status).toBe(400);
  });

  it('never turns bracketed parameters into operators', async () => {
    await seedNotifications();
    const res = await as(student).get('/api/v1/notifications', { 'status[$ne]': 'unread' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('is an empty list, not an error, for a new user', async () => {
    const res = await as(otherStudent).get('/api/v1/notifications');
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ total: 0, unread: 0 });
  });
});

describe('reliability', () => {
  it('never fails the action when notifications can’t be written', async () => {
    vi.spyOn(Notification, 'bulkWrite').mockRejectedValue(new Error('disk full'));
    const { course } = await enrolledLesson();
    const assignment = await makeAssignment(course);
    const submitted = await submit(app, student, assignment, { items: [githubItem()] });
    expect(submitted.status).toBe(201);
    const reviewed = await review(app, admin, submitted.body.data.id, { marks: 50 });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.status).toBe('reviewed');
  });

  it('has the unique, list and 90-day TTL indexes', async () => {
    const indexes = await Notification.collection.indexes();
    const byName = Object.fromEntries(indexes.map((index) => [index.name, index]));
    expect(byName.user_1_key_1.unique).toBe(true);
    expect(byName['user_1_readAt_1_createdAt_-1__id_-1']).toBeDefined();
    expect(byName['user_1_createdAt_-1__id_-1']).toBeDefined();
    expect(byName.readAt_1.expireAfterSeconds).toBe(90 * 24 * 60 * 60);
  });
});
