import {
  CONTENT_STATUS,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  Lesson,
  ROLES,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Single source of truth for who may see which course content.
 * Students get 404 (never 403) for anything unpublished or outside their
 * enrollment, so responses don't reveal what exists.
 */

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

const isPublished = (doc) => doc?.status === CONTENT_STATUS.PUBLISHED;

/** Mongo filter limiting content documents to what `user` may list. */
export const visibleTo = (user) => (isAdmin(user) ? {} : { status: CONTENT_STATUS.PUBLISHED });

export async function getCourseForViewer(user, courseId, notFound = 'Course not found') {
  const course = await Course.findById(courseId);
  if (!course || (!isAdmin(user) && !isPublished(course))) throw ApiError.notFound(notFound);
  return course;
}

export async function getModuleForViewer(user, moduleId) {
  const module = await CourseModule.findById(moduleId);
  if (!module || (!isAdmin(user) && !isPublished(module))) {
    throw ApiError.notFound('Module not found');
  }
  const course = await getCourseForViewer(user, module.course, 'Module not found');
  return { module, course };
}

export async function getActiveEnrollment(userId, courseId) {
  return Enrollment.findOne({ user: userId, course: courseId, status: ENROLLMENT_STATUS.ACTIVE });
}

/**
 * Lesson content requires, for students: published lesson, module and course,
 * and an active enrollment in the course.
 */
export async function getLessonForViewer(user, lessonId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  if (isAdmin(user)) {
    const [module, course] = await Promise.all([
      CourseModule.findById(lesson.module),
      Course.findById(lesson.course),
    ]);
    return { lesson, module, course };
  }

  const [module, course, enrollment] = await Promise.all([
    CourseModule.findById(lesson.module),
    Course.findById(lesson.course),
    getActiveEnrollment(user._id, lesson.course),
  ]);
  const visible =
    isPublished(lesson) && isPublished(module) && isPublished(course) && Boolean(enrollment);
  if (!visible) throw ApiError.notFound('Lesson not found');
  return { lesson, module, course, enrollment };
}
