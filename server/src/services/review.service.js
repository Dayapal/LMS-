import mongoose from 'mongoose';
import {
  Assignment,
  Course,
  Enrollment,
  ROLES,
  Submission,
  SUBMISSION_STATUS,
  User,
} from '../models/index.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';
import { pairKey, toObjectId } from './analytics.service.js';
import { closesAt } from './submissionRules.js';
import {
  latestAttemptStages,
  REVIEW_COUNT_FIELDS,
  reviewStateMatch,
  toReviewCounts,
} from './submissionQueries.js';

const { trusted } = mongoose;

const idOf = (value) => value.toString();

/** Case-insensitive "contains" for a user's search text, matched literally. */
export const containsText = (q) => trusted({ $regex: escapeRegex(q), $options: 'i' });

/** Ids of students whose name or email contains `q`. */
export const studentIdsMatching = (q) =>
  User.distinct('_id', {
    role: ROLES.STUDENT,
    $or: [{ name: containsText(q) }, { email: containsText(q) }],
  });

/** Submissions by a student whose name or email contains `q`, or for an assignment whose title does. */
async function searchMatch(q) {
  const [students, assignments] = await Promise.all([
    studentIdsMatching(q),
    Assignment.distinct('_id', { title: containsText(q) }),
  ]);
  return { $or: [{ student: { $in: students } }, { assignment: { $in: assignments } }] };
}

/**
 * Queue order. `priority` (the default): work waiting for review first, the
 * longest-waiting first; then attempts sent back to the student and reviewed
 * work, most recent first. `oldest` and `newest` sort by submission time.
 */
function sortStages(sort) {
  const tieBreak = { '_id.student': 1, '_id.assignment': 1 };
  if (sort === 'oldest') return [{ $sort: { 'latest.submittedAt': 1, ...tieBreak } }];
  if (sort === 'newest') return [{ $sort: { 'latest.submittedAt': -1, ...tieBreak } }];
  return [
    {
      $addFields: {
        rank: {
          $switch: {
            branches: [
              { case: { $eq: ['$latest.status', SUBMISSION_STATUS.SUBMITTED] }, then: 0 },
              { case: { $eq: ['$latest.status', SUBMISSION_STATUS.RESUBMIT_REQUESTED] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    {
      $addFields: {
        sortTime: {
          $cond: [
            { $eq: ['$rank', 0] },
            { $toLong: '$latest.submittedAt' },
            {
              $multiply: [
                -1,
                { $toLong: { $ifNull: ['$latest.review.reviewedAt', '$latest.submittedAt'] } },
              ],
            },
          ],
        },
      },
    },
    { $sort: { rank: 1, sortTime: 1, ...tieBreak } },
  ];
}

const titled = (doc, extra = {}) =>
  doc ? { id: idOf(doc._id), title: doc.title, status: doc.status, ...extra } : null;

/** Students, courses, assignments and enrollments for queue rows, in four queries. */
async function hydrateRows(rows) {
  const studentIds = rows.map((row) => row._id.student);
  const assignmentIds = rows.map((row) => row._id.assignment);
  const courseIds = rows.map((row) => row.latest.course);
  const [students, assignments, courses, enrollments] = await Promise.all([
    User.find({ _id: trusted({ $in: studentIds }) })
      .select('name email')
      .lean(),
    Assignment.find({ _id: trusted({ $in: assignmentIds }) })
      .select('title status dueAt latePolicy maxMarks maxAttempts')
      .lean(),
    Course.find({ _id: trusted({ $in: courseIds }) })
      .select('title status')
      .lean(),
    Enrollment.find({ user: trusted({ $in: studentIds }), course: trusted({ $in: courseIds }) })
      .select('user course status')
      .lean(),
  ]);
  const byId = (docs) => new Map(docs.map((doc) => [idOf(doc._id), doc]));
  const studentById = byId(students);
  const assignmentById = byId(assignments);
  const courseById = byId(courses);
  const enrollmentByPair = new Map(enrollments.map((e) => [pairKey(e.user, e.course), e.status]));

  return rows.map(({ _id, latest, attempts }) => {
    const student = studentById.get(idOf(_id.student));
    const assignment = assignmentById.get(idOf(_id.assignment));
    return {
      id: idOf(latest._id),
      attempt: latest.attempt,
      attempts,
      status: latest.status,
      isLate: Boolean(latest.isLate),
      submittedAt: latest.submittedAt,
      editedAt: latest.editedAt ?? null,
      review: latest.review
        ? {
            marks: latest.review.marks ?? null,
            finalMarks: latest.review.finalMarks ?? null,
            reviewedAt: latest.review.reviewedAt ?? null,
          }
        : null,
      student: student
        ? { id: idOf(student._id), name: student.name, email: student.email }
        : { id: idOf(_id.student), name: null, email: null },
      course: titled(courseById.get(idOf(latest.course))),
      assignment: titled(assignment, {
        dueAt: assignment?.dueAt,
        closesAt: assignment ? closesAt(assignment) : null,
        maxMarks: assignment?.maxMarks,
        maxAttempts: assignment?.maxAttempts ?? null,
      }),
      // The student's enrollment in the course now: their work stays reviewable after removal.
      enrollmentStatus: enrollmentByPair.get(pairKey(_id.student, latest.course)) ?? null,
    };
  });
}

/**
 * GET /admin/submissions: the latest attempt of every student at every
 * assignment, across courses. Filters (course, assignment, student, late, a
 * search on student name/email or assignment title) apply to everything;
 * `status` picks one review state. `meta.counts` has every state under the
 * other filters, so the tabs always show their numbers.
 */
export async function listReviewQueue({
  page,
  limit,
  q,
  course,
  assignment,
  student,
  status,
  late,
  sort,
}) {
  const match = {};
  if (course) match.course = toObjectId(course);
  if (assignment) match.assignment = toObjectId(assignment);
  if (student) match.student = toObjectId(student);
  if (q) Object.assign(match, await searchMatch(q));

  const stateMatch = status ? [reviewStateMatch(status)] : [];
  const [result] = await Submission.aggregate([
    ...latestAttemptStages(match),
    ...(late === undefined ? [] : [{ $match: { 'latest.isLate': late } }]),
    {
      $facet: {
        counts: [{ $group: { _id: null, ...REVIEW_COUNT_FIELDS } }],
        items: [
          ...stateMatch,
          ...sortStages(sort),
          { $skip: skipFor({ page, limit }) },
          { $limit: limit },
        ],
        total: [...stateMatch, { $count: 'count' }],
      },
    },
  ]);
  return {
    items: await hydrateRows(result.items),
    meta: {
      ...paginationMeta({ page, limit }, result.total[0]?.count ?? 0),
      counts: toReviewCounts(result.counts[0]),
    },
  };
}
