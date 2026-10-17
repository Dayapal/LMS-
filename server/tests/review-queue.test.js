import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Assignment, Enrollment, Submission } from '../src/models/index.js';
import { api } from './helpers.js';
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
} from './assignment-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
  student.name = 'Asha Rao';
  otherStudent.name = 'Vikram Shah';
  await Promise.all([student.save(), otherStudent.save()]);
});

const queue = (user, query = {}) =>
  api(app).get('/api/v1/admin/submissions').query(query).set(bearer(user));

const reviewedBy = (marks, at) => ({
  status: 'reviewed',
  review: { marks, finalMarks: marks, feedback: 'Nice', reviewedBy: admin._id, reviewedAt: at },
});

/**
 * Two courses. Latest attempts:
 * - student / Portfolio: attempt 2 waiting for review (a resubmission), 1 h ago
 * - otherStudent / Portfolio: attempt 1 waiting, 2.5 days ago
 * - student / Landing page: reviewed 2 h ago
 * - otherStudent / Landing page: resubmission requested 3 h ago
 * - student / Sorting (course B): attempt 1 waiting, late, 10 min ago
 */
async function fixture() {
  const { course: courseA } = await makeCourse({ shape: [{ lessons: ['published'] }] });
  const { course: courseB } = await makeCourse({ shape: [{ lessons: ['published'] }] });
  await Promise.all([
    enroll(student, courseA),
    enroll(student, courseB),
    enroll(otherStudent, courseA),
  ]);
  const portfolio = await makeAssignment(courseA, {
    title: 'Portfolio',
    dueAt: fromNow(-2 * DAY),
    maxAttempts: 3,
  });
  const landing = await makeAssignment(courseA, { title: 'Landing page', dueAt: fromNow(3 * DAY) });
  const sorting = await makeAssignment(courseB, { title: 'Sorting', dueAt: fromNow(5 * DAY) });

  await makeSubmission(portfolio, student, {
    submittedAt: fromNow(-3 * DAY),
    status: 'resubmit_requested',
    review: { feedback: 'Again', reviewedBy: admin._id, reviewedAt: fromNow(-2 * DAY) },
  });
  const resubmitted = await makeSubmission(portfolio, student, {
    attempt: 2,
    submittedAt: fromNow(-HOUR),
  });
  const waiting = await makeSubmission(portfolio, otherStudent, {
    submittedAt: fromNow(-2.5 * DAY),
  });
  const reviewed = await makeSubmission(landing, student, {
    submittedAt: fromNow(-DAY),
    ...reviewedBy(40, fromNow(-2 * HOUR)),
  });
  const sentBack = await makeSubmission(landing, otherStudent, {
    submittedAt: fromNow(-DAY),
    status: 'resubmit_requested',
    review: { feedback: 'Fix it', reviewedBy: admin._id, reviewedAt: fromNow(-3 * HOUR) },
  });
  const late = await makeSubmission(sorting, student, {
    submittedAt: fromNow(-10 * 60 * 1000),
    isLate: true,
  });
  return {
    courseA,
    courseB,
    portfolio,
    landing,
    sorting,
    resubmitted,
    waiting,
    reviewed,
    sentBack,
    late,
  };
}

const ids = (res) => res.body.data.map((row) => row.id);

