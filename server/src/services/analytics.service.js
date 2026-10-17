import mongoose from 'mongoose';
import {
  Assignment,
  CONTENT_STATUS,
  Enrollment,
  ENROLLMENT_STATUS,
  LessonProgress,
  ROLES,
  Submission,
  SUBMISSION_STATUS,
} from '../models/index.js';
import { assignmentsOpenToEnrolledStudents } from './access.service.js';
import { countableLessons } from './progress.service.js';
import { isCourseComplete, progressPercent } from './progressRules.js';
import { closesAt } from './submissionRules.js';
import { latestAttemptStages, REVIEW_COUNT_FIELDS, toReviewCounts } from './submissionQueries.js';

/*
 * Numbers for the trainer's dashboard, student pages and reports. Each figure
 * is computed with the same rules the students' own pages use, in batched
 * queries or aggregations (never one query per student):
 *
 * - Progress counts the lessons students see on the roadmap (published
 *   lessons in published modules) and rounds down (progressRules.js).
 * - "Expected", "pending" and "overdue" work follows what an actively
 *   enrolled student sees (assignmentsOpenToEnrolledStudents), and the same
 *   derived states as studentStatus: overdue means strictly past the due date
 *   with nothing handed in.
 * - Review counts are about each student's latest attempt, whatever their
 *   enrollment is now, like the review queue: the trainer still reviews work
 *   from a student who has since been removed.
 */

const { ObjectId } = mongoose.Types;
const { trusted } = mongoose;

/** Progress is measured against what students see, whoever asks. */
const STUDENT_VIEW = Object.freeze({ role: ROLES.STUDENT });

const idOf = (value) => value.toString();
// The id of a reference, populated or not.
const refId = (ref) => ref?._id ?? ref;
export const toObjectId = (value) =>
  value instanceof ObjectId ? value : new ObjectId(idOf(value));
const toObjectIds = (values) => values.map(toObjectId);
const uniqueIds = (values) => [...new Set(values.map(idOf))].map(toObjectId);

/** Key for per-(student, course) maps. */
export const pairKey = (user, course) => `${idOf(user)}:${idOf(course)}`;

// ---- Progress ----

/** Countable lessons per course id (see progress.service.js), as students see them. */
export const lessonsByCourse = (courseIds) => countableLessons(STUDENT_VIEW, courseIds);

const countableIds = (lessons) =>
  [...lessons.values()].flat().map((lesson) => new ObjectId(lesson.id));

/**
 * Completed countable lessons per (student, course), for `userIds` (or every
 * student) in the courses of `lessons`: Map pairKey → { completed, lastCompletedAt }.
 */
export async function completedCounts(lessons, { userIds } = {}) {
  const ids = countableIds(lessons);
  if (ids.length === 0 || userIds?.length === 0) return new Map();
  const match = { lesson: { $in: ids } };
  if (userIds) match.user = { $in: toObjectIds(userIds) };
  const rows = await LessonProgress.aggregate([
    { $match: match },
    {
      $group: {
        _id: { user: '$user', course: '$course' },
        completed: { $sum: 1 },
        lastCompletedAt: { $max: '$completedAt' },
      },
    },
  ]);
  return new Map(rows.map((row) => [pairKey(row._id.user, row._id.course), row]));
}

/** The same numbers as courseProgress (progressRules.js), from batched counts. */
export function progressOf(counts, lessons, user, course) {
  const totalLessons = lessons.get(idOf(course))?.length ?? 0;
  const row = counts.get(pairKey(user, course));
  const completedLessons = row?.completed ?? 0;
  return {
    completedLessons,
    totalLessons,
    percent: progressPercent(completedLessons, totalLessons),
    completed: isCourseComplete(completedLessons, totalLessons),
    lastCompletedAt: row?.lastCompletedAt ?? null,
  };
}

/**
 * How many students of each course have completed how many countable lessons,
 * among its enrollments with `status` (active by default): Map course id →
 * [{ completed, students }]. Grouped in the database.
 */
