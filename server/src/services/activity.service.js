import mongoose from 'mongoose';
import { Activity, ACTIVITY_TYPES } from '../models/index.js';
import { logger } from '../utils/logger.js';

const { trusted } = mongoose;

/**
 * Appends one learning event (spec §5). Only ids and the event type are
 * stored. The log is secondary: a failure is logged (without the request's
 * data) and never fails the action that caused it.
 */
export async function recordActivity({
  user,
  type,
  actor = null,
  course = null,
  lesson = null,
  assignment = null,
  submission = null,
  attempt = null,
}) {
  try {
    await Activity.create({ user, type, actor, course, lesson, assignment, submission, attempt });
  } catch (error) {
    logger.warn({ type, err: error.message }, 'Could not record activity');
  }
}

/** Events worth showing in a feed: everything except sign-ins. */
export const FEED_FILTER = { type: trusted({ $ne: ACTIVITY_TYPES.LOGIN }) };

const ref = (doc, field) => (doc?.[field] ? { id: doc._id.toString(), [field]: doc[field] } : null);

export const toActivityDTO = (activity) => ({
  id: activity._id.toString(),
  type: activity.type,
  createdAt: activity.createdAt,
  student: ref(activity.user, 'name'),
  actor: ref(activity.actor, 'name'),
  course: ref(activity.course, 'title'),
  lesson: ref(activity.lesson, 'title'),
  assignment: ref(activity.assignment, 'title'),
  submissionId: activity.submission?.toString() ?? null,
  attempt: activity.attempt ?? null,
});

/** The latest events matching `filter`, newest first, with names and titles. */
export async function listActivity(filter, { limit = 10 } = {}) {
  const activities = await Activity.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate([
      { path: 'user', select: 'name' },
      { path: 'actor', select: 'name' },
      { path: 'course', select: 'title' },
      { path: 'lesson', select: 'title' },
      { path: 'assignment', select: 'title' },
    ])
    .lean();
  return activities.map(toActivityDTO);
}
