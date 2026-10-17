import mongoose from 'mongoose';
import {
  Assignment,
  Course,
  Enrollment,
  ENROLLMENT_STATUS,
  ROLES,
  Submission,
  SUBMISSION_STATUS,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import { listActivity } from './activity.service.js';
import {
  completedCounts,
  lessonsByCourse,
  overdueCounts,
  progressOf,
  reviewCounts,
  sumOverdue,
  toObjectId,
} from './analytics.service.js';
import { countStates, myAssignmentRows } from './assignment.service.js';
import { completionsFor } from './progress.service.js';
import { isCourseComplete, progressPercent } from './progressRules.js';
import { containsText } from './review.service.js';
import { latestAttemptStages } from './submissionQueries.js';
import { closesAt } from './submissionRules.js';

const { trusted } = mongoose;

const idOf = (value) => value.toString();

/** Learning states the student list can filter on (spec §7 "filter"). */
export const LEARNING_FILTERS = Object.freeze([
  'to_review',
  'overdue',
  'not_started',
  'in_progress',
  'completed',
]);

export async function findStudentOr404(studentId) {
  const student = await User.findOne({ _id: studentId, role: ROLES.STUDENT });
  if (!student) throw ApiError.notFound('Student not found');
  return student;
}

const toProfile = (student) => ({
  id: idOf(student._id),
  name: student.name,
  email: student.email,
  bio: student.bio ?? '',
  avatarUrl: student.avatarUrl ?? null,
  isActive: student.isActive !== false,
  createdAt: student.createdAt,
  lastLoginAt: student.lastLoginAt ?? null,
});

// ---- Filters ----

/** Students whose latest attempt at some assignment (in `course`) is waiting for review. */
async function studentsAwaitingReview(course) {
  const rows = await Submission.aggregate([
    ...latestAttemptStages(course ? { course: toObjectId(course) } : {}),
    { $match: { 'latest.status': SUBMISSION_STATUS.SUBMITTED } },
    { $group: { _id: '$_id.student' } },
  ]);
  return rows.map((row) => row._id);
}

/** Students with an active enrollment (in `course`) whose progress is in the given state. */
async function studentsByProgress(state, course) {
  const match = { status: ENROLLMENT_STATUS.ACTIVE, ...(course && { course }) };
  const courseIds = await Enrollment.distinct('course', match);
  if (courseIds.length === 0) return [];
  const lessons = await lessonsByCourse(courseIds);
  const [enrollments, counts] = await Promise.all([
    Enrollment.find({ ...match, course: trusted({ $in: courseIds }) })
      .select('user course')
      .lean(),
    completedCounts(lessons),
  ]);
  const ids = new Set();
  for (const { user, course: courseId } of enrollments) {
    const progress = progressOf(counts, lessons, user, courseId);
    const inState =
      state === 'completed'
        ? progress.completed
        : state === 'not_started'
          ? progress.totalLessons > 0 && progress.completedLessons === 0
          : progress.completedLessons > 0 && !progress.completed;
    if (inState) ids.add(idOf(user));
  }
  return [...ids];
}

async function studentIdsInLearningState(learning, course, now) {
  if (learning === 'to_review') return studentsAwaitingReview(course);
  if (learning === 'overdue') {
    const overdue = await overdueCounts({ courseIds: course ? [course] : undefined }, now);
    return [...sumOverdue(overdue, 'user').keys()];
  }
  return studentsByProgress(learning, course);
}

const SORTS = {
  name: { name: 1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  recent: { lastLoginAt: -1, _id: 1 },
};

/** Per-student enrollments, progress, review and overdue counts for a page of students. */
async function studentRows(students, now) {
  const ids = students.map((s) => s._id);
  const enrollments = await Enrollment.find({ user: trusted({ $in: ids }) })
    .populate('course', 'title status')
    .sort({ updatedAt: -1 })
    .lean();
  const courseIds = [...new Set(enrollments.map((e) => idOf(e.course?._id ?? e.course)))];
  const lessons = await lessonsByCourse(courseIds);
  const [counts, reviews, overdue] = await Promise.all([
    completedCounts(lessons, { userIds: ids }),
    reviewCounts({ student: { $in: ids } }, 'student'),
    overdueCounts({ userIds: ids }, now),
  ]);
  const overdueByStudent = sumOverdue(overdue, 'user');

  return students.map((student) => {
    const key = idOf(student._id);
    const own = enrollments.filter((e) => idOf(e.user) === key && e.course);
    const tally = Object.fromEntries(Object.values(ENROLLMENT_STATUS).map((s) => [s, 0]));
    for (const e of own) tally[e.status] += 1;
    const lastAccessedAt = own.reduce(
      (latest, e) =>
        e.lastAccessedAt && (!latest || e.lastAccessedAt > latest) ? e.lastAccessedAt : latest,
      null,
    );
    return {
      ...toProfile(student),
      lastAccessedAt,
      enrollments: tally,
      courses: own.map((e) => ({
        id: idOf(e.course._id),
        title: e.course.title,
        status: e.course.status,
        enrollmentStatus: e.status,
        progress:
          e.status === ENROLLMENT_STATUS.PENDING
            ? null
            : progressOf(counts, lessons, student._id, e.course._id),
      })),
      awaitingReview: reviews.get(key)?.submitted ?? 0,
      overdue: overdueByStudent.get(key) ?? 0,
    };
  });
}

/**
 * GET /admin/students. Search by name or email; filter by a course, by
 * enrollment status in it (`none` = no enrollment at all), and by a learning
 * state (see LEARNING_FILTERS). Paginated.
 */
export async function listStudents({ page, limit, q, course, enrollment, learning, sort }) {
  const now = new Date();
  const conditions = [{ role: ROLES.STUDENT }];
  if (q) conditions.push({ $or: [{ name: containsText(q) }, { email: containsText(q) }] });
  if (enrollment === 'none') {
    const enrolled = await Enrollment.distinct('user', course ? { course } : {});
    conditions.push({ _id: trusted({ $nin: enrolled }) });
  } else if (enrollment || course) {
    const ids = await Enrollment.distinct('user', {
      ...(course && { course }),
      ...(enrollment && { status: enrollment }),
    });
    conditions.push({ _id: trusted({ $in: ids }) });
  }
  if (learning) {
    conditions.push({
      _id: trusted({ $in: await studentIdsInLearningState(learning, course, now) }),
    });
  }

  const filter = { $and: conditions };
  const [students, total] = await Promise.all([
    User.find(filter)
      .sort(SORTS[sort] ?? SORTS.name)
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return {
    items: await studentRows(students, now),
    meta: paginationMeta({ page, limit }, total),
  };
}

// ---- One student ----

/** Every enrollment of the student, newest change first, with the course (null if deleted). */
const enrollmentsOf = (student) =>
  Enrollment.find({ user: student._id })
    .populate('course', 'title status')
    .sort({ updatedAt: -1 })
    .lean();

/**
 * GET /admin/students/:id: the profile and every enrollment, including
 * removed ones and archived courses (their history is kept), with progress,
 * open reviews and overdue work per course. `summary.assignments` counts the
 * states the student sees on their own pages.
 */
export async function getStudentDetail(studentId) {
  const now = new Date();
  const student = await findStudentOr404(studentId);
  const enrollments = (await enrollmentsOf(student)).filter((e) => e.course);
  const courseIds = enrollments.map((e) => e.course._id);
  const lessons = await lessonsByCourse(courseIds);
  const [counts, reviews, overdue, assignmentRows] = await Promise.all([
    completedCounts(lessons, { userIds: [student._id] }),
    reviewCounts({ student: student._id }, 'course'),
    overdueCounts({ userIds: [student._id] }, now),
    myAssignmentRows(student, {}, now),
  ]);

  const items = enrollments.map((e) => {
    const courseKey = idOf(e.course._id);
    return {
      id: idOf(e._id),
      status: e.status,
      requestedAt: e.createdAt,
      enrolledAt: e.enrolledAt ?? null,
      updatedAt: e.updatedAt,
      lastAccessedAt: e.lastAccessedAt ?? null,
      course: { id: courseKey, title: e.course.title, status: e.course.status },
      progress:
        e.status === ENROLLMENT_STATUS.PENDING
          ? null
          : progressOf(counts, lessons, student._id, e.course._id),
      awaitingReview: reviews.get(courseKey)?.submitted ?? 0,
      overdue: [...overdue.values()].find((row) => idOf(row.course) === courseKey)?.overdue ?? 0,
    };
  });
  const active = items.filter((item) => item.status === ENROLLMENT_STATUS.ACTIVE);
  return {
    student: toProfile(student),
    summary: {
      activeCourses: active.length,
      pendingRequests: items.filter((i) => i.status === ENROLLMENT_STATUS.PENDING).length,
      removedCourses: items.filter((i) => i.status === ENROLLMENT_STATUS.REMOVED).length,
      completedCourses: active.filter((i) => i.progress.completed).length,
      lessonsCompleted: active.reduce((sum, i) => sum + i.progress.completedLessons, 0),
      awaitingReview: items.reduce((sum, i) => sum + i.awaitingReview, 0),
      assignments: countStates(assignmentRows),
    },
    enrollments: items,
  };
}

/** Per module: completed countable lessons of the student. */
function moduleBreakdown(lessons, completedAt) {
  const modules = new Map();
  for (const lesson of lessons) {
    if (!modules.has(lesson.moduleId)) {
      modules.set(lesson.moduleId, {
        id: lesson.moduleId,
        title: lesson.moduleTitle,
        completedLessons: 0,
        totalLessons: 0,
      });
    }
    const row = modules.get(lesson.moduleId);
    row.totalLessons += 1;
    if (completedAt.has(lesson.id)) row.completedLessons += 1;
  }
  return [...modules.values()].map((row) => ({
    ...row,
    percent: progressPercent(row.completedLessons, row.totalLessons),
  }));
}

/** The student's latest attempt at every assignment they ever handed in, newest first. */
async function submissionHistory(student) {
  const rows = await Submission.aggregate([
    ...latestAttemptStages({ student: student._id }),
    { $sort: { 'latest.submittedAt': -1, '_id.assignment': 1 } },
    {
      $lookup: {
        from: Assignment.collection.name,
        localField: '_id.assignment',
        foreignField: '_id',
        pipeline: [{ $project: { title: 1, status: 1, dueAt: 1, maxMarks: 1, latePolicy: 1 } }],
        as: 'assignment',
      },
    },
    {
      $lookup: {
        from: Course.collection.name,
        localField: 'latest.course',
        foreignField: '_id',
        pipeline: [{ $project: { title: 1, status: 1 } }],
        as: 'course',
      },
    },
  ]);
  return rows.map(({ latest, attempts, assignment: [assignment], course: [course] }) => ({
    id: idOf(latest._id),
    attempt: latest.attempt,
    attempts,
    status: latest.status,
    isLate: Boolean(latest.isLate),
    submittedAt: latest.submittedAt,
    review: latest.review
      ? {
          marks: latest.review.marks ?? null,
          finalMarks: latest.review.finalMarks ?? null,
          reviewedAt: latest.review.reviewedAt ?? null,
        }
      : null,
    assignment: assignment
      ? {
          id: idOf(assignment._id),
          title: assignment.title,
          status: assignment.status,
          dueAt: assignment.dueAt,
          closesAt: closesAt(assignment),
          maxMarks: assignment.maxMarks,
        }
      : null,
    course: course ? { id: idOf(course._id), title: course.title, status: course.status } : null,
  }));
}

/**
 * Average of the reviewed latest attempts' final marks as a percentage of
 * their maximum, rounded down; null before anything is reviewed.
 */
function marksSummary(submissions) {
  const reviewed = submissions.filter(
    (s) => s.status === SUBMISSION_STATUS.REVIEWED && s.review?.finalMarks != null && s.assignment,
  );
  if (reviewed.length === 0) return { reviewed: 0, averagePercent: null };
  const total = reviewed.reduce(
    (sum, s) => sum + (s.review.finalMarks * 100) / s.assignment.maxMarks,
    0,
  );
  return { reviewed: reviewed.length, averagePercent: Math.floor(total / reviewed.length) };
}

/**
 * GET /reports/students/:id: the student's learning report. Progress per
 * course (enrolled or removed, so history stays visible) with a breakdown by
 * module; the assignments they can see now with their derived state; their
 * latest attempt at every assignment they handed in; and their recent activity.
 */
export async function getStudentReport(studentId) {
  const now = new Date();
  const student = await findStudentOr404(studentId);
  const enrollments = (await enrollmentsOf(student)).filter(
    (e) => e.course && e.status !== ENROLLMENT_STATUS.PENDING,
  );
  const courseIds = enrollments.map((e) => e.course._id);
  const [lessons, completedAt, assignmentRows, submissions, activity] = await Promise.all([
    lessonsByCourse(courseIds),
    completionsFor(student, courseIds),
    myAssignmentRows(student, {}, now),
    submissionHistory(student),
    listActivity({ user: student._id }, { limit: 20 }),
  ]);

  const courses = enrollments.map((e) => {
    const courseLessons = lessons.get(idOf(e.course._id)) ?? [];
    const modules = moduleBreakdown(courseLessons, completedAt);
    const completedLessons = modules.reduce((sum, m) => sum + m.completedLessons, 0);
    return {
      course: { id: idOf(e.course._id), title: e.course.title, status: e.course.status },
      enrollmentStatus: e.status,
      progress: {
        completedLessons,
        totalLessons: courseLessons.length,
        percent: progressPercent(completedLessons, courseLessons.length),
        completed: isCourseComplete(completedLessons, courseLessons.length),
      },
      modules,
    };
  });

  return {
    student: { id: idOf(student._id), name: student.name, email: student.email },
    courses,
    assignments: {
      counts: countStates(assignmentRows),
      items: assignmentRows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        dueAt: row.dueAt,
        closesAt: row.closesAt,
        maxMarks: row.maxMarks,
        course: row.course,
        state: row.mySubmission.status,
        attempts: row.mySubmission.attempts,
        latest: row.mySubmission.latest,
      })),
    },
    submissions,
    marks: marksSummary(submissions),
    activity,
  };
}