async function progressHistogram(courseIds, lessons, status = ENROLLMENT_STATUS.ACTIVE) {
  if (courseIds.length === 0) return new Map();
  const rows = await Enrollment.aggregate([
    { $match: { course: { $in: toObjectIds(courseIds) }, status } },
    {
      $lookup: {
        from: LessonProgress.collection.name,
        localField: 'user',
        foreignField: 'user',
        let: { course: '$course' },
        pipeline: [
          {
            $match: {
              lesson: { $in: countableIds(lessons) },
              $expr: { $eq: ['$course', '$$course'] },
            },
          },
          { $count: 'n' },
        ],
        as: 'done',
      },
    },
    {
      $group: {
        _id: { course: '$course', completed: { $ifNull: [{ $first: '$done.n' }, 0] } },
        students: { $sum: 1 },
      },
    },
  ]);
  const byCourse = new Map();
  for (const row of rows) {
    const key = idOf(row._id.course);
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push({ completed: row._id.completed, students: row.students });
  }
  return byCourse;
}

/** Ranges of the progress distribution chart, by whole percentage. */
export const PROGRESS_BANDS = Object.freeze([
  { label: 'Not started', min: 0, max: 0 },
  { label: '1–24%', min: 1, max: 24 },
  { label: '25–49%', min: 25, max: 49 },
  { label: '50–74%', min: 50, max: 74 },
  { label: '75–99%', min: 75, max: 99 },
  { label: 'Completed', min: 100, max: 100 },
]);

/**
 * Class progress from a histogram. `averagePercent` is the mean of the
 * students' own (rounded-down) percentages, rounded down; null without students.
 */
export function summarizeHistogram(histogram = [], totalLessons) {
  let students = 0;
  let percentSum = 0;
  const distribution = PROGRESS_BANDS.map((band) => ({ ...band, students: 0 }));
  for (const { completed, students: count } of histogram) {
    const percent = progressPercent(completed, totalLessons);
    students += count;
    percentSum += percent * count;
    distribution.find((band) => percent >= band.min && percent <= band.max).students += count;
  }
  const completedStudents =
    totalLessons > 0 ? (histogram.find((row) => row.completed === totalLessons)?.students ?? 0) : 0;
  const notStarted = histogram.find((row) => row.completed === 0)?.students ?? 0;
  return {
    students,
    averagePercent: students ? Math.floor(percentSum / students) : null,
    completedStudents,
    notStarted,
    inProgress: students - completedStudents - notStarted,
    distribution,
  };
}

// ---- Enrollments ----

/** Enrollments per course and status: Map course id → { active, pending, removed }. */
export async function enrollmentCounts(courseIds) {
  const counts = new Map(courseIds.map((id) => [idOf(id), emptyEnrollmentCounts()]));
  if (courseIds.length === 0) return counts;
  const rows = await Enrollment.aggregate([
    { $match: { course: { $in: toObjectIds(courseIds) } } },
    { $group: { _id: { course: '$course', status: '$status' }, n: { $sum: 1 } } },
  ]);
  for (const row of rows) counts.get(idOf(row._id.course))[row._id.status] = row.n;
  return counts;
}

export const emptyEnrollmentCounts = () =>
  Object.fromEntries(Object.values(ENROLLMENT_STATUS).map((status) => [status, 0]));

// ---- Assignments and submissions ----

/**
 * Review counts of latest attempts matching `match`, grouped by `groupBy`
 * (a submission field such as `course` or `student`), or one total when it
 * is omitted: Map id → counts, or the counts.
 */
export async function reviewCounts(match, groupBy) {
  const rows = await Submission.aggregate([
    ...latestAttemptStages(match),
    { $group: { _id: groupBy ? `$latest.${groupBy}` : null, ...REVIEW_COUNT_FIELDS } },
  ]);
  if (!groupBy) return toReviewCounts(rows[0]);
  return new Map(rows.map((row) => [idOf(row._id), toReviewCounts(row)]));
}

