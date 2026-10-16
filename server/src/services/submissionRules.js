import { SUBMISSION_STATUS } from '../models/index.js';

/*
 * The submission rules of spec §5, as pure functions of an assignment, the
 * student's latest attempt and the current time. Every date is a UTC instant.
 *
 * - The submission window closes at the due date, or at `latePolicy.lateUntil`
 *   when late work is allowed. Work handed in after the due date is late.
 * - A first attempt can be made, and edited, while the window is open. Editing
 *   it after the due date makes it late.
 * - A new attempt is only possible after the trainer asks for a resubmission,
 *   while attempts remain. The request itself is the permission, so it also
 *   works after the window has closed, and the new attempt keeps the late flag
 *   of the work it replaces.
 * - Nothing can be edited once the trainer has reviewed it.
 */

const allowed = Object.freeze({ allowed: true, reason: null });
const refused = (reason) => ({ allowed: false, reason });

/** The last moment a first attempt is accepted. */
export function closesAt(assignment) {
  const { allowLate, lateUntil } = assignment.latePolicy ?? {};
  return allowLate && lateUntil ? lateUntil : assignment.dueAt;
}

export const isWindowOpen = (assignment, now) => now.getTime() <= closesAt(assignment).getTime();

const isAfterDue = (assignment, at) => at.getTime() > assignment.dueAt.getTime();

const hasAttemptsLeft = (assignment, attemptsUsed) =>
  assignment.maxAttempts == null || attemptsUsed < assignment.maxAttempts;

/** Whether the student may start a new attempt now. */
export function newAttemptCheck(assignment, latest, now) {
  if (!latest) {
    return isWindowOpen(assignment, now) ? allowed : refused('The submission window has closed.');
  }
  switch (latest.status) {
    case SUBMISSION_STATUS.RESUBMIT_REQUESTED:
      return hasAttemptsLeft(assignment, latest.attempt)
        ? allowed
        : refused(`You have used all ${assignment.maxAttempts} attempts for this assignment.`);
    case SUBMISSION_STATUS.SUBMITTED:
      return refused('You have already submitted this assignment. Edit your submission instead.');
    default:
      return refused(
        'This assignment has been reviewed. A new attempt is possible only if your trainer asks for a resubmission.',
      );
  }
}

/** Whether the student may still edit `submission`, given their `latest` attempt. */
export function editCheck(assignment, submission, latest, now) {
  if (!latest || !submission._id.equals(latest._id)) {
    return refused('Only your latest attempt can be edited.');
  }
  if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
    return refused('This submission has been reviewed and can no longer be edited.');
  }
  if (submission.attempt === 1 && !isWindowOpen(assignment, now)) {
    return refused('The submission window has closed, so this submission can no longer be edited.');
  }
  return allowed;
}

/** The late flag of a new attempt handed in at `at`. */
export function lateForNewAttempt(assignment, latest, at) {
  return latest ? Boolean(latest.isLate) : isAfterDue(assignment, at);
}

/** The late flag after the student edits `submission` at `at`. */
export function lateAfterEdit(assignment, submission, at) {
  return submission.attempt === 1
    ? submission.isLate || isAfterDue(assignment, at)
    : submission.isLate;
}

/** Marks after the late penalty (spec §5), rounded to two decimals. */
export function finalMarksFor(assignment, { marks, isLate }) {
  if (marks == null) return null;
  const penalty = isLate ? (assignment.latePolicy?.penaltyPercent ?? 0) : 0;
  return Math.round(marks * (100 - penalty)) / 100;
}

/**
 * The student-facing state of an assignment (spec §5): `pending`, `overdue`
 * (past the due date with nothing handed in), or the status of the latest
 * attempt. Never stored.
 */
export function studentStatus(assignment, latest, now) {
  if (latest) return latest.status;
  return isAfterDue(assignment, now) ? 'overdue' : 'pending';
}
