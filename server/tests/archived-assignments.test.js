import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { Assignment } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { PDF_MIME, samplePdf, upload } from './file-helpers.js';
import {
  editSubmission,
  githubItem,
  makeAssignment,
  makeSubmission,
  requestResubmission,
  review,
  submit,
  uploadSubmissionFile,
} from './assignment-helpers.js';

/*
 * Archiving an assignment closes it, but students keep read-only access to
 * their own past work (attempts, marks, feedback, PDFs, handouts). Students
 * who never submitted don't see it, and the trainer keeps everything.
 */

let app;
let admin;
let student;
let otherStudent;
let course;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
  ({ course } = await makeCourse());
  await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
});

const get = (user, assignment) =>
  api(app).get(`/api/v1/assignments/${assignment.id}`).set(bearer(user));
const list = (user, query = { course: course.id }) =>
  api(app).get('/api/v1/assignments').query(query).set(bearer(user));
const mine = (user, assignment) =>
  api(app).get(`/api/v1/assignments/${assignment.id}/submissions/me`).set(bearer(user));
const archive = (assignment) =>
  api(app)
    .patch(`/api/v1/assignments/${assignment.id}`)
    .set(bearer(admin))
    .send({ status: 'archived' });

/** A published assignment the student submitted to and the trainer graded, then archived. */
async function gradedThenArchived() {
  const assignment = await makeAssignment(course, { title: 'Old project' });
  const created = await submit(app, student, assignment, { items: [githubItem()] });
  await review(app, admin, created.body.data.id, { marks: 72, feedback: 'Solid work' });
  expect((await archive(assignment)).status).toBe(200);
  return { assignment, submissionId: created.body.data.id };
}

describe('archived assignments, for students who submitted', () => {
  it('keep the assignment page, history, marks and feedback, read-only', async () => {
    const { assignment, submissionId } = await gradedThenArchived();

    const page = await get(student, assignment);
    expect(page.status).toBe(200);
    expect(page.body.data).toMatchObject({ status: 'archived', title: 'Old project' });
    expect(page.body.data.mySubmission).toMatchObject({
      status: 'reviewed',
      attempts: 1,
      canSubmit: false,
      canEdit: false,
      latest: { id: submissionId, finalMarks: 72 },
    });

    const history = await mine(student, assignment);
    expect(history.status).toBe(200);
    expect(history.body.data).toEqual([
      expect.objectContaining({
        id: submissionId,
        status: 'reviewed',
        review: expect.objectContaining({ marks: 72, finalMarks: 72, feedback: 'Solid work' }),
      }),
    ]);
    expect(
      (await api(app).get(`/api/v1/submissions/${submissionId}`).set(bearer(student))).status,
    ).toBe(200);
  });

  it('are listed for that student only', async () => {
    const { assignment } = await gradedThenArchived();
    await makeAssignment(course, { title: 'Archived, never submitted', status: 'archived' });

    const res = await list(student);
    expect(res.body.data.map((a) => [a.title, a.status])).toEqual([['Old project', 'archived']]);
    expect((await list(student, {})).body.data.map((a) => a.id)).toEqual([assignment.id]);
    expect((await list(otherStudent)).body.data).toEqual([]);
    expect((await get(otherStudent, assignment)).status).toBe(404);
    expect((await mine(otherStudent, assignment)).status).toBe(404);
  });

  it('accept no new work: no submissions, edits or uploads', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    await archive(assignment);

    const page = await get(student, assignment);
    expect(page.body.data.mySubmission).toMatchObject({
      status: 'submitted',
      canSubmit: false,
      canEdit: false,
      blockedReason: 'This assignment is archived, so it no longer accepts work.',
    });

    const edit = await editSubmission(app, student, created.body.data.id, { note: 'one more fix' });
    expect(edit.status).toBe(409);
    expect(edit.body.error.message).toBe(
      'This assignment is archived, so it no longer accepts work.',
    );
    expect((await submit(app, student, assignment, { items: [githubItem('v2')] })).status).toBe(
      409,
    );
    expect((await uploadSubmissionFile(app, student, assignment)).status).toBe(409);
  });

  it('accept no new attempt even when a resubmission had been requested', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    await requestResubmission(app, admin, created.body.data.id, { feedback: 'Add tests' });
    await archive(assignment);

    expect((await get(student, assignment)).body.data.mySubmission).toMatchObject({
      status: 'resubmit_requested',
      canSubmit: false,
    });
    const again = await submit(app, student, assignment, { items: [githubItem('v2')] });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/archived/);
  });

  it('keep the student’s own PDFs and the handouts available', async () => {
    const handout = await upload(app, admin, {
      buffer: samplePdf('Brief'),
      filename: 'brief.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
      purpose: 'assignment',
    });
    const assignment = await makeAssignment(course, { attachments: [handout.body.data.id] });
    const pdf = await uploadSubmissionFile(app, student, assignment);
    await submit(app, student, assignment, { items: [{ type: 'pdf', fileId: pdf.body.data.id }] });
    await archive(assignment);

    const fetchFile = (user, id) => api(app).get(`/api/v1/files/${id}`).set(bearer(user));
    expect((await fetchFile(student, pdf.body.data.id)).status).toBe(200);
    expect((await fetchFile(student, handout.body.data.id)).status).toBe(200);
    expect((await fetchFile(otherStudent, pdf.body.data.id)).status).toBe(404);
    expect((await fetchFile(otherStudent, handout.body.data.id)).status).toBe(404);
  });

  it('still follow the course, module, lesson and enrollment rules', async () => {
    const { assignment } = await gradedThenArchived();
    course.status = 'archived';
    await course.save();
    expect((await get(student, assignment)).status).toBe(404);
  });

  it('stay hidden while the assignment is a draft', async () => {
    const assignment = await makeAssignment(course);
    await makeSubmission(assignment, student);
    await Assignment.updateOne({ _id: assignment._id }, { status: 'draft' });
    expect((await get(student, assignment)).status).toBe(404);
    expect((await list(student)).body.data).toEqual([]);
  });
});

describe('archived assignments, for the trainer', () => {
  it('keep every attempt reviewable, but resubmission requests are refused', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    await archive(assignment);

    const listed = await api(app)
      .get(`/api/v1/assignments/${assignment.id}/submissions`)
      .set(bearer(admin));
    expect(listed.body.data.map((s) => s.id)).toEqual([created.body.data.id]);
    const detail = await api(app)
      .get(`/api/v1/submissions/${created.body.data.id}`)
      .set(bearer(admin));
    expect(detail.body.data.history).toHaveLength(1);

    const resubmit = await requestResubmission(app, admin, created.body.data.id, {
      feedback: 'Again',
    });
    expect(resubmit.status).toBe(409);
    expect(resubmit.body.error.message).toMatch(/archived/);
    const graded = await review(app, admin, created.body.data.id, { marks: 60 });
    expect(graded.status).toBe(200);
    expect(graded.body.data.status).toBe('reviewed');
  });
});
