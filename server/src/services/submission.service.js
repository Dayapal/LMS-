import {
  ACTIVITY_TYPES,
  Assignment,
  FILE_PURPOSES,
  FileAsset,
  Submission,
  SUBMISSION_STATUS,
  SUBMISSION_TYPES,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getAssignmentForViewer, getSubmissionForViewer, isAdmin } from './access.service.js';
import { recordActivity } from './activity.service.js';
import { deleteFilesIfUnused } from './file.service.js';
import { submissionFeedback, submissionReceived } from './notification.service.js';
import { toAssignmentDTO, toSubmissionDTO } from './serializers.js';
import {
  closedReason,
  editCheck,
  finalMarksFor,
  lateAfterEdit,
  lateForNewAttempt,
  newAttemptCheck,
} from './submissionRules.js';

const TYPE_LABEL = {
  [SUBMISSION_TYPES.DRIVE_URL]: 'Google Drive links',
  [SUBMISSION_TYPES.GITHUB_URL]: 'GitHub repository links',
  [SUBMISSION_TYPES.PROJECT_URL]: 'deployed project links',
  [SUBMISSION_TYPES.PDF]: 'PDF files',
  [SUBMISSION_TYPES.CODE]: 'code snippets',
};

const withFiles = (query) => query.populate('items.file');

const latestAttempt = (assignmentId, studentId) =>
  Submission.findOne({ assignment: assignmentId, student: studentId }).sort({ attempt: -1 });

const fileIdsOf = (items) => items.map((item) => item.file).filter(Boolean);

/**
 * Turns validated request items into stored items. Every type must be one the
 * assignment accepts, and each PDF must be the student's own upload for this
 * assignment.
 */
async function resolveItems(items, assignment, student) {
  const problems = [];
  const resolved = [];
  for (const [index, item] of items.entries()) {
    if (!assignment.allowedSubmissionTypes.includes(item.type)) {
      problems.push({
        path: `items.${index}.type`,
        message: `This assignment does not accept ${TYPE_LABEL[item.type]}`,
      });
      continue;
    }
    if (item.type === SUBMISSION_TYPES.PDF) {
      const file = await FileAsset.findById(item.fileId).select('purpose assignment uploadedBy');
      const own =
        file?.purpose === FILE_PURPOSES.SUBMISSION &&
        file.assignment?.equals(assignment._id) &&
        file.uploadedBy.equals(student._id);
      if (!own) {
        problems.push({
          path: `items.${index}.fileId`,
          message: 'Upload the PDF for this assignment before submitting it',
        });
        continue;
      }
      resolved.push({ type: item.type, file: file._id });
    } else if (item.type === SUBMISSION_TYPES.CODE) {
      resolved.push({ type: item.type, code: item.code });
    } else {
      resolved.push({ type: item.type, url: item.url });
    }
  }
  if (problems.length > 0) throw ApiError.validation(problems);
  return resolved;
}

/** Logs an event about `submission` (ids and the attempt number only, never the work itself). */
const recordSubmissionActivity = (submission, type, actor = null) =>
  recordActivity({
    user: submission.student,
    actor,
    type,
    course: submission.course,
    assignment: submission.assignment,
    submission: submission._id,
    attempt: submission.attempt,
  });

async function populated(submission) {
  await submission.populate('items.file');
  return toSubmissionDTO(submission);
}

// ---- Student ----

/** A new attempt: the first one, or one the trainer asked for. */
export async function createSubmission(student, assignmentId, { items, note }) {
  const { assignment } = await getAssignmentForViewer(student, assignmentId);
  const latest = await latestAttempt(assignment._id, student._id);
  const now = new Date();
  const check = newAttemptCheck(assignment, latest, now);
  if (!check.allowed) throw ApiError.conflict(check.reason);

  const submission = await Submission.create({
    assignment: assignment._id,
    course: assignment.course,
    student: student._id,
    attempt: (latest?.attempt ?? 0) + 1,
    items: await resolveItems(items, assignment, student),
    note,
    submittedAt: now,
    isLate: lateForNewAttempt(assignment, latest, now),
  });
  await recordSubmissionActivity(submission, ACTIVITY_TYPES.SUBMISSION_CREATED);
  await submissionReceived(submission, assignment, student);
  return populated(submission);
}

/** Edits the student's latest attempt while it is unreviewed (and, for a first attempt, the window is open). */
export async function updateSubmission(student, submissionId, { items, note }) {
  const submission = await getSubmissionForViewer(student, submissionId);
  const { assignment } = await getAssignmentForViewer(student, submission.assignment);
  const latest = await latestAttempt(assignment._id, student._id);
  const now = new Date();
  const check = editCheck(assignment, submission, latest, now);
  if (!check.allowed) throw ApiError.conflict(check.reason);

  let removedFiles = [];
  if (items !== undefined) {
    const next = await resolveItems(items, assignment, student);
    const kept = new Set(fileIdsOf(next).map(String));
    removedFiles = fileIdsOf(submission.items).filter((fileId) => !kept.has(fileId.toString()));
    submission.items = next;
  }
  if (note !== undefined) submission.note = note;
  submission.editedAt = now;
  submission.isLate = lateAfterEdit(assignment, submission, now);
  await submission.save();
  await deleteFilesIfUnused(removedFiles);
  return populated(submission);
}

