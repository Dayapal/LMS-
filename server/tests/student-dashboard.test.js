import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Assignment, Course, Lesson } from '../src/models/index.js';
import { studentStatus } from '../src/services/submissionRules.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { DAY, HOUR, fromNow, makeAssignment, makeSubmission } from './assignment-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});

const myAssignments = (user, query = {}) =>
  api(app).get('/api/v1/me/assignments').query(query).set(bearer(user));
const dashboard = (user) => api(app).get('/api/v1/dashboard/student').set(bearer(user));

const reviewed = (marks, at = new Date()) => ({
  status: 'reviewed',
  review: {
    marks,
    finalMarks: marks,
    feedback: 'Well done',
    reviewedBy: admin._id,
    reviewedAt: at,
  },
});

/**
 * One enrolled course with an assignment in each derived state for `student`:
 * pending, overdue, submitted, reviewed and resubmit_requested.
 */
async function assignmentsInEveryState() {
  const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
  await enroll(student, course);
  const make = (title, dueIn, extra = {}) =>
    makeAssignment(course, { title, dueAt: fromNow(dueIn), ...extra });
  const overdue = await make('Overdue', -DAY);
  const resubmit = await make('Resubmit', -2 * DAY, { maxAttempts: 2 });
  const reviewedOne = await make('Reviewed', -3 * DAY);
  const submitted = await make('Submitted', 2 * DAY);
  const pending = await make('Pending', 5 * DAY, { lesson: modules[0].lessons[0]._id });
  await makeSubmission(submitted, student);
  await makeSubmission(reviewedOne, student, {
    submittedAt: fromNow(-4 * DAY),
    ...reviewed(80, fromNow(-HOUR)),
  });
  await makeSubmission(resubmit, student, {
    submittedAt: fromNow(-3 * DAY),
    status: 'resubmit_requested',
    review: { feedback: 'Add tests', reviewedBy: admin._id, reviewedAt: fromNow(-2 * HOUR) },
  });
  return { course, modules, overdue, resubmit, reviewedOne, submitted, pending };
}

