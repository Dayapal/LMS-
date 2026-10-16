import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { Assignment, FileAsset, Submission } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { binary, samplePdf, storedFiles } from './file-helpers.js';
import {
  DAY,
  editSubmission,
  fromNow,
  githubItem,
  HOUR,
  makeAssignment,
  makeSubmission,
  requestResubmission,
  review,
  submit,
  uploadSubmissionFile,
} from './assignment-helpers.js';

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

const mine = (user, assignment) =>
  api(app).get(`/api/v1/assignments/${assignment.id}/submissions/me`).set(bearer(user));
const getSubmission = (user, id) => api(app).get(`/api/v1/submissions/${id}`).set(bearer(user));

/** Moves the deadline (and late cutoff) relative to now, as if time had passed. */
async function setWindow(assignment, { dueIn, lateUntilIn, penaltyPercent = 0 }) {
  assignment.dueAt = fromNow(dueIn);
  assignment.latePolicy =
    lateUntilIn === undefined
      ? { allowLate: false, lateUntil: null, penaltyPercent: 0 }
      : { allowLate: true, lateUntil: fromNow(lateUntilIn), penaltyPercent };
  await assignment.save();
}

describe('POST /assignments/:id/submissions', () => {
  it('creates attempt 1 with links and code, owned by the student', async () => {
    const assignment = await makeAssignment(course);
    const res = await submit(app, student, assignment, {
      items: [
        { type: 'drive_url', url: 'https://drive.google.com/file/d/abc/view' },
        githubItem(),
        { type: 'project_url', url: 'https://asha.vercel.app' },
        { type: 'code', code: { language: 'javascript', source: '  const x = 1;\n' } },
      ],
      note: 'Please check the README.',
      student: otherStudent.id,
      status: 'reviewed',
      isLate: true,
      attempt: 7,
      review: { marks: 100 },
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      assignmentId: assignment.id,
      courseId: course.id,
      student: { id: student.id },
      attempt: 1,
      status: 'submitted',
      isLate: false,
      review: null,
      note: 'Please check the README.',
    });
    expect(res.body.data.items).toEqual([
      { type: 'drive_url', url: 'https://drive.google.com/file/d/abc/view' },
      { type: 'github_url', url: 'https://github.com/asha/portfolio' },
      { type: 'project_url', url: 'https://asha.vercel.app' },
      { type: 'code', code: { language: 'javascript', source: '  const x = 1;\n' } },
    ]);
  });

  it('rejects submission types the assignment does not allow', async () => {
    const assignment = await makeAssignment(course, { allowedSubmissionTypes: ['github_url'] });
    const res = await submit(app, student, assignment, {
      items: [githubItem(), { type: 'code', code: { language: 'java', source: 'class A {}' } }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'items.1.type', message: 'This assignment does not accept code snippets' },
    ]);
    expect(await Submission.countDocuments()).toBe(0);
  });

  it('validates links, code and the item list', async () => {
    const assignment = await makeAssignment(course);
    const cases = [
      [{ items: [] }, 'items', /at least one/],
      [{ items: [{ type: 'zip', url: 'https://x.dev' }] }, 'items.0.type', /Choose a submission/],
      [{ items: [{ type: 'github_url', url: 'https://gitlab.com/a/b' }] }, 'items.0.url', /github/],
      [
        { items: [{ type: 'drive_url', url: 'https://evil.example/drive.google.com' }] },
        'items.0.url',
        /Google Drive/,
      ],
      [
        { items: [{ type: 'project_url', url: 'javascript:alert(document.cookie)' }] },
        'items.0.url',
        /https/,
      ],
      [
        { items: [{ type: 'project_url', url: 'https://192.168.0.5:3000' }] },
        'items.0.url',
        /public/,
      ],
      [
        { items: [{ type: 'code', code: { language: 'cobol', source: 'x' } }] },
        'items.0.code.language',
        /supported language/,
      ],
      [
        { items: [{ type: 'code', code: { language: 'text', source: '   \n ' } }] },
        'items.0.code.source',
        /Add some code/,
      ],
      [
        {
          items: [{ type: 'code', code: { language: 'text', source: 'é'.repeat(51 * 1024) } }],
        },
        'items.0.code.source',
        /100 KB/,
      ],
      [{ items: Array.from({ length: 6 }, () => githubItem()) }, 'items', /At most 5/],
      [{ items: [githubItem()], note: 'x'.repeat(2001) }, 'note', /2000/],
    ];
    for (const [body, path, message] of cases) {
      const res = await submit(app, student, assignment, body);
      expect(res.status, path).toBe(400);
      const detail = res.body.error.details.find((d) => d.path === path);
      expect(detail?.message, JSON.stringify(res.body.error.details)).toMatch(message);
    }
    expect(await Submission.countDocuments()).toBe(0);
  });

  it('accepts code up to exactly 100 KB', async () => {
    const assignment = await makeAssignment(course);
    const res = await submit(app, student, assignment, {
      items: [{ type: 'code', code: { language: 'text', source: 'a'.repeat(100 * 1024) } }],
    });
    expect(res.status).toBe(201);
  });

  it('refuses a second attempt while the first is waiting for review', async () => {
    const assignment = await makeAssignment(course);
    expect((await submit(app, student, assignment, { items: [githubItem()] })).status).toBe(201);
    const again = await submit(app, student, assignment, { items: [githubItem('v2')] });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/Edit your submission instead/);
  });

  it('refuses work after the window closes, and accepts flagged late work until the cutoff', async () => {
    const closed = await makeAssignment(course);
    await setWindow(closed, { dueIn: -HOUR });
    const refused = await submit(app, student, closed, { items: [githubItem()] });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe('The submission window has closed.');

    const late = await makeAssignment(course);
    await setWindow(late, { dueIn: -HOUR, lateUntilIn: DAY, penaltyPercent: 10 });
    const accepted = await submit(app, student, late, { items: [githubItem()] });
    expect(accepted.status).toBe(201);
    expect(accepted.body.data.isLate).toBe(true);

    const onTime = await makeAssignment(course);
    await setWindow(onTime, { dueIn: HOUR, lateUntilIn: DAY, penaltyPercent: 10 });
    expect((await submit(app, student, onTime, { items: [githubItem()] })).body.data.isLate).toBe(
      false,
    );

    const cutoffPassed = await makeAssignment(course);
    await setWindow(cutoffPassed, { dueIn: -2 * DAY, lateUntilIn: -HOUR, penaltyPercent: 10 });
    expect((await submit(app, student, cutoffPassed, { items: [githubItem()] })).status).toBe(409);
  });

  it('returns 404 for assignments the student cannot see and 403 for the trainer', async () => {
    const draft = await makeAssignment(course, { status: 'draft' });
    expect((await submit(app, student, draft, { items: [githubItem()] })).status).toBe(404);

    const other = await makeCourse();
    const foreign = await makeAssignment(other.course);
    expect((await submit(app, student, foreign, { items: [githubItem()] })).status).toBe(404);

    const assignment = await makeAssignment(course);
    expect((await submit(app, admin, assignment, { items: [githubItem()] })).status).toBe(403);
    const anonymous = await api(app)
      .post(`/api/v1/assignments/${assignment.id}/submissions`)
      .send({ items: [githubItem()] });
    expect(anonymous.status).toBe(401);
  });

  it('keeps two concurrent first attempts from both being created', async () => {
    const assignment = await makeAssignment(course);
    const results = await Promise.all([
      submit(app, student, assignment, { items: [githubItem('a')] }),
      submit(app, student, assignment, { items: [githubItem('b')] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Submission.countDocuments()).toBe(1);
  });
});

describe('PATCH /submissions/:id', () => {
  it('lets the student edit their unreviewed attempt while the window is open', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    const res = await editSubmission(app, student, created.body.data.id, {
      items: [githubItem('portfolio-v2')],
      note: 'Fixed the navbar',
      status: 'reviewed',
      isLate: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      attempt: 1,
      status: 'submitted',
      isLate: false,
      note: 'Fixed the navbar',
      items: [{ type: 'github_url', url: 'https://github.com/asha/portfolio-v2' }],
    });
    expect(res.body.data.editedAt).not.toBeNull();
    expect(await Submission.countDocuments()).toBe(1);
  });

  it('blocks editing after review or a resubmission request', async () => {
    const assignment = await makeAssignment(course);
    for (const status of ['reviewed', 'resubmit_requested']) {
      const submission = await makeSubmission(assignment, student, { status });
      const res = await editSubmission(app, student, submission.id, { note: 'sneaky' });
      expect(res.status, status).toBe(409);
      expect(res.body.error.message).toMatch(/reviewed and can no longer be edited/);
      await submission.deleteOne();
    }
  });

  it('blocks editing after the window closes', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    await setWindow(assignment, { dueIn: -HOUR });
    const res = await editSubmission(app, student, created.body.data.id, { note: 'too late' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/window has closed/);
  });

  it('makes an on-time attempt late when it is edited after the due date', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    expect(created.body.data.isLate).toBe(false);
    await setWindow(assignment, { dueIn: -HOUR, lateUntilIn: DAY, penaltyPercent: 20 });
    const res = await editSubmission(app, student, created.body.data.id, {
      items: [githubItem('real-work')],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.isLate).toBe(true);
  });

  it('only allows the latest attempt to be edited', async () => {
    const assignment = await makeAssignment(course);
    const first = await makeSubmission(assignment, student, { status: 'resubmit_requested' });
    await makeSubmission(assignment, student, { attempt: 2 });
    const res = await editSubmission(app, student, first.id, { note: 'rewrite history' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/latest attempt/);
  });

  it('applies the assignment’s current allowed types to edits', async () => {
    const assignment = await makeAssignment(course);
    const created = await submit(app, student, assignment, { items: [githubItem()] });
    await Assignment.updateOne({ _id: assignment._id }, { allowedSubmissionTypes: ['pdf'] });
    const res = await editSubmission(app, student, created.body.data.id, {
      items: [githubItem('v2')],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('items.0.type');
  });
});

describe('privacy of submissions', () => {
  it('never shows a student another student’s submission', async () => {
    const assignment = await makeAssignment(course);
    const theirs = await submit(app, otherStudent, assignment, { items: [githubItem('secret')] });
    const id = theirs.body.data.id;

    expect((await getSubmission(student, id)).status).toBe(404);
    expect((await editSubmission(app, student, id, { note: 'mine now' })).status).toBe(404);
    expect((await mine(student, assignment)).body.data).toEqual([]);
    expect((await getSubmission(otherStudent, id)).status).toBe(200);
    const stored = await Submission.findById(id);
    expect(stored.note).toBe('');
  });

  it('gives the student their own history, newest first', async () => {
    const assignment = await makeAssignment(course);
    await makeSubmission(assignment, student, {
      status: 'resubmit_requested',
      review: { marks: 40, finalMarks: 40, feedback: 'Add tests' },
    });
    await makeSubmission(assignment, student, { attempt: 2 });
    await makeSubmission(assignment, otherStudent);

    const res = await mine(student, assignment);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => [s.attempt, s.status])).toEqual([
      [2, 'submitted'],
      [1, 'resubmit_requested'],
    ]);
    expect(res.body.data[1].review).toMatchObject({ marks: 40, feedback: 'Add tests' });
    expect(res.body.data[1].review).not.toHaveProperty('reviewedBy');
  });

  it('keeps the submission endpoints student- or trainer-only as appropriate', async () => {
    const assignment = await makeAssignment(course);
    const submission = await makeSubmission(assignment, student);
    expect((await mine(admin, assignment)).status).toBe(403);
    expect((await editSubmission(app, admin, submission.id, { note: 'x' })).status).toBe(403);
    expect(
      (await api(app).get(`/api/v1/assignments/${assignment.id}/submissions`).set(bearer(student)))
        .status,
    ).toBe(403);
    expect((await review(app, student, submission.id, { marks: 100 })).status).toBe(403);
    expect(
      (await requestResubmission(app, student, submission.id, { feedback: 'again' })).status,
    ).toBe(403);
    expect((await getSubmission(admin, submission.id)).status).toBe(200);
  });
});

describe('PDF submissions', () => {
  const fetchFile = (user, fileId) =>
    api(app).get(`/api/v1/files/${fileId}`).set(bearer(user)).buffer(true).parse(binary);

  it('uploads a PDF for the assignment and attaches it to a submission', async () => {
    const assignment = await makeAssignment(course);
    const pdf = samplePdf('My answers');
    const uploaded = await uploadSubmissionFile(app, student, assignment, { buffer: pdf });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      originalName: 'answers.pdf',
      purpose: 'submission',
      courseId: course.id,
    });
    const asset = await FileAsset.findById(uploaded.body.data.id);
    expect(asset.storageKey).toMatch(/^submission\/[0-9a-f-]{36}\.pdf$/);
    expect(asset.uploadedBy.equals(student._id)).toBe(true);

    const res = await submit(app, student, assignment, {
      items: [{ type: 'pdf', fileId: uploaded.body.data.id }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.items[0]).toMatchObject({
      type: 'pdf',
      file: { id: uploaded.body.data.id, originalName: 'answers.pdf' },
    });

    const own = await fetchFile(student, uploaded.body.data.id);
    expect(own.status).toBe(200);
    expect(own.body.equals(pdf)).toBe(true);
    expect((await fetchFile(admin, uploaded.body.data.id)).status).toBe(200);
    expect((await fetchFile(otherStudent, uploaded.body.data.id)).status).toBe(404);
    expect((await api(app).get(`/api/v1/files/${uploaded.body.data.id}`)).status).toBe(404);
  });

  it('refuses another student’s upload or a file from another assignment', async () => {
    const assignment = await makeAssignment(course);
    const second = await makeAssignment(course, { title: 'Second' });
    const theirs = await uploadSubmissionFile(app, otherStudent, assignment);
    const elsewhere = await uploadSubmissionFile(app, student, second);
    for (const fileId of [theirs.body.data.id, elsewhere.body.data.id]) {
      const res = await submit(app, student, assignment, { items: [{ type: 'pdf', fileId }] });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toEqual({
        path: 'items.0.fileId',
        message: 'Upload the PDF for this assignment before submitting it',
      });
    }
  });

  it('rejects spoofed, non-PDF and oversized files, storing nothing', async () => {
    const assignment = await makeAssignment(course);
    const cases = [
      [{ buffer: Buffer.from('<html><script>alert(1)</script>'), filename: 'x.pdf' }, 400],
      [{ buffer: samplePdf(), filename: 'answers.docx' }, 400],
      [{ buffer: samplePdf(), filename: 'answers.pdf', contentType: 'text/html' }, 400],
      [
        {
          buffer: Buffer.concat([samplePdf(), Buffer.alloc(10 * 1024 * 1024)]),
          filename: 'big.pdf',
        },
        413,
      ],
    ];
    for (const [options, status] of cases) {
      const res = await uploadSubmissionFile(app, student, assignment, options);
      expect(res.status, options.filename).toBe(status);
      expect(res.body.error.code).toBe('FILE_REJECTED');
    }
    expect(await storedFiles()).toEqual([]);
  });

  it('checks the assignment before reading the upload', async () => {
    const noPdf = await makeAssignment(course, { allowedSubmissionTypes: ['github_url'] });
    const refused = await uploadSubmissionFile(app, student, noPdf);
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toBe('This assignment does not accept PDF files');

    const closed = await makeAssignment(course, { dueAt: fromNow(-HOUR) });
    expect((await uploadSubmissionFile(app, student, closed)).status).toBe(409);

    const reviewed = await makeAssignment(course);
    await makeSubmission(reviewed, student, { status: 'reviewed' });
    expect((await uploadSubmissionFile(app, student, reviewed)).status).toBe(409);

    const hidden = await makeAssignment(course, { status: 'draft' });
    expect((await uploadSubmissionFile(app, student, hidden)).status).toBe(404);
    expect((await uploadSubmissionFile(app, admin, await makeAssignment(course))).status).toBe(403);
    expect(await storedFiles()).toEqual([]);
  });

  it('applies the per-user upload rate limit', async () => {
    config.rateLimit.uploadMax = 1;
    try {
      const limited = createApp();
      const assignment = await makeAssignment(course);
      expect((await uploadSubmissionFile(limited, student, assignment)).status).toBe(201);
      expect((await uploadSubmissionFile(limited, student, assignment)).status).toBe(429);
    } finally {
      config.rateLimit.uploadMax = 30;
    }
  });

  it('deletes a replaced PDF, and stale uploads that were never submitted', async () => {
    const assignment = await makeAssignment(course);
    const first = await uploadSubmissionFile(app, student, assignment);
    const created = await submit(app, student, assignment, {
      items: [{ type: 'pdf', fileId: first.body.data.id }],
    });
    const second = await uploadSubmissionFile(app, student, assignment);
    await editSubmission(app, student, created.body.data.id, {
      items: [{ type: 'pdf', fileId: second.body.data.id }],
    });
    expect(await FileAsset.findById(first.body.data.id)).toBeNull();
    expect(await storedFiles()).toHaveLength(1);

    const orphan = await uploadSubmissionFile(app, student, assignment);
    // createdAt is immutable through Mongoose, so backdate it in the collection directly.
    await FileAsset.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(orphan.body.data.id) },
      { $set: { createdAt: fromNow(-2 * HOUR) } },
    );
    await uploadSubmissionFile(app, student, assignment);
    expect(await FileAsset.findById(orphan.body.data.id)).toBeNull();
    expect(await FileAsset.findById(second.body.data.id)).not.toBeNull();
    expect(await storedFiles()).toHaveLength(2);
  });

  it('keeps a PDF that an earlier attempt still uses', async () => {
    const assignment = await makeAssignment(course);
    const uploaded = await uploadSubmissionFile(app, student, assignment);
    const first = await submit(app, student, assignment, {
      items: [{ type: 'pdf', fileId: uploaded.body.data.id }],
    });
    await requestResubmission(app, admin, first.body.data.id, { feedback: 'Add a chart' });
    const second = await submit(app, student, assignment, {
      items: [{ type: 'pdf', fileId: uploaded.body.data.id }, githubItem()],
    });
    expect(second.status).toBe(201);
    await editSubmission(app, student, second.body.data.id, { items: [githubItem()] });
    expect(await FileAsset.findById(uploaded.body.data.id)).not.toBeNull();
  });
});

