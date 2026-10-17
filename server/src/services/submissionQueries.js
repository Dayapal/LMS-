import { SUBMISSION_STATUS } from '../models/index.js';

/*
 * Aggregation building blocks shared by the per-assignment submission list
 * (Phase 4), the review queue, the dashboards and the reports, so they all
 * count the same thing: the latest attempt of each student at each
 * assignment. Earlier attempts are history.
 *
 * Values in a `match` go straight into an aggregation, which doesn't cast,
 * so ids in it must already be ObjectIds.
 */

/**
 * One row per (assignment, student) among the submissions matching `match`:
 * `{ _id: { assignment, student }, latest, attempts }`. The sort reads the
 * unique `{assignment, student, attempt}` index backwards.
 */
export const latestAttemptStages = (match) => [
  { $match: match },
  { $sort: { assignment: -1, student: -1, attempt: -1 } },
  {
    $group: {
      _id: { assignment: '$assignment', student: '$student' },
      latest: { $first: '$$ROOT' },
      attempts: { $sum: 1 },
    },
  },
];

/** Review states of a latest attempt. `resubmitted` is a new attempt (2+) waiting for review. */
export const REVIEW_STATES = Object.freeze({
  SUBMITTED: SUBMISSION_STATUS.SUBMITTED,
  RESUBMITTED: 'resubmitted',
  RESUBMIT_REQUESTED: SUBMISSION_STATUS.RESUBMIT_REQUESTED,
  REVIEWED: SUBMISSION_STATUS.REVIEWED,
});

const statusIs = (status) => ({ $eq: ['$latest.status', status] });

/** `$match` stage keeping latest attempts in one review state. */
export function reviewStateMatch(state) {
  if (state === REVIEW_STATES.RESUBMITTED) {
    return {
      $match: { 'latest.status': SUBMISSION_STATUS.SUBMITTED, 'latest.attempt': { $gt: 1 } },
    };
  }
  return { $match: { 'latest.status': state } };
}

const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });

/** `$group` accumulators counting latest attempts per review state. */
export const REVIEW_COUNT_FIELDS = Object.freeze({
  all: { $sum: 1 },
  submitted: countIf(statusIs(SUBMISSION_STATUS.SUBMITTED)),
  resubmitted: countIf({
    $and: [statusIs(SUBMISSION_STATUS.SUBMITTED), { $gt: ['$latest.attempt', 1] }],
  }),
  resubmit_requested: countIf(statusIs(SUBMISSION_STATUS.RESUBMIT_REQUESTED)),
  reviewed: countIf(statusIs(SUBMISSION_STATUS.REVIEWED)),
});

/** The counts of REVIEW_COUNT_FIELDS from one `$group` row (zeros when there is none). */
export const toReviewCounts = (row) => ({
  all: row?.all ?? 0,
  submitted: row?.submitted ?? 0,
  resubmitted: row?.resubmitted ?? 0,
  resubmit_requested: row?.resubmit_requested ?? 0,
  reviewed: row?.reviewed ?? 0,
});
