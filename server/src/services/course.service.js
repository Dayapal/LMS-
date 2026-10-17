import mongoose from 'mongoose';
import {
  Activity,
  CONTENT_STATUS,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  Lesson,
  Submission,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import { escapeRegex, slugify, uniqueSlug } from '../utils/text.js';
import { getActiveEnrollment, getCourseForViewer, isAdmin, visibleTo } from './access.service.js';
import { deleteAssignmentsWhere } from './assignment.service.js';
import { deleteFilesWhere } from './file.service.js';
import { deleteMaterialsWhere } from './material.service.js';
import { assertNoProgress, completionsFor, summarizeProgress } from './progress.service.js';
import {
  toCourseDTO,
  toCourseListItem,
  toLessonDTO,
  toModuleDTO,
  toOwnEnrollment,
} from './serializers.js';

const { trusted } = mongoose;

/**
 * Module/lesson counts and total minutes per course, counting only what the
 * viewer can see (students: published lessons inside published modules).
 */
async function courseStats(user, courseIds) {
  if (courseIds.length === 0) return new Map();
  const modules = await CourseModule.find({
    course: trusted({ $in: courseIds }),
    ...visibleTo(user),
  })
    .select('_id course')
    .lean();
  const lessonTotals = await Lesson.aggregate([
    {
      $match: {
        course: { $in: courseIds },
        module: { $in: modules.map((m) => m._id) },
        ...visibleTo(user),
      },
    },
    {
      $group: {
        _id: '$course',
        lessonCount: { $sum: 1 },
        totalMinutes: { $sum: '$estimatedMinutes' },
      },
    },
  ]);

  const stats = new Map(
    courseIds.map((courseId) => [
      courseId.toString(),
      { moduleCount: 0, lessonCount: 0, totalMinutes: 0 },
    ]),
  );
  for (const module of modules) stats.get(module.course.toString()).moduleCount += 1;
  for (const total of lessonTotals) {
    Object.assign(stats.get(total._id.toString()), {
      lessonCount: total.lessonCount,
      totalMinutes: total.totalMinutes,
    });
  }
  return stats;
}

async function ownEnrollments(user, courseIds) {
  if (isAdmin(user) || courseIds.length === 0) return new Map();
  const enrollments = await Enrollment.find({
    user: user._id,
    course: trusted({ $in: courseIds }),
  }).lean();
  return new Map(enrollments.map((e) => [e.course.toString(), e]));
}

export async function listCourses(user, { page, limit, q, status, level }) {
  const filter = { ...visibleTo(user) };
  if (status && isAdmin(user)) filter.status = status;
  if (level) filter.level = level;
  if (q) filter.title = trusted({ $regex: escapeRegex(q), $options: 'i' });

  const sort = isAdmin(user) ? { updatedAt: -1 } : { createdAt: 1 };
  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select('-description')
      .sort(sort)
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const ids = courses.map((c) => c._id);
  const [stats, enrollments] = await Promise.all([
    courseStats(user, ids),
    ownEnrollments(user, ids),
  ]);

  const items = courses.map((course) =>
    toCourseListItem(course, {
      stats: stats.get(course._id.toString()),
      ...(!isAdmin(user) && {
        enrollment: toOwnEnrollment(enrollments.get(course._id.toString())),
      }),
    }),
  );
  return { items, meta: paginationMeta({ page, limit }, total) };
}

async function courseWithExtras(user, course) {
  const [stats, enrollments] = await Promise.all([
    courseStats(user, [course._id]),
    ownEnrollments(user, [course._id]),
  ]);
  return toCourseDTO(course, {
    stats: stats.get(course._id.toString()),
    ...(!isAdmin(user) && { enrollment: toOwnEnrollment(enrollments.get(course._id.toString())) }),
  });
}

export async function getCourse(user, courseId) {
  return courseWithExtras(user, await getCourseForViewer(user, courseId));
}

/** Course plus its ordered modules and lessons, filtered to what the viewer may see. */
export async function getRoadmap(user, courseId) {
  const course = await getCourseForViewer(user, courseId);
  const modules = await CourseModule.find({ course: course._id, ...visibleTo(user) })
    .sort({ order: 1 })
    .lean();
  const lessons = await Lesson.find({
    course: course._id,
    module: trusted({ $in: modules.map((m) => m._id) }),
    ...visibleTo(user),
  })
    .sort({ order: 1 })
    .lean();

  const lessonsByModule = new Map(modules.map((m) => [m._id.toString(), []]));
  for (const lesson of lessons) lessonsByModule.get(lesson.module.toString()).push(lesson);

  // An enrolled student also gets their own progress; nobody else's is ever included.
  const enrollment = isAdmin(user) ? null : await getActiveEnrollment(user._id, course._id);
  let progress = null;
  let completedAt = new Map();
  if (enrollment) {
    completedAt = await completionsFor(user, [course._id]);
    // These are exactly the countable lessons: the student sees published ones only.
    const ordered = modules.flatMap((m) =>
      lessonsByModule.get(m._id.toString()).map((lesson) => ({
        id: lesson._id.toString(),
        title: lesson.title,
        moduleId: m._id.toString(),
        moduleTitle: m.title,
      })),
    );
    progress = summarizeProgress(ordered, completedAt, enrollment.lastLesson);
  }
  const lessonDTO = (lesson) =>
    enrollment
      ? { ...toLessonDTO(lesson), completed: completedAt.has(lesson._id.toString()) }
      : toLessonDTO(lesson);

  return {
    course: await courseWithExtras(user, course),
    modules: modules.map((m) =>
      toModuleDTO(m, { lessons: lessonsByModule.get(m._id.toString()).map(lessonDTO) }),
    ),
    ...(!isAdmin(user) && { progress }),
  };
}

export async function createCourse(user, data) {
  const slug = await uniqueSlug(slugify(data.title), (s) => Course.exists({ slug: s }));
  const course = await Course.create({
    ...data,
    thumbnailUrl: data.thumbnailUrl || undefined,
    slug,
    createdBy: user._id,
  });
  return courseWithExtras(user, course);
}

export async function findCourseOr404(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

export async function updateCourse(user, courseId, data) {
  const course = await findCourseOr404(courseId);
  const { thumbnailUrl, ...rest } = data;
  course.set(rest);
  if (thumbnailUrl !== undefined) course.thumbnailUrl = thumbnailUrl || undefined;
  await course.save();
  return courseWithExtras(user, course);
}

export async function setCourseStatus(user, courseId, status) {
  const course = await findCourseOr404(courseId);
  course.status = status;
  await course.save();
  return courseWithExtras(user, course);
}

/**
 * Hard delete is only for courses nobody is learning from: not published,
 * without active or pending enrollments, submitted work or lesson progress.
 * Everything else should be archived. Its modules, lessons, materials,
 * assignments and files are deleted with it.
 */
export async function deleteCourse(courseId) {
  const course = await findCourseOr404(courseId);
  if (course.status === CONTENT_STATUS.PUBLISHED) {
    throw ApiError.conflict('Published courses cannot be deleted. Archive the course instead.');
  }
  const learners = await Enrollment.countDocuments({
    course: course._id,
    status: trusted({ $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] }),
  });
  if (learners > 0) {
    throw ApiError.conflict(
      'This course has enrolled or requesting students. Archive it instead of deleting.',
    );
  }
  if (await Submission.exists({ course: course._id })) {
    throw ApiError.conflict(
      'Students have submitted work in this course. Archive it instead of deleting.',
    );
  }
  await assertNoProgress({ course: course._id }, 'course');
  await deleteMaterialsWhere({ course: course._id });
  await deleteAssignmentsWhere({ course: course._id });
  // Also files uploaded for the course but never attached to a material or assignment.
  await deleteFilesWhere({ course: course._id });
  await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    CourseModule.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }),
    // Only enrollment events can exist here: nobody studied or handed in work.
    Activity.deleteMany({ course: course._id }),
  ]);
  await course.deleteOne();
}