describe('GET /me/assignments', () => {
  it('lists every visible assignment with its derived state, due first, and counts', async () => {
    const { course } = await assignmentsInEveryState();
    const res = await myAssignments(student);
    expect(res.status).toBe(200);
    expect(res.body.data.map((a) => [a.title, a.mySubmission.status])).toEqual([
      ['Reviewed', 'reviewed'],
      ['Resubmit', 'resubmit_requested'],
      ['Overdue', 'overdue'],
      ['Submitted', 'submitted'],
      ['Pending', 'pending'],
    ]);
    expect(res.body.meta.counts).toEqual({
      all: 5,
      pending: 1,
      overdue: 1,
      submitted: 1,
      reviewed: 1,
      resubmit_requested: 1,
    });
    const [first] = res.body.data;
    expect(first).toMatchObject({
      course: { id: course.id, title: course.title },
      maxMarks: 100,
      mySubmission: { attempts: 1, latest: { finalMarks: 80 }, canSubmit: false },
    });
    expect(first).not.toHaveProperty('instructions');
    expect(res.body.data.at(-1).lesson).toMatchObject({ title: 'Lesson 1.1' });
  });

  it('filters by derived state and course, keeping counts for the whole course', async () => {
    const { course } = await assignmentsInEveryState();
    const other = await makeCourse();
    await enroll(student, other.course);
    await makeAssignment(other.course, { title: 'Elsewhere', dueAt: fromNow(-DAY) });

    const overdue = await myAssignments(student, { status: 'overdue' });
    expect(overdue.body.data.map((a) => a.title)).toEqual(['Overdue', 'Elsewhere']);
    expect(overdue.body.meta).toMatchObject({ total: 2, counts: { all: 6, overdue: 2 } });

    const inCourse = await myAssignments(student, { status: 'overdue', course: course.id });
    expect(inCourse.body.data.map((a) => a.title)).toEqual(['Overdue']);
    expect(inCourse.body.meta.counts.all).toBe(5);
  });

  it('paginates the filtered list', async () => {
    await assignmentsInEveryState();
    const res = await myAssignments(student, { page: 2, limit: 2 });
    expect(res.body.data.map((a) => a.title)).toEqual(['Overdue', 'Submitted']);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it("is built from the caller's own submissions only", async () => {
    const { pending } = await assignmentsInEveryState();
    await enroll(otherStudent, await Course.findById(pending.course));
    await makeSubmission(pending, otherStudent, reviewed(90));

    const mine = (await myAssignments(student, { status: 'pending' })).body.data;
    expect(mine.map((a) => a.title)).toEqual(['Pending']);
    const theirs = (await myAssignments(otherStudent)).body.data;
    expect(theirs.find((a) => a.title === 'Pending').mySubmission.status).toBe('reviewed');
    expect(theirs.find((a) => a.title === 'Reviewed').mySubmission).toMatchObject({
      status: 'overdue',
      latest: null,
    });
  });

  it('leaves out what the student may not see', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['draft'] }] });
    await enroll(student, course);
    await makeAssignment(course, { title: 'Visible' });
    await makeAssignment(course, { title: 'Draft', status: 'draft' });
    await makeAssignment(course, { title: 'Archived', status: 'archived' });
    await makeAssignment(course, { title: 'In a draft lesson', lesson: modules[0].lessons[0]._id });
    const submittedArchived = await makeAssignment(course, {
      title: 'Archived after I submitted',
      status: 'archived',
    });
    await makeSubmission(submittedArchived, student);
    const notEnrolled = await makeCourse();
    await makeAssignment(notEnrolled.course, { title: 'Not enrolled' });
    const pendingCourse = await makeCourse();
    await enroll(student, pendingCourse.course, 'pending');
    await makeAssignment(pendingCourse.course, { title: 'Pending enrollment' });

    const titles = (await myAssignments(student)).body.data.map((a) => a.title).sort();
    expect(titles).toEqual(['Archived after I submitted', 'Visible']);
  });

  it('validates the query and is for students only', async () => {
    expect((await myAssignments(student, { status: 'late' })).status).toBe(400);
    expect((await myAssignments(student, { course: 'nope' })).status).toBe(400);
    expect((await myAssignments(student, { limit: 500 })).status).toBe(400);
    expect((await myAssignments(student, { limit: 0 })).status).toBe(400);
    expect((await myAssignments(student, { page: 0 })).status).toBe(400);
    expect((await myAssignments(student, { page: 'two' })).status).toBe(400);
    expect((await myAssignments(admin)).status).toBe(403);
    expect((await api(app).get('/api/v1/me/assignments')).status).toBe(401);
  });

  it('never turns query brackets into operators', async () => {
    await assignmentsInEveryState();
    // Express 5 keeps `status[$ne]` as a plain key, which validation drops: no filter at all.
    const res = await api(app)
      .get('/api/v1/me/assignments?status[$ne]=reviewed&course[$gt]=')
      .set(bearer(student));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(5);
    expect(res.body.data.every((a) => a.course.id === res.body.data[0].course.id)).toBe(true);
  });

  it('returns an empty page past the end, and nothing for a course the student is not in', async () => {
    await assignmentsInEveryState();
    const past = await myAssignments(student, { page: 9, limit: 2 });
    expect(past.status).toBe(200);
    expect(past.body.data).toEqual([]);
    expect(past.body.meta).toMatchObject({ page: 9, total: 5, totalPages: 3 });

    const other = await makeCourse();
    await makeAssignment(other.course, { title: 'Not mine' });
    const res = await myAssignments(student, { course: other.course.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.counts.all).toBe(0);
  });

  it('is empty, with zero counts, for a student with no enrollments or submissions', async () => {
    const { course } = await makeCourse();
    await makeAssignment(course);
    const res = await myAssignments(student);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      counts: { all: 0, pending: 0, overdue: 0, submitted: 0, reviewed: 0, resubmit_requested: 0 },
    });
  });
});

describe('overdue around the due instant and time zones', () => {
  it('flips from pending to overdue exactly at the due instant (UTC)', () => {
    // 23:59 in India on 20 Oct is 18:29 UTC.
    const assignment = { dueAt: new Date('2026-10-20T23:59:00+05:30') };
    const at = (iso) => studentStatus(assignment, null, new Date(iso));
    expect(at('2026-10-20T18:29:00.000Z')).toBe('pending');
    expect(at('2026-10-20T18:29:00.001Z')).toBe('overdue');
    // The same instant written with another offset gives the same answer.
    expect(at('2026-10-20T14:29:00-04:00')).toBe('pending');
    expect(at('2026-10-20T14:29:01-04:00')).toBe('overdue');
  });

  it('uses the server clock: an assignment due a minute ago is overdue, one due in a minute is not', async () => {
    const { course } = await makeCourse();
    await enroll(student, course);
    await makeAssignment(course, { title: 'Just missed', dueAt: fromNow(-60_000) });
    await makeAssignment(course, { title: 'Just in time', dueAt: fromNow(60_000) });
    const states = Object.fromEntries(
      (await myAssignments(student)).body.data.map((a) => [a.title, a.mySubmission.status]),
    );
    expect(states).toEqual({ 'Just missed': 'overdue', 'Just in time': 'pending' });
  });

  it('stores a due date sent with an offset as the same UTC instant', async () => {
    const { course } = await makeCourse();
    const res = await api(app)
      .post('/api/v1/assignments')
      .set(bearer(admin))
      .send({
        courseId: course.id,
        title: 'Offsets',
        dueAt: '2026-12-01T00:30:00+05:30',
        maxMarks: 10,
        allowedSubmissionTypes: ['github_url'],
      });
    expect(res.body.data.dueAt).toBe('2026-11-30T19:00:00.000Z');
  });

  it('keeps an overdue assignment open while late work is accepted', async () => {
    const { course } = await makeCourse();
    await enroll(student, course);
    await makeAssignment(course, {
      dueAt: fromNow(-DAY),
      latePolicy: { allowLate: true, lateUntil: fromNow(DAY), penaltyPercent: 10 },
    });
    const [row] = (await myAssignments(student)).body.data;
    expect(row.mySubmission).toMatchObject({ status: 'overdue', canSubmit: true });
  });
});

