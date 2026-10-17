import { config } from '../config/env.js';
import { NOTIFICATION_TYPES, ROLES, STUDENT_ASSIGNMENT_STATUS } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { myAssignmentRows } from './assignment.service.js';
import { notificationLinks, notify } from './notification.service.js';

const HOUR_MS = 60 * 60 * 1000;

// When each student's reminders were last worked out, by user id.
const lastChecked = new Map();

/** For tests: forget when reminders were last checked. */
export const resetDeadlineChecks = () => lastChecked.clear();

/**
 * Assignments the student hasn't handed in that are due within the next
 * `deadlineSoonHours`, worked out from the same rows as their assignments
 * page (spec §10's on-request check).
 */
export function dueSoon(rows, now = new Date()) {
  const until = now.getTime() + config.notifications.deadlineSoonHours * HOUR_MS;
  return rows.filter((row) => {
    const due = new Date(row.dueAt).getTime();
    return (
      row.mySubmission.status === STUDENT_ASSIGNMENT_STATUS.PENDING &&
      row.mySubmission.canSubmit &&
      due > now.getTime() &&
      due <= until
    );
  });
}

/**
 * Sends a "due soon" reminder for each assignment the student still has to
 * hand in. Runs when a student reads their notifications, at most once per
 * `deadlineCheckIntervalMs` per student. The key includes the due date, so
 * each deadline is reminded once, and again only if the trainer moves it.
 */
export async function refreshDeadlineReminders(user, now = new Date()) {
  if (user.role !== ROLES.STUDENT) return;
  const id = user._id.toString();
  const previous = lastChecked.get(id);
  if (previous && now.getTime() - previous < config.notifications.deadlineCheckIntervalMs) return;
  lastChecked.set(id, now.getTime());

  try {
    const rows = dueSoon(await myAssignmentRows(user, {}, now), now);
    for (const row of rows) {
      await notify([user._id], {
        type: NOTIFICATION_TYPES.DEADLINE_SOON,
        key: `deadline_soon:${row.id}:${new Date(row.dueAt).toISOString()}`,
        title: `Due soon: ${row.title}`,
        body: `${row.course.title} · due within ${config.notifications.deadlineSoonHours} hours and not handed in yet.`,
        link: notificationLinks.assignment(row.course.id, row.id),
      });
    }
  } catch (error) {
    logger.warn({ err: error.message }, 'Could not check deadlines');
  }
}
