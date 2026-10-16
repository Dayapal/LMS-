import { Assignment, Submission } from '../src/models/index.js';
import { api } from './helpers.js';
import { bearer } from './content-helpers.js';
import { PDF_MIME, samplePdf } from './file-helpers.js';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const fromNow = (ms) => new Date(Date.now() + ms);

export const ALL_TYPES = ['drive_url', 'github_url', 'project_url', 'pdf', 'code'];

/** Inserts an assignment directly, published and due in a week unless overridden. */
export const makeAssignment = (course, overrides = {}) =>
  Assignment.create({
    course: course._id,
    title: 'Build a portfolio',
    instructions: 'Make it **great**.',
    dueAt: fromNow(7 * DAY),
    maxMarks: 100,
    allowedSubmissionTypes: ALL_TYPES,
    status: 'published',
    ...overrides,
  });

/** Inserts a submission directly. */
export const makeSubmission = (assignment, student, overrides = {}) =>
  Submission.create({
    assignment: assignment._id,
    course: assignment.course,
    student: student._id,
    attempt: 1,
    items: [{ type: 'github_url', url: 'https://github.com/asha/portfolio' }],
    submittedAt: new Date(),
    ...overrides,
  });

export const githubItem = (repo = 'portfolio') => ({
  type: 'github_url',
  url: `https://github.com/asha/${repo}`,
});

export const submit = (app, user, assignment, body) =>
  api(app).post(`/api/v1/assignments/${assignment.id}/submissions`).set(bearer(user)).send(body);

export const editSubmission = (app, user, submissionId, body) =>
  api(app).patch(`/api/v1/submissions/${submissionId}`).set(bearer(user)).send(body);

export const review = (app, user, submissionId, body) =>
  api(app).post(`/api/v1/submissions/${submissionId}/review`).set(bearer(user)).send(body);

export const requestResubmission = (app, user, submissionId, body) =>
  api(app)
    .post(`/api/v1/submissions/${submissionId}/request-resubmission`)
    .set(bearer(user))
    .send(body);

/** POST /assignments/:id/files as `user`. */
export function uploadSubmissionFile(
  app,
  user,
  assignment,
  { buffer = samplePdf('My answers'), filename = 'answers.pdf', contentType = PDF_MIME } = {},
) {
  return api(app)
    .post(`/api/v1/assignments/${assignment.id}/files`)
    .set(bearer(user))
    .attach('file', buffer, { filename, contentType });
}