/** Assignments open to enrolled students (optionally in `courseIds`) whose due date has passed. */
async function pastDueOpenAssignments(courseIds, now) {
  return Assignment.find({
    $and: [await assignmentsOpenToEnrolledStudents(courseIds), { dueAt: trusted({ $lt: now }) }],
  })
    .select('_id course')
    .lean();
}

/**
 * Overdue assignments per active enrollment: for each student (optionally
 * only `userIds`) in each course (optionally only `courseIds`), how many
 * assignments open to them are past due with nothing handed in. Map pairKey
 * → { user, course, overdue }, with only non-zero entries.
 */
export async function overdueCounts({ userIds, courseIds } = {}, now = new Date()) {
  if (userIds?.length === 0 || courseIds?.length === 0) return new Map();
  const due = await pastDueOpenAssignments(courseIds, now);
  if (due.length === 0) return new Map();
  const dueByCourse = new Map();
  for (const assignment of due) {
    const key = idOf(assignment.course);
    dueByCourse.set(key, (dueByCourse.get(key) ?? 0) + 1);
  }

  const match = {
    status: ENROLLMENT_STATUS.ACTIVE,
    course: { $in: uniqueIds(due.map((a) => a.course)) },
  };
  if (userIds) match.user = { $in: toObjectIds(userIds) };
  const rows = await Enrollment.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Submission.collection.name,
        localField: 'user',
        foreignField: 'student',
        let: { course: '$course' },
        pipeline: [
          {
            $match: {
              assignment: { $in: due.map((a) => a._id) },
              $expr: { $eq: ['$course', '$$course'] },
            },
          },
          { $group: { _id: '$assignment' } },
        ],
        as: 'handedIn',
      },
    },
    { $project: { user: 1, course: 1, handedIn: { $size: '$handedIn' } } },
  ]);

  const result = new Map();
  for (const row of rows) {
    const overdue = dueByCourse.get(idOf(row.course)) - row.handedIn;
    if (overdue > 0) {
      result.set(pairKey(row.user, row.course), { user: row.user, course: row.course, overdue });
    }
  }
  return result;
}

/** Sums the `overdue` entries of an overdueCounts map, optionally grouped by `field` (user or course). */
export function sumOverdue(overdue, field) {
  if (!field) return [...overdue.values()].reduce((sum, row) => sum + row.overdue, 0);
  const totals = new Map();
  for (const row of overdue.values()) {
    const key = idOf(row[field]);
    totals.set(key, (totals.get(key) ?? 0) + row.overdue);
  }
  return totals;
}

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * What students have done with each assignment: Map id → stats.
 * - Review counts (`students` who handed in anything, `submitted`,
 *   `resubmitted`, `resubmit_requested`, `reviewed`) and the average final
 *   marks of reviewed latest attempts, over every student.
 * - Coverage, over students with an active enrollment: `expected` (0 unless
 *   the assignment is open to enrolled students), `handedIn`, and the rest
 *   split into `pending` (before the due date) and `overdue` (after it).
 */