/** Every attempt the student made at an assignment they can see, newest first. */
export async function listMySubmissions(student, assignmentId) {
  const { assignment } = await getAssignmentForViewer(student, assignmentId);
  const submissions = await withFiles(
    Submission.find({ assignment: assignment._id, student: student._id }).sort({ attempt: -1 }),
  );
  return submissions.map((s) => toSubmissionDTO(s));
}

/**
 * Checks, before the upload is read, that the student may hand in a PDF for
 * this assignment right now: it accepts PDFs and they can submit or edit.
 */
export async function assignmentForUpload(student, assignmentId) {
  const { assignment } = await getAssignmentForViewer(student, assignmentId);
  if (!assignment.allowedSubmissionTypes.includes(SUBMISSION_TYPES.PDF)) {
    throw ApiError.fileRejected('This assignment does not accept PDF files');
  }
  const latest = await latestAttempt(assignment._id, student._id);
  const now = new Date();
  const create = newAttemptCheck(assignment, latest, now);
  if (!create.allowed && !(latest && editCheck(assignment, latest, latest, now).allowed)) {
    throw ApiError.conflict(create.reason);
  }
  return assignment;
}

// ---- Shared ----

/**
 * One submission. Students get only their own (404 otherwise). The trainer
 * also gets the student, the assignment and the student's other attempts.
 */
export async function getSubmission(user, submissionId) {
  const submission = await getSubmissionForViewer(user, submissionId);
  const studentId = submission.student;
  await submission.populate([{ path: 'items.file' }, { path: 'student', select: 'name email' }]);
  const dto = toSubmissionDTO(submission);
  if (!isAdmin(user)) return dto;

  const [assignment, history] = await Promise.all([
    Assignment.findById(submission.assignment).populate('attachments'),
    withFiles(
      Submission.find({ assignment: submission.assignment, student: studentId }).sort({
        attempt: -1,
      }),
    ),
  ]);
  return {
    ...dto,
    assignment: assignment ? toAssignmentDTO(assignment) : null,
    history: history.map((s) => toSubmissionDTO(s, { summary: true })),
  };
}

// ---- Trainer review ----

async function latestForReview(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw ApiError.notFound('Submission not found');
  const [assignment, latest] = await Promise.all([
    Assignment.findById(submission.assignment),
    latestAttempt(submission.assignment, submission.student),
  ]);
  if (!assignment) throw ApiError.notFound('Submission not found');
  if (!latest._id.equals(submission._id)) {
    throw ApiError.conflict('Only the latest attempt can be reviewed.');
  }
  return { submission, assignment };
}

function assertMarksInRange(assignment, marks) {
  if (marks != null && marks > assignment.maxMarks) {
    throw ApiError.validation([{ path: 'marks', message: `At most ${assignment.maxMarks} marks` }]);
  }
}

const reviewFields = (trainer, assignment, submission, { marks, feedback }) => ({
  marks,
  finalMarks: finalMarksFor(assignment, { marks, isLate: submission.isLate }),
  feedback,
  reviewedBy: trainer._id,
  reviewedAt: new Date(),
});

/** Grades the latest attempt. Marks are capped at maxMarks; late work loses the penalty. */
export async function reviewSubmission(trainer, submissionId, { marks, feedback }) {
  const { submission, assignment } = await latestForReview(submissionId);
  assertMarksInRange(assignment, marks);
  submission.status = SUBMISSION_STATUS.REVIEWED;
  submission.review = reviewFields(trainer, assignment, submission, { marks, feedback });
  await submission.save();
  await recordSubmissionActivity(submission, ACTIVITY_TYPES.SUBMISSION_REVIEWED, trainer._id);
  await submissionFeedback(submission, assignment);
  return getSubmission(trainer, submission._id);
}

/** Asks for a new attempt, with feedback and optional marks for this one. */
export async function requestResubmission(trainer, submissionId, { marks, feedback }) {
  const { submission, assignment } = await latestForReview(submissionId);
  assertMarksInRange(assignment, marks);
  if (closedReason(assignment)) {
    throw ApiError.conflict(
      `This assignment is ${assignment.status}, so the student can't hand in a new attempt. Publish it again first, or review this attempt.`,
    );
  }
  if (assignment.maxAttempts != null && submission.attempt >= assignment.maxAttempts) {
    throw ApiError.conflict(
      `The student has used all ${assignment.maxAttempts} attempts. Review this attempt instead.`,
    );
  }
  submission.status = SUBMISSION_STATUS.RESUBMIT_REQUESTED;
  submission.review = reviewFields(trainer, assignment, submission, { marks, feedback });
  await submission.save();
  await recordSubmissionActivity(submission, ACTIVITY_TYPES.RESUBMISSION_REQUESTED, trainer._id);
  await submissionFeedback(submission, assignment);
  return getSubmission(trainer, submission._id);
}
