import mongoose from 'mongoose';
import {
  Assignment,
  CONTENT_STATUS,
  Course,
  Enrollment,
  ENROLLMENT_STATUS,
  Lesson,
  Notification,
  NOTIFICATION_TYPES,
  ROLES,
  SUBMISSION_STATUS,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import {
  assignmentsOpenToEnrolledStudents,
  lessonOpenToEnrolledStudents,
} from './access.service.js';

const { trusted } = mongoose;

// In-app paths, matching the client's routes.
export const notificationLinks = {
  lesson: (courseId, lessonId) => `/app/courses/${courseId}/lessons/${lessonId}`,
  assignment: (courseId, assignmentId) => `/app/courses/${courseId}/assignments/${assignmentId}`,
  review: (submission) =>
    `/admin/courses/${submission.course}/assignments/${submission.assignment}/submissions/${submission._id}`,
};

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Sends one notification to each of `recipients`. The key identifies the
 * event, so each user gets at most one notification per key:
 * - by default a repeated event (publishing again, a double click) is ignored;
 * - with `refresh`, the existing one is updated and becomes unread and new
 *   again (a changed review).
 * Like the activity log, a failure is logged and never fails the action.
 */
export async function notify(
  recipients,
  { type, key, title, body = '', link = null },
  options = {},
) {
  if (recipients.length === 0) return;
  const now = new Date();
  const content = { type, title: clip(title, 300), body: clip(body, 500), link };
  const operations = recipients.map((user) => ({
    updateOne: {
      filter: { user, key },
      update: options.refresh
        ? { $set: { ...content, readAt: null, createdAt: now } }
        : { $setOnInsert: { ...content, readAt: null, createdAt: now } },
      upsert: true,
    },
  }));
  try {
    await Notification.bulkWrite(operations, { ordered: false });
  } catch (error) {
    // Two identical events at the same instant can race on the unique key; one copy wins.
    const duplicatesOnly = error.writeErrors?.every((e) => e.code === 11000);
    if (!duplicatesOnly) logger.warn({ type, err: error.message }, 'Could not send notifications');
  }
}

/** Active students with an active enrollment in the course. */
async function enrolledStudents(courseId) {
  const enrolled = await Enrollment.distinct('user', {
    course: courseId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
  if (enrolled.length === 0) return [];
  return User.distinct('_id', {
    _id: trusted({ $in: enrolled }),
    role: ROLES.STUDENT,
    isActive: true,
  });
}

const activeTrainers = () => User.distinct('_id', { role: ROLES.ADMIN, isActive: true });

/** Wraps an event handler so that it never fails the request that caused it. */
const safely =
  (name, handler) =>
  async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      logger.warn({ event: name, err: error.message }, 'Could not send notifications');
    }
  };

const becamePublished = (previousStatus, doc) =>
  previousStatus !== CONTENT_STATUS.PUBLISHED && doc.status === CONTENT_STATUS.PUBLISHED;

/**
 * A material was just published (created as published, or moved to
 * published). Students are told only when they can open its lesson now.
 */
export const materialPublished = safely('material_published', async (material, previousStatus) => {
  if (!becamePublished(previousStatus, material)) return;
  const lesson = await Lesson.findById(material.lesson).select('title status module course');
  if (!lesson || !(await lessonOpenToEnrolledStudents(lesson))) return;
  const course = await Course.findById(lesson.course).select('title').lean();
  await notify(await enrolledStudents(lesson.course), {
    type: NOTIFICATION_TYPES.MATERIAL_PUBLISHED,
    key: `material_published:${material._id}`,
    title: `New material: ${material.title}`,
    body: `${lesson.title} · ${course.title}`,
    link: notificationLinks.lesson(lesson.course, lesson._id),
  });
});

/**
 * An assignment was just published. Students are told only when every
 * enrolled student can see it now (its course, module and lesson published).
 */
export const assignmentPublished = safely(
  'assignment_published',
  async (assignment, previousStatus) => {
    if (!becamePublished(previousStatus, assignment)) return;
    const open = await Assignment.exists({
      _id: assignment._id,
      ...(await assignmentsOpenToEnrolledStudents([assignment.course])),
    });
    if (!open) return;
    const course = await Course.findById(assignment.course).select('title').lean();
    await notify(await enrolledStudents(assignment.course), {
      type: NOTIFICATION_TYPES.ASSIGNMENT_PUBLISHED,
      key: `assignment_published:${assignment._id}`,
      title: `New assignment: ${assignment.title}`,
      body: course.title,
      link: notificationLinks.assignment(assignment.course, assignment._id),
    });
  },
);

/**
 * The trainer reviewed an attempt or asked for a new one. Both share one key
 * per attempt, so the student's notification always shows the latest decision.
 */
export const submissionFeedback = safely('submission_feedback', async (submission, assignment) => {
  const resubmit = submission.status === SUBMISSION_STATUS.RESUBMIT_REQUESTED;
  await notify(
    [submission.student],
    {
      type: resubmit
        ? NOTIFICATION_TYPES.RESUBMIT_REQUESTED
        : NOTIFICATION_TYPES.SUBMISSION_REVIEWED,
      key: `submission_feedback:${submission._id}`,
      title: resubmit
        ? `New attempt requested: ${assignment.title}`
        : `Feedback on ${assignment.title}`,
      body: resubmit
        ? `Your trainer reviewed attempt ${submission.attempt} and asked for another attempt. Open it to read the feedback.`
        : `Your trainer reviewed attempt ${submission.attempt}. Open it to see your marks and feedback.`,
      link: notificationLinks.assignment(submission.course, submission.assignment),
    },
    { refresh: true },
  );
});

/** A student handed in an attempt: the trainer is told. Edits don't notify again. */
export const submissionReceived = safely(
  'submission_received',
  async (submission, assignment, student) => {
    await notify(await activeTrainers(), {
      type: NOTIFICATION_TYPES.SUBMISSION_RECEIVED,
      key: `submission_received:${submission._id}`,
      title: `New submission: ${assignment.title}`,
      body:
        submission.attempt > 1
          ? `${student.name} handed in attempt ${submission.attempt}.`
          : `${student.name} handed in their work.`,
      link: notificationLinks.review(submission),
    });
  },
);

// ---- Reading ----

export const toNotificationDTO = (notification) => ({
  id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  body: notification.body,
  link: notification.link,
  read: Boolean(notification.readAt),
  readAt: notification.readAt,
  createdAt: notification.createdAt,
});

export const countUnread = (user) => Notification.countDocuments({ user: user._id, readAt: null });

/** The user's own notifications, newest first. `status: 'unread'` leaves out read ones. */
export async function listNotifications(user, { page, limit, status }) {
  const filter = { user: user._id, ...(status === 'unread' && { readAt: null }) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    countUnread(user),
  ]);
  return {
    items: items.map(toNotificationDTO),
    meta: { ...paginationMeta({ page, limit }, total), unread },
  };
}

/** Marks one of the user's own notifications as read. Anyone else's is 404. */
export async function markRead(user, notificationId) {
  const notification = await Notification.findOne({ _id: notificationId, user: user._id });
  if (!notification) throw ApiError.notFound('Notification not found');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return { notification: toNotificationDTO(notification), unread: await countUnread(user) };
}

export async function markAllRead(user) {
  const result = await Notification.updateMany(
    { user: user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { updated: result.modifiedCount };
}
