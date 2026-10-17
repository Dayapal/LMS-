import mongoose from 'mongoose';
import {
  ACTIVITY_TYPES,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  Lesson,
  LessonProgress,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getLessonForViewer, visibleTo } from './access.service.js';
import { recordActivity } from './activity.service.js';
import { courseProgress, nextLesson } from './progressRules.js';
import { toCourseSummary } from './serializers.js';

const { trusted } = mongoose;

const idOf = (value) => value.toString();

/**
 * The lessons that count towards progress, per course id, in course order:
 * what `student` sees on each roadmap (published lessons in published modules).
 */
export async function countableLessons(student, courseIds) {
  const byCourse = new Map(courseIds.map((courseId) => [idOf(courseId), []]));
  if (courseIds.length === 0) return byCourse;
  const modules = await CourseModule.find({
    course: trusted({ $in: courseIds }),
    ...visibleTo(student),
  })
    .select('_id course title order')
    .lean();
  const lessons = await Lesson.find({
    module: trusted({ $in: modules.map((m) => m._id) }),
    ...visibleTo(student),
  })
    .select('_id module title order')
    .lean();

  const moduleById = new Map(modules.map((m) => [idOf(m._id), m]));
  const ordered = lessons
    .map((lesson) => ({ lesson, module: moduleById.get(idOf(lesson.module)) }))
    .sort((a, b) => a.module.order - b.module.order || a.lesson.order - b.lesson.order);
  for (const { lesson, module } of ordered) {
    byCourse.get(idOf(module.course)).push({
      id: idOf(lesson._id),
      title: lesson.title,
      moduleId: idOf(module._id),
      moduleTitle: module.title,
    });
  }
  return byCourse;
}

/** Lesson id → completion date, for the student's records in these courses. */
export async function completionsFor(student, courseIds) {
  if (courseIds.length === 0) return new Map();
  const records = await LessonProgress.find({
    user: student._id,
    course: trusted({ $in: courseIds }),
  })
    .select('lesson completedAt')
    .lean();
  return new Map(records.map((r) => [idOf(r.lesson), r.completedAt]));
}

/** Progress numbers plus where "continue learning" leads. */
export function summarizeProgress(lessons, completedAt, lastLessonId) {
  const next = nextLesson(lessons, completedAt, lastLessonId ? idOf(lastLessonId) : null);
  return {
    ...courseProgress(lessons, completedAt),
    nextLesson: next ? { ...next.lesson, kind: next.kind } : null,
  };
}

/** One course's progress for a student with an active enrollment in it. */
export async function progressInCourse(student, courseId, enrollment) {
  const [lessons, completedAt] = await Promise.all([
    countableLessons(student, [courseId]),
    completionsFor(student, [courseId]),
  ]);
  return summarizeProgress(lessons.get(idOf(courseId)), completedAt, enrollment?.lastLesson);
}

/**
 * Remembers the lesson a student is working on, for "continue learning".
 * `enrollment` comes from the access check; the filter repeats its owner,
 * course and active status so nothing else can ever be updated.
 */
async function recordLessonVisit(enrollment, lesson) {
  const visitedAt = new Date();
  await Enrollment.updateOne(
    {
      _id: enrollment._id,
      user: enrollment.user,
      course: lesson.course,
      status: ENROLLMENT_STATUS.ACTIVE,
    },
    { $set: { lastLesson: lesson._id, lastAccessedAt: visitedAt } },
  );
  return visitedAt;
}

/**
 * POST /lessons/:id/visit: the student opened a lesson they can read, which
 * becomes their continue-learning point. Only the lesson id comes from the
 * request; reading a lesson (GET) never changes anything.
 */
export async function visitLesson(student, lessonId) {
  const { lesson, enrollment } = await getLessonForViewer(student, lessonId);
  const visitedAt = await recordLessonVisit(enrollment, lesson);
  return { lessonId: idOf(lesson._id), courseId: idOf(lesson.course), visitedAt };
}

/** Whether the student has completed `lesson`, and when. */
export async function lessonCompletion(student, lesson) {
  const record = await LessonProgress.findOne({ user: student._id, lesson: lesson._id })
    .select('completedAt')
    .lean();
  return { completed: Boolean(record), completedAt: record?.completedAt ?? null };
}