describe('review, marks and resubmission', () => {
  it('grades the latest attempt and applies the late penalty', async () => {
    const assignment = await makeAssignment(course, { maxMarks: 50 });
    await setWindow(assignment, { dueIn: -HOUR, lateUntilIn: DAY, penaltyPercent: 20 });
    const late = await submit(app, student, assignment, { items: [githubItem()] });
    const res = await review(app, admin, late.body.data.id, {
      marks: 45.5,
      feedback: 'Nice work, **late** though.',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'reviewed',
      isLate: true,
      review: { marks: 45.5, finalMarks: 36.4, feedback: 'Nice work, **late** though.' },
      student: { id: student.id, email: student.email },
      assignment: { id: assignment.id, maxMarks: 50 },
      history: [expect.objectContaining({ attempt: 1, status: 'reviewed' })],
    });
    const stored = await Submission.findById(late.body.data.id);
    expect(stored.review.reviewedBy.equals(admin._id)).toBe(true);

    const onTime = await makeSubmission(assignment, otherStudent, { isLate: false });
    const full = await review(app, admin, onTime.id, { marks: 45.5 });
    expect(full.body.data.review.finalMarks).toBe(45.5);
  });

  it('caps marks at maxMarks and validates them', async () => {
    const assignment = await makeAssignment(course, { maxMarks: 20 });
    const submission = await makeSubmission(assignment, student);
    const over = await review(app, admin, submission.id, { marks: 20.5 });
    expect(over.status).toBe(400);
    expect(over.body.error.details).toEqual([{ path: 'marks', message: 'At most 20 marks' }]);
    for (const marks of [-1, 'ten', 1.234]) {
      expect((await review(app, admin, submission.id, { marks })).status, String(marks)).toBe(400);
    }
    expect((await review(app, admin, submission.id, { marks: 20 })).status).toBe(200);
    expect((await review(app, admin, submission.id, { marks: 0.1 })).body.data.review.marks).toBe(
      0.1,
    );
  });

  it('runs the full resubmission workflow up to maxAttempts', async () => {
    const assignment = await makeAssignment(course, { maxAttempts: 2 });
    const first = await submit(app, student, assignment, { items: [githubItem()] });

    const needsFeedback = await requestResubmission(app, admin, first.body.data.id, {});
    expect(needsFeedback.status).toBe(400);
    const requested = await requestResubmission(app, admin, first.body.data.id, {
      feedback: 'Add form validation',
    });
    expect(requested.body.data).toMatchObject({
      status: 'resubmit_requested',
      review: { marks: null, finalMarks: null, feedback: 'Add form validation' },
    });

    // The deadline passing doesn't block a requested resubmission.
    await setWindow(assignment, { dueIn: -DAY });
    const second = await submit(app, student, assignment, { items: [githubItem('v2')] });
    expect(second.status).toBe(201);
    expect(second.body.data).toMatchObject({ attempt: 2, isLate: false, status: 'submitted' });
    // ...and it can be edited until it is reviewed.
    expect(
      (await editSubmission(app, student, second.body.data.id, { note: 'Added validation' }))
        .status,
    ).toBe(200);

    // Older attempts can't be reviewed any more, and the last attempt can't be sent back.
    expect((await review(app, admin, first.body.data.id, { marks: 10 })).status).toBe(409);
    const noMore = await requestResubmission(app, admin, second.body.data.id, {
      feedback: 'Once more',
    });
    expect(noMore.status).toBe(409);
    expect(noMore.body.error.message).toMatch(/used all 2 attempts/);

    expect((await review(app, admin, second.body.data.id, { marks: 90 })).status).toBe(200);
    const third = await submit(app, student, assignment, { items: [githubItem('v3')] });
    expect(third.status).toBe(409);

    const history = await mine(student, assignment);
    expect(history.body.data.map((s) => [s.attempt, s.status])).toEqual([
      [2, 'reviewed'],
      [1, 'resubmit_requested'],
    ]);
  });

  it('keeps the late flag of the original work on a resubmission', async () => {
    const assignment = await makeAssignment(course);
    await setWindow(assignment, { dueIn: -HOUR, lateUntilIn: DAY, penaltyPercent: 50 });
    const first = await submit(app, student, assignment, { items: [githubItem()] });
    await requestResubmission(app, admin, first.body.data.id, { feedback: 'Fix it', marks: 30 });
    const second = await submit(app, student, assignment, { items: [githubItem('v2')] });
    expect(second.body.data.isLate).toBe(true);
    const graded = await review(app, admin, second.body.data.id, { marks: 80 });
    expect(graded.body.data.review.finalMarks).toBe(40);
  });

  it('lists the latest attempt per student for the trainer, with filters', async () => {
    const assignment = await makeAssignment(course);
    await makeSubmission(assignment, student, {
      status: 'resubmit_requested',
      submittedAt: fromNow(-3 * HOUR),
    });
    await makeSubmission(assignment, student, {
      attempt: 2,
      submittedAt: fromNow(-HOUR),
      items: [{ type: 'code', code: { language: 'java', source: 'class Main {}' } }],
    });
    await makeSubmission(assignment, otherStudent, {
      status: 'reviewed',
      submittedAt: fromNow(-2 * HOUR),
      review: { marks: 70, finalMarks: 70, feedback: 'Good' },
    });
    const listFor = (query) =>
      api(app)
        .get(`/api/v1/assignments/${assignment.id}/submissions`)
        .query(query)
        .set(bearer(admin));

    const res = await listFor({});
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 2, page: 1 });
    expect(res.body.data.map((s) => [s.student.email, s.attempt, s.attempts, s.status])).toEqual([
      [student.email, 2, 2, 'submitted'],
      [otherStudent.email, 1, 1, 'reviewed'],
    ]);
    // Summaries leave out code and feedback.
    expect(res.body.data[0].items[0]).toEqual({
      type: 'code',
      code: { language: 'java', lines: 1 },
    });
    expect(res.body.data[1].review).toEqual({
      marks: 70,
      finalMarks: 70,
      reviewedAt: null,
    });

    const waiting = await listFor({ status: 'submitted' });
    expect(waiting.body.data.map((s) => s.student.email)).toEqual([student.email]);
    const paged = await listFor({ limit: 1, page: 2 });
    expect(paged.body.data.map((s) => s.student.email)).toEqual([otherStudent.email]);
  });
});
