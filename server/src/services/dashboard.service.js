import mongoose from 'mongoose';
import {
  Activity,
  Assignment,
  CONTENT_STATUS,
  Course,
  Enrollment,
  ENROLLMENT_STATUS,
  ROLES,
  SUBMISSION_STATUS,
  User,
} from '../models/index.js';
import { FEED_FILTER, listActivity } from './activity.service.js';
import { assignmentsOpenToEnrolledStudents } from './access.service.js';
import {
  assignmentStats,
  courseSummaries,
  overdueCounts,
  reviewCounts,
  sumOverdue,
  toAssignmentRow,
} from './analytics.service.js';
import { countStates, myAssignmentRows } from './assignment.service.js';
import { listMyCourses } from './progress.service.js';
import { listReviewQueue } from './review.service.js';
import { toEnrollmentDTO } from './serializers.js';

const { trusted } = mongoose;

const LIST_SIZE = 5;

const FEEDBACK_STATES = new Set([SUBMISSION_STATUS.REVIEWED, SUBMISSION_STATUS.RESUBMIT_REQUESTED]);

/**
 * The student's own dashboard: their courses with progress, where to continue,
 * what they can hand in now, and their latest feedback. Built from the same
 * services as GET /me/courses and GET /me/assignments.
 */
export async function getStudentDashboard(student) {
  const [courses, assignments] = await Promise.all([
    listMyCourses(student),
    myAssignmentRows(student),
  ]);
  const active = courses.filter((item) => item.progress);

  return {
    summary: {
      activeCourses: active.length,
      completedCourses: active.filter((item) => item.progress.completed).length,
      pendingRequests: courses.length - active.length,
      lessonsCompleted: active.reduce((sum, item) => sum + item.progress.completedLessons, 0),
      assignments: countStates(assignments),
    },
    // Courses are ordered by recent activity, so this is the one studied last.
    continueLearning: active.find((item) => item.progress.nextLesson) ?? null,
    courses,
    // Work the student can hand in now (first attempts and requested resubmissions), due first.
    upcoming: assignments.filter((row) => row.mySubmission.canSubmit).slice(0, LIST_SIZE),
    recentFeedback: assignments
      .filter(
        (row) =>
          FEEDBACK_STATES.has(row.mySubmission.status) && row.mySubmission.latest?.reviewedAt,
      )
      .sort((a, b) => b.mySubmission.latest.reviewedAt - a.mySubmission.latest.reviewedAt)
      .slice(0, LIST_SIZE),
  };
}

// ---- The trainer's dashboard ----

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 7;
// How many recently due assignments are checked for missing work.
const RECENTLY_DUE = 25;

/** Distinct students with any recorded activity (sign-ins included) since `since`. */
async function activeLearnersSince(since) {
  const [row] = await Activity.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$user' } },
    { $count: 'n' },
  ]);
  return row?.n ?? 0;
}

async function enrollmentTotals() {
  const rows = await Enrollment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const totals = Object.fromEntries(Object.values(ENROLLMENT_STATUS).map((s) => [s, 0]));
  for (const row of rows) totals[row._id] = row.n;
  return totals;
}

async function studentsWithActiveEnrollment() {
  const [row] = await Enrollment.aggregate([
    { $match: { status: ENROLLMENT_STATUS.ACTIVE } },
    { $group: { _id: '$user' } },
    { $count: 'n' },
  ]);
  return row?.n ?? 0;
}

/** Assignments open to enrolled students due in the next week, and recently due ones still missing work. */
async function deadlines(now) {
  const open = await assignmentsOpenToEnrolledStudents();
  const fields = 'course title status dueAt latePolicy maxMarks';
  const [upcoming, recentlyDue] = await Promise.all([
    Assignment.find({
      $and: [
        open,
        { dueAt: trusted({ $gte: now, $lte: new Date(now.getTime() + UPCOMING_DAYS * DAY_MS) }) },
      ],
    })
      .sort({ dueAt: 1, _id: 1 })
      .limit(LIST_SIZE)
      .select(fields)
      .populate('course', 'title')
      .lean(),
    Assignment.find({ $and: [open, { dueAt: trusted({ $lt: now }) }] })
      .sort({ dueAt: -1, _id: 1 })
      .limit(RECENTLY_DUE)
      .select(fields)
      .populate('course', 'title')
      .lean(),
  ]);
  const stats = await assignmentStats([...upcoming, ...recentlyDue], now);
  const row = (assignment) => ({
    ...toAssignmentRow(assignment, stats.get(assignment._id.toString())),
    course: { id: assignment.course._id.toString(), title: assignment.course.title },
  });
  return {
    upcoming: upcoming.map(row),
    overdue: recentlyDue
      .map(row)
      .filter((r) => r.stats.overdue > 0)
      .slice(0, LIST_SIZE),
  };
}

async function pendingRequests() {
  const filter = { status: ENROLLMENT_STATUS.PENDING };
  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ updatedAt: -1, _id: 1 })
      .limit(LIST_SIZE)
      .populate('user', 'name email')
      .populate('course', 'title')
      .lean(),
    Enrollment.countDocuments(filter),
  ]);
  return { total, items: items.map(toEnrollmentDTO) };
}

/**
 * GET /dashboard/admin: what needs the trainer's attention, from the same
 * services as the review queue, the student list and the reports.
 * - `summary`: students, enrollments, review states of latest attempts, and
 *   overdue (student, assignment) pairs
 * - `courses`: draft and published courses with their class progress
 * - `reviewQueue`: the five attempts waiting longest for review
 * - `pendingRequests`, `upcoming` (due within 7 days) and `overdue`
 *   (recently due assignments with students missing them)
 * - `recentActivity`: the latest learning events (sign-ins left out)
 */
export async function getTrainerDashboard(now = new Date()) {
  const courses = await Course.find({ status: trusted({ $ne: CONTENT_STATUS.ARCHIVED }) })
    .sort({ title: 1, _id: 1 })
    .select('title status')
    .lean();
  const [
    totalStudents,
    newStudents,
    enrolledStudents,
    activeLearners,
    enrollments,
    reviews,
    overdue,
    summaries,
    queue,
    requests,
    dueDates,
    recentActivity,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({
      role: ROLES.STUDENT,
      createdAt: trusted({ $gte: new Date(now.getTime() - UPCOMING_DAYS * DAY_MS) }),
    }),
    studentsWithActiveEnrollment(),
    activeLearnersSince(new Date(now.getTime() - UPCOMING_DAYS * DAY_MS)),
    enrollmentTotals(),
    reviewCounts({}),
    overdueCounts({}, now),
    courseSummaries(courses, now),
    listReviewQueue({ page: 1, limit: LIST_SIZE, status: SUBMISSION_STATUS.SUBMITTED }),
    pendingRequests(),
    deadlines(now),
    listActivity(FEED_FILTER, { limit: 10 }),
  ]);

  return {
    summary: {
      students: {
        total: totalStudents,
        newThisWeek: newStudents,
        enrolled: enrolledStudents,
        activeThisWeek: activeLearners,
      },
      enrollments,
      reviews,
      overdue: {
        total: sumOverdue(overdue),
        students: sumOverdue(overdue, 'user').size,
      },
    },
    courses: summaries.map(({ distribution: _d, ...row }) => row),
    reviewQueue: queue.items,
    pendingRequests: requests,
    upcoming: dueDates.upcoming,
    overdue: dueDates.overdue,
    recentActivity,
  };
}
