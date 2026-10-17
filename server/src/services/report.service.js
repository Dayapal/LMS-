import mongoose from 'mongoose';
import {
  Assignment,
  Course,
  Enrollment,
  ENROLLMENT_STATUS,
  LessonProgress,
  User,
} from '../models/index.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import {
  assignmentStats,
  courseSummaries,
  lessonsByCourse,
  overdueCounts,
  reviewCounts,
  sumOverdue,
  toAssignmentRow,
} from './analytics.service.js';
import { findCourseOr404 } from './course.service.js';
import { isCourseComplete, progressPercent } from './progressRules.js';
import { containsText, studentIdsMatching } from './review.service.js';
import { toReviewCounts } from './submissionQueries.js';

const { ObjectId } = mongoose.Types;

const idOf = (value) => value.toString();

const sumBy = (items, pick) => items.reduce((sum, item) => sum + pick(item), 0);

/** Totals over a list of course summaries. Enrollments are counted per course, so a student in two courses counts twice. */
function totalsOf(summaries) {
  return {
    courses: summaries.length,
    enrollments: {
      active: sumBy(summaries, (s) => s.enrollments.active),
      pending: sumBy(summaries, (s) => s.enrollments.pending),
      removed: sumBy(summaries, (s) => s.enrollments.removed),
    },
    completedEnrollments: sumBy(summaries, (s) => s.progress.completedStudents),
    publishedAssignments: sumBy(summaries, (s) => s.assignments.published),
    reviews: {
      submitted: sumBy(summaries, (s) => s.reviews.submitted),
      resubmitted: sumBy(summaries, (s) => s.reviews.resubmitted),
      resubmit_requested: sumBy(summaries, (s) => s.reviews.resubmit_requested),
      reviewed: sumBy(summaries, (s) => s.reviews.reviewed),
    },
    overdue: sumBy(summaries, (s) => s.overdue),
  };
}

/**
 * GET /reports/courses: one summary row per course (title order), filtered
 * by status and title. `meta.totals` adds up the rows on this page.
 */