export async function assignmentStats(assignments, now = new Date()) {
  const stats = new Map();
  if (assignments.length === 0) return stats;
  const ids = assignments.map((a) => a._id);
  const courseIds = uniqueIds(assignments.map((a) => refId(a.course)));

  const [openIds, enrollments, rows] = await Promise.all([
    assignmentsOpenToEnrolledStudents(courseIds).then((open) =>
      Assignment.distinct('_id', { $and: [open, { _id: trusted({ $in: ids }) }] }),
    ),
    enrollmentCounts(courseIds),
    Submission.aggregate([
      ...latestAttemptStages({ assignment: { $in: ids } }),
      {
        $lookup: {
          from: Enrollment.collection.name,
          localField: '_id.student',
          foreignField: 'user',
          let: { course: '$latest.course' },
          pipeline: [
            { $match: { $expr: { $eq: ['$course', '$$course'] } } },
            { $project: { status: 1 } },
          ],
          as: 'enrollment',
        },
      },
      {
        $group: {
          _id: '$_id.assignment',
          ...REVIEW_COUNT_FIELDS,
          activeHandedIn: {
            $sum: { $cond: [{ $in: [ENROLLMENT_STATUS.ACTIVE, '$enrollment.status'] }, 1, 0] },
          },
          marksTotal: {
            $sum: {
              $cond: [
                { $eq: ['$latest.status', SUBMISSION_STATUS.REVIEWED] },
                { $ifNull: ['$latest.review.finalMarks', 0] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const open = new Set(openIds.map(idOf));
  const byId = new Map(rows.map((row) => [idOf(row._id), row]));
  for (const assignment of assignments) {
    const row = byId.get(idOf(assignment._id));
    const reviews = toReviewCounts(row);
    const isOpen = open.has(idOf(assignment._id));
    const expected = isOpen ? enrollments.get(idOf(refId(assignment.course))).active : 0;
    const handedIn = isOpen ? (row?.activeHandedIn ?? 0) : 0;
    const missing = Math.max(0, expected - handedIn);
    const pastDue = now.getTime() > assignment.dueAt.getTime();
    stats.set(idOf(assignment._id), {
      students: reviews.all,
      submitted: reviews.submitted,
      resubmitted: reviews.resubmitted,
      resubmit_requested: reviews.resubmit_requested,
      reviewed: reviews.reviewed,
      averageMarks: reviews.reviewed ? round2(row.marksTotal / reviews.reviewed) : null,
      openToStudents: isOpen,
      expected,
      handedIn,
      pending: pastDue ? 0 : missing,
      overdue: pastDue ? missing : 0,
    });
  }
  return stats;
}

/** An assignment row for the trainer's tables, with its stats. */
export const toAssignmentRow = (assignment, stats) => ({
  id: idOf(assignment._id),
  courseId: idOf(refId(assignment.course)),
  title: assignment.title,
  status: assignment.status,
  dueAt: assignment.dueAt,
  closesAt: closesAt(assignment),
  maxMarks: assignment.maxMarks,
  stats,
});

// ---- Courses ----

const ASSIGNMENT_COUNT_FIELDS = Object.fromEntries(
  Object.values(CONTENT_STATUS).map((status) => [
    status,
    { $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } },
  ]),
);

/**
 * One row per course: enrollments by status, class progress of the active
 * students, assignment counts by status, review counts of latest attempts,
 * and how many (student, assignment) pairs are overdue.
 */
export async function courseSummaries(courses, now = new Date()) {
  const ids = courses.map((c) => c._id);
  if (ids.length === 0) return [];
  const lessons = await lessonsByCourse(ids);
  const [histograms, enrollments, reviews, overdue, assignmentRows] = await Promise.all([
    progressHistogram(ids, lessons),
    enrollmentCounts(ids),
    reviewCounts({ course: { $in: ids } }, 'course'),
    overdueCounts({ courseIds: ids }, now),
    Assignment.aggregate([
      { $match: { course: { $in: ids } } },
      { $group: { _id: '$course', ...ASSIGNMENT_COUNT_FIELDS } },
    ]),
  ]);
  const overdueByCourse = sumOverdue(overdue, 'course');
  const assignmentsByCourse = new Map(assignmentRows.map((row) => [idOf(row._id), row]));

  return courses.map((course) => {
    const key = idOf(course._id);
    const totalLessons = lessons.get(key)?.length ?? 0;
    const { distribution, ...progress } = summarizeHistogram(histograms.get(key), totalLessons);
    const counts = assignmentsByCourse.get(key);
    return {
      id: key,
      title: course.title,
      status: course.status,
      lessons: totalLessons,
      enrollments: enrollments.get(key),
      progress,
      distribution,
      assignments: {
        published: counts?.published ?? 0,
        draft: counts?.draft ?? 0,
        archived: counts?.archived ?? 0,
      },
      reviews: reviews.get(key) ?? toReviewCounts(),
      overdue: overdueByCourse.get(key) ?? 0,
    };
  });
}