describe('GET /dashboard/student', () => {
  it('summarises courses, progress, work to do and recent feedback', async () => {
    const { course, modules } = await assignmentsInEveryState();
    const lesson = modules[0].lessons[0];
    await api(app).post(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(student));
    const pendingCourse = await makeCourse();
    await enroll(student, pendingCourse.course, 'pending');

    const res = await dashboard(student);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.summary).toEqual({
      activeCourses: 1,
      completedCourses: 1,
      pendingRequests: 1,
      lessonsCompleted: 1,
      assignments: {
        all: 5,
        pending: 1,
        overdue: 1,
        submitted: 1,
        reviewed: 1,
        resubmit_requested: 1,
      },
    });
    expect(data.courses.map((c) => c.course.id)).toEqual([course.id, pendingCourse.course.id]);
    // The only course is complete, so there is nothing to continue.
    expect(data.continueLearning).toBeNull();
    // Overdue without a late window can't be handed in any more; resubmit and pending can.
    expect(data.upcoming.map((a) => a.title)).toEqual(['Resubmit', 'Pending']);
    expect(data.recentFeedback.map((a) => a.title)).toEqual(['Reviewed', 'Resubmit']);
  });

  it('points continue learning at the most recently studied unfinished course', async () => {
    const first = await makeCourse({ shape: [{ lessons: ['published', 'published'] }] });
    const second = await makeCourse({ shape: [{ lessons: ['published', 'published'] }] });
    await enroll(student, first.course);
    await enroll(student, second.course);
    const [l1] = first.modules[0].lessons;
    const [, l2] = second.modules[0].lessons;
    await api(app).post(`/api/v1/lessons/${l1.id}/visit`).set(bearer(student));
    await api(app).post(`/api/v1/lessons/${l2.id}/visit`).set(bearer(student));

    const { continueLearning } = (await dashboard(student)).body.data;
    expect(continueLearning).toMatchObject({
      course: { id: second.course.id },
      progress: { nextLesson: { id: l2.id, kind: 'resume', title: 'Lesson 1.2' } },
    });
  });

  it('is empty for a new student', async () => {
    const { data } = (await dashboard(student)).body;
    expect(data).toMatchObject({
      summary: { activeCourses: 0, lessonsCompleted: 0, pendingRequests: 0 },
      continueLearning: null,
      courses: [],
      upcoming: [],
      recentFeedback: [],
    });
  });

  it("never includes another student's data", async () => {
    const { pending } = await assignmentsInEveryState();
    const course = await Course.findById(pending.course);
    await enroll(otherStudent, course);
    const lesson = await Lesson.findOne({ course: course._id });
    await api(app).post(`/api/v1/lessons/${lesson.id}/complete`).set(bearer(student));

    const { data } = (await dashboard(otherStudent)).body;
    expect(data.summary.lessonsCompleted).toBe(0);
    expect(data.recentFeedback).toEqual([]);
    expect(data.summary.assignments.submitted).toBe(0);
  });

  it('is for students only', async () => {
    expect((await dashboard(admin)).status).toBe(403);
    expect((await api(app).get('/api/v1/dashboard/student')).status).toBe(401);
    expect((await api(app).get('/api/v1/dashboard/admin').set(bearer(admin))).status).toBe(404);
  });

  it('counts an assignment that becomes visible later', async () => {
    const { course } = await makeCourse();
    await enroll(student, course);
    const draft = await makeAssignment(course, { status: 'draft' });
    expect((await dashboard(student)).body.data.summary.assignments.all).toBe(0);
    await Assignment.updateOne({ _id: draft._id }, { status: 'published' });
    expect((await dashboard(student)).body.data.summary.assignments.all).toBe(1);
  });
});