export async function listCourseReports({ page, limit, q, status }) {
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.title = containsText(q);
  const [courses, total] = await Promise.all([
    Course.find(filter)
      .sort({ title: 1, _id: 1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .select('title status')
      .lean(),
    Course.countDocuments(filter),
  ]);
  const items = (await courseSummaries(courses)).map(({ distribution: _d, ...row }) => row);
  return { items, meta: { ...paginationMeta({ page, limit }, total), totals: totalsOf(items) } };
}

/** Per module: how much of it the active students have completed, on average. */
async function moduleCompletion(course, courseLessons, activeStudents) {
  const modules = new Map();
  for (const lesson of courseLessons) {
    if (!modules.has(lesson.moduleId)) {
      modules.set(lesson.moduleId, { id: lesson.moduleId, title: lesson.moduleTitle, lessons: [] });
    }
    modules.get(lesson.moduleId).lessons.push(lesson.id);
  }
  let completionsByLesson = new Map();
  if (courseLessons.length > 0 && activeStudents > 0) {
    const rows = await LessonProgress.aggregate([
      {
        $match: {
          course: course._id,
          lesson: { $in: courseLessons.map((l) => new ObjectId(l.id)) },
        },
      },
      {
        $lookup: {
          from: Enrollment.collection.name,
          localField: 'user',
          foreignField: 'user',
          let: { course: '$course' },
          pipeline: [
            {
              $match: { status: ENROLLMENT_STATUS.ACTIVE, $expr: { $eq: ['$course', '$$course'] } },
            },
            { $project: { _id: 1 } },
          ],
          as: 'enrollment',
        },
      },
      { $match: { 'enrollment.0': { $exists: true } } },
      { $group: { _id: '$lesson', completions: { $sum: 1 } } },
    ]);
    completionsByLesson = new Map(rows.map((row) => [idOf(row._id), row.completions]));
  }
  return [...modules.values()].map(({ id, title, lessons }) => {
    const completions = sumBy(lessons, (lessonId) => completionsByLesson.get(lessonId) ?? 0);
    return {
      id,
      title,
      lessons: lessons.length,
      completions,
      // Lessons completed ÷ lessons × active students, rounded down.
      percent: activeStudents
        ? progressPercent(completions, lessons.length * activeStudents)
        : null,
    };
  });
}

const STUDENT_SORTS = {
  name: { 'student.name': 1, _id: 1 },
  progress_desc: { completed: -1, 'student.name': 1, _id: 1 },
  progress_asc: { completed: 1, 'student.name': 1, _id: 1 },
  recent: { lastAccessedAt: -1, 'student.name': 1, _id: 1 },
};

/** The course's enrollments with `status`, each with the student's progress; sorted and paginated in the database. */
async function courseStudents(course, courseLessons, { page, limit, q, enrollment, sort }) {
  const match = { course: course._id, status: enrollment };
  if (q) match.user = { $in: await studentIdsMatching(q) };
  const lessonIds = courseLessons.map((l) => new ObjectId(l.id));
  const [result] = await Enrollment.aggregate([
    { $match: match },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'user',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, email: 1, lastLoginAt: 1 } }],
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $lookup: {
        from: LessonProgress.collection.name,
        localField: 'user',
        foreignField: 'user',
        let: { course: '$course' },
        pipeline: [
          { $match: { lesson: { $in: lessonIds }, $expr: { $eq: ['$course', '$$course'] } } },
          { $group: { _id: null, n: { $sum: 1 }, last: { $max: '$completedAt' } } },
        ],
        as: 'done',
      },
    },
    {
      $addFields: {
        completed: { $ifNull: [{ $first: '$done.n' }, 0] },
        lastCompletedAt: { $ifNull: [{ $first: '$done.last' }, null] },
      },
    },
    { $sort: STUDENT_SORTS[sort] ?? STUDENT_SORTS.name },
    {
      $facet: {
        items: [{ $skip: skipFor({ page, limit }) }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const rows = result.items;
  const ids = rows.map((row) => row.user);
  const [reviews, overdue] = await Promise.all([
    reviewCounts({ course: course._id, student: { $in: ids } }, 'student'),
    overdueCounts({ userIds: ids, courseIds: [course._id] }),
  ]);
  const overdueByStudent = sumOverdue(overdue, 'user');
  const totalLessons = courseLessons.length;
  return {
    items: rows.map((row) => ({
      enrollmentId: idOf(row._id),
      status: row.status,
      requestedAt: row.createdAt,
      enrolledAt: row.enrolledAt ?? null,
      lastAccessedAt: row.lastAccessedAt ?? null,
      student: {
        id: idOf(row.student._id),
        name: row.student.name,
        email: row.student.email,
        lastLoginAt: row.student.lastLoginAt ?? null,
      },
      progress:
        row.status === ENROLLMENT_STATUS.PENDING
          ? null
          : {
              completedLessons: row.completed,
              totalLessons,
              percent: progressPercent(row.completed, totalLessons),
              completed: isCourseComplete(row.completed, totalLessons),
              lastCompletedAt: row.lastCompletedAt,
            },
      reviews: reviews.get(idOf(row.user)) ?? toReviewCounts(),
      overdue: overdueByStudent.get(idOf(row.user)) ?? 0,
    })),
    meta: paginationMeta({ page, limit }, result.total[0]?.count ?? 0),
  };
}

/**
 * GET /reports/courses/:id: the course summary, the progress distribution of
 * its active students, completion per module, every assignment with its
 * submission and review statistics, and a page of its students (active by
 * default; `enrollment` picks pending or removed ones instead). `meta` is the
 * pagination of the student list.
 */
export async function getCourseReport(courseId, query) {
  const now = new Date();
  const course = await findCourseOr404(courseId);
  const lessons = await lessonsByCourse([course._id]);
  const courseLessons = lessons.get(idOf(course._id)) ?? [];
  const assignments = await Assignment.find({ course: course._id })
    .sort({ dueAt: 1, createdAt: 1 })
    .select('course title status dueAt latePolicy maxMarks')
    .lean();
  const [[summary], modules, stats, students] = await Promise.all([
    courseSummaries([course], now),
    // The active count comes from the summary; fetched in parallel with the same rule.
    Enrollment.countDocuments({ course: course._id, status: ENROLLMENT_STATUS.ACTIVE }).then(
      (active) => moduleCompletion(course, courseLessons, active),
    ),
    assignmentStats(assignments, now),
    courseStudents(course, courseLessons, query),
  ]);
  const { distribution, ...rest } = summary;
  return {
    data: {
      course: { ...rest, modules: modules.length },
      distribution,
      modules,
      assignments: assignments.map((a) => toAssignmentRow(a, stats.get(idOf(a._id)))),
      students: students.items,
    },
    meta: students.meta,
  };
}