describe('GET /admin/submissions', () => {
  it('lists the latest attempt of each student per assignment, waiting work first, with counts', async () => {
    const f = await fixture();
    const res = await queue(admin);
    expect(res.status).toBe(200);
    // Waiting for review, longest-waiting first; then sent back; then reviewed.
    expect(ids(res)).toEqual([
      f.waiting.id,
      f.resubmitted.id,
      f.late.id,
      f.sentBack.id,
      f.reviewed.id,
    ]);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 5, totalPages: 1 });
    expect(res.body.meta.counts).toEqual({
      all: 5,
      submitted: 3,
      resubmitted: 1,
      resubmit_requested: 1,
      reviewed: 1,
    });

    const row = res.body.data[1];
    expect(row).toMatchObject({
      id: f.resubmitted.id,
      attempt: 2,
      attempts: 2,
      status: 'submitted',
      isLate: false,
      student: { id: student.id, name: 'Asha Rao', email: student.email },
      course: { id: f.courseA.id, title: f.courseA.title, status: 'published' },
      assignment: { id: f.portfolio.id, title: 'Portfolio', maxMarks: 100, maxAttempts: 3 },
      enrollmentStatus: 'active',
      review: null,
    });
    expect(new Date(row.assignment.dueAt).getTime()).toBe(f.portfolio.dueAt.getTime());
    // Lists never carry the work itself, the note or the feedback.
    for (const item of res.body.data) {
      expect(item).not.toHaveProperty('items');
      expect(item).not.toHaveProperty('note');
      expect(item.review ?? {}).not.toHaveProperty('feedback');
    }
    expect(res.body.data[4].review).toMatchObject({ marks: 40, finalMarks: 40 });
  });

  it('filters by review state while the counts keep every state', async () => {
    const f = await fixture();
    const byState = async (status) => {
      const res = await queue(admin, { status });
      expect(res.body.meta.counts.all).toBe(5);
      return ids(res);
    };
    expect(await byState('submitted')).toEqual([f.waiting.id, f.resubmitted.id, f.late.id]);
    expect(await byState('resubmitted')).toEqual([f.resubmitted.id]);
    expect(await byState('resubmit_requested')).toEqual([f.sentBack.id]);
    expect(await byState('reviewed')).toEqual([f.reviewed.id]);
  });

  it('filters by course, assignment, student and lateness, and the counts follow', async () => {
    const f = await fixture();
    let res = await queue(admin, { course: f.courseB.id });
    expect(ids(res)).toEqual([f.late.id]);
    expect(res.body.meta.counts).toMatchObject({ all: 1, submitted: 1 });

    res = await queue(admin, { assignment: f.landing.id });
    expect(ids(res)).toEqual([f.sentBack.id, f.reviewed.id]);

    res = await queue(admin, { student: otherStudent.id, course: f.courseA.id });
    expect(ids(res)).toEqual([f.waiting.id, f.sentBack.id]);
    expect(res.body.meta.counts).toEqual({
      all: 2,
      submitted: 1,
      resubmitted: 0,
      resubmit_requested: 1,
      reviewed: 0,
    });

    expect(ids(await queue(admin, { late: 'true' }))).toEqual([f.late.id]);
    expect(await queue(admin, { late: 'false' }).then((r) => r.body.meta.total)).toBe(4);
  });

  it('searches student names, emails and assignment titles literally', async () => {
    const f = await fixture();
    expect(ids(await queue(admin, { q: 'vikram' }))).toEqual([f.waiting.id, f.sentBack.id]);
    expect(
      await queue(admin, { q: student.email.toUpperCase() }).then((r) => r.body.meta.total),
    ).toBe(3);
    expect(ids(await queue(admin, { q: 'sort' }))).toEqual([f.late.id]);
    // Regex characters are matched as text.
    const regex = await queue(admin, { q: '.*' });
    expect(regex.status).toBe(200);
    expect(regex.body.data).toEqual([]);
    expect(regex.body.meta.counts.all).toBe(0);
  });

  it('paginates and sorts by submission time on request', async () => {
    const f = await fixture();
    const first = await queue(admin, { limit: 2 });
    expect(ids(first)).toEqual([f.waiting.id, f.resubmitted.id]);
    expect(first.body.meta).toMatchObject({ total: 5, totalPages: 3 });
    expect(ids(await queue(admin, { limit: 2, page: 3 }))).toEqual([f.reviewed.id]);
    const past = await queue(admin, { limit: 2, page: 9 });
    expect(past.body.data).toEqual([]);
    expect(past.body.meta.total).toBe(5);

    const newest = await queue(admin, { sort: 'newest' });
    expect(ids(newest)[0]).toBe(f.late.id);
    const oldest = await queue(admin, { sort: 'oldest' });
    expect(ids(oldest)[0]).toBe(f.waiting.id);
  });

  it('is empty without submissions', async () => {
    const res = await queue(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ total: 0, totalPages: 1 });
    expect(res.body.meta.counts).toEqual({
      all: 0,
      submitted: 0,
      resubmitted: 0,
      resubmit_requested: 0,
      reviewed: 0,
    });
  });

  it('rejects invalid filters and never turns brackets into operators', async () => {
    await fixture();
    for (const query of [
      { limit: 0 },
      { limit: 101 },
      { page: 0 },
      { page: 10_001 },
      { page: 1e20 },
      { status: 'bogus' },
      { course: 'abc' },
      { student: '{"$ne":null}' },
      { late: 'yes' },
      { sort: 'random' },
      { q: 'x'.repeat(101) },
    ]) {
      const res = await queue(admin, query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const repeated = await api(app).get('/api/v1/admin/submissions?q=a&q=b').set(bearer(admin));
    expect(repeated.status).toBe(400);
    const brackets = await api(app)
      .get('/api/v1/admin/submissions?status[$ne]=reviewed&course[$gt]=')
      .set(bearer(admin));
    expect(brackets.status).toBe(200);
    expect(brackets.body.meta.total).toBe(5);
  });

  it('is for the trainer only', async () => {
    await fixture();
    expect((await api(app).get('/api/v1/admin/submissions')).status).toBe(401);
    const res = await queue(student);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('keeps work from removed students and archived assignments reviewable', async () => {
    const f = await fixture();
    await Enrollment.updateOne(
      { user: otherStudent._id, course: f.courseA._id },
      { status: 'removed' },
    );
    await Assignment.updateOne({ _id: f.sorting._id }, { status: 'archived' });
    const res = await queue(admin, { status: 'submitted' });
    const byId = Object.fromEntries(res.body.data.map((row) => [row.id, row]));
    expect(byId[f.waiting.id].enrollmentStatus).toBe('removed');
    expect(byId[f.late.id].assignment.status).toBe('archived');
    expect(res.body.meta.counts.submitted).toBe(3);
  });
});

describe('review actions and the queue', () => {
  it('moves an attempt through review, resubmission and a new attempt', async () => {
    const f = await fixture();
    const counts = async () => (await queue(admin)).body.meta.counts;

    // The marks cap and grading permissions are the Phase 4 ones.
    const tooMany = await review(app, admin, f.waiting.id, { marks: 101, feedback: '' });
    expect(tooMany.status).toBe(400);
    expect((await review(app, student, f.waiting.id, { marks: 5 })).status).toBe(403);
    expect(await counts()).toMatchObject({ submitted: 3, reviewed: 1 });

    expect((await review(app, admin, f.waiting.id, { marks: 70, feedback: 'Good' })).status).toBe(
      200,
    );
    expect(await counts()).toMatchObject({ submitted: 2, resubmitted: 1, reviewed: 2 });

    const sent = await requestResubmission(app, admin, f.resubmitted.id, { feedback: 'One more' });
    expect(sent.status).toBe(200);
    expect(await counts()).toMatchObject({ submitted: 1, resubmitted: 0, resubmit_requested: 2 });

    // The student's new attempt comes back as a resubmission to review.
    const third = await submit(app, student, f.portfolio, { items: [githubItem('v3')] });
    expect(third.status).toBe(201);
    const res = await queue(admin, { status: 'resubmitted' });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: third.body.data.id, attempt: 3, attempts: 3 });
    expect(res.body.meta.counts).toMatchObject({
      submitted: 2,
      resubmitted: 1,
      resubmit_requested: 1,
    });

    // Earlier attempts stay history: only the latest can be reviewed.
    expect((await review(app, admin, f.resubmitted.id, { marks: 1 })).status).toBe(409);
    expect(
      await Submission.countDocuments({ assignment: f.portfolio._id, student: student._id }),
    ).toBe(3);
  });
});