/** The lesson's completion and the course progress after a change (the lesson is now the last one visited). */
async function completionResponse(student, lesson) {
  const [completion, courseProgressNow] = await Promise.all([
    lessonCompletion(student, lesson),
    progressInCourse(student, lesson.course, { lastLesson: lesson._id }),
  ]);
  return {
    lessonId: idOf(lesson._id),
    courseId: idOf(lesson.course),
    ...completion,
    courseProgress: courseProgressNow,
  };
}

/**
 * Marks a lesson the student can open as completed. Repeating it keeps the
 * first completion date. Only the lesson id comes from the request: the
 * student, the course and the date are the server's.
 */
export async function completeLesson(student, lessonId) {
  const { lesson, enrollment } = await getLessonForViewer(student, lessonId);
  let inserted = false;
  try {
    const result = await LessonProgress.updateOne(
      { user: student._id, lesson: lesson._id },
      { $setOnInsert: { course: lesson.course, completedAt: new Date() } },
      { upsert: true },
    );
    inserted = result.upsertedCount === 1;
  } catch (error) {
    // A concurrent request inserted it first: the lesson is completed either way.
    if (error.code !== 11000) throw error;
  }
  // Logged once per completion, not on repeats.
  if (inserted) {
    await recordActivity({
      user: student._id,
      type: ACTIVITY_TYPES.LESSON_COMPLETED,
      course: lesson.course,
      lesson: lesson._id,
    });
  }
  await recordLessonVisit(enrollment, lesson);
  return completionResponse(student, lesson);
}

/** Marks a lesson the student can open as not completed. */
export async function uncompleteLesson(student, lessonId) {
  const { lesson, enrollment } = await getLessonForViewer(student, lessonId);
  await LessonProgress.deleteOne({ user: student._id, lesson: lesson._id });
  await recordLessonVisit(enrollment, lesson);
  return completionResponse(student, lesson);
}

// ---- The student's courses ----

const byRecentActivity = (a, b) =>
  (b.enrollment.lastAccessedAt?.getTime() ?? 0) - (a.enrollment.lastAccessedAt?.getTime() ?? 0) ||
  (b.enrollment.enrolledAt?.getTime() ?? 0) - (a.enrollment.enrolledAt?.getTime() ?? 0);

/**
 * The student's active and pending enrollments in published courses, with
 * progress and "continue learning" for the active ones. Most recently studied
 * first, then pending requests. Removed enrollments and courses that are no
 * longer published are left out; their progress records are kept.
 */
export async function listMyCourses(student) {
  const enrollments = await Enrollment.find({
    user: student._id,
    status: trusted({ $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] }),
  }).lean();
  const courses = await Course.find({
    _id: trusted({ $in: enrollments.map((e) => e.course) }),
    ...visibleTo(student),
  }).lean();
  const courseById = new Map(courses.map((c) => [idOf(c._id), c]));
  const visible = enrollments.filter((e) => courseById.has(idOf(e.course)));
  const activeIds = visible
    .filter((e) => e.status === ENROLLMENT_STATUS.ACTIVE)
    .map((e) => e.course);

  const [lessons, completedAt] = await Promise.all([
    countableLessons(student, activeIds),
    completionsFor(student, activeIds),
  ]);

  const items = visible.map((enrollment) => {
    const active = enrollment.status === ENROLLMENT_STATUS.ACTIVE;
    return {
      course: toCourseSummary(courseById.get(idOf(enrollment.course))),
      enrollment: {
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt ?? null,
        requestedAt: enrollment.createdAt,
        lastAccessedAt: enrollment.lastAccessedAt ?? null,
      },
      progress: active
        ? summarizeProgress(
            lessons.get(idOf(enrollment.course)),
            completedAt,
            enrollment.lastLesson,
          )
        : null,
    };
  });
  const active = items.filter((item) => item.progress).sort(byRecentActivity);
  const pending = items
    .filter((item) => !item.progress)
    .sort((a, b) => b.enrollment.requestedAt - a.enrollment.requestedAt);
  return [...active, ...pending];
}

// ---- Deletion guards ----

/** Refuses to delete content that students have completed lessons in. */
export async function assertNoProgress(filter, label) {
  if (await LessonProgress.exists(filter)) {
    throw ApiError.conflict(
      label === 'lesson'
        ? 'Students have completed this lesson. Archive it instead of deleting, so their progress is kept.'
        : `Students have completed lessons in this ${label}. Archive it instead of deleting, so their progress is kept.`,
    );
  }
}
