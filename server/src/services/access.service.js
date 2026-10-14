import {
  CONTENT_STATUS,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  FILE_PURPOSES,
  FileAsset,
  Lesson,
  Material,
  MATERIAL_TYPES,
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
 * The lesson with its module and course when `user` may open it, otherwise null.
 * Students need the lesson, module and course published and an active
 * enrollment in the course.
 */
async function findLessonForViewer(user, lessonId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return null;
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
  return visible ? { lesson, module, course, enrollment } : null;
}

/** Lesson content (the lesson, its materials and navigation) for `user`, or 404. */
export async function getLessonForViewer(user, lessonId) {
  const found = await findLessonForViewer(user, lessonId);
  if (!found) throw ApiError.notFound('Lesson not found');
  return found;
}

/**
 * A stored file and whether `user` may download it, or 404.
 * Material files follow their material: a student needs at least one published
 * file material that uses it, inside a lesson they can open. The file is
 * downloadable when any of those materials allows it. Files of other purposes
 * arrive in later phases and stay admin-only until then.
 */
export async function getFileForViewer(user, fileId) {
  const file = await FileAsset.findById(fileId);
  if (!file) throw ApiError.notFound('File not found');
  if (isAdmin(user)) return { file, downloadable: true };

  if (file.purpose === FILE_PURPOSES.MATERIAL) {
    const materials = await Material.find({
      file: file._id,
      type: MATERIAL_TYPES.FILE,
      status: CONTENT_STATUS.PUBLISHED,
    })
      .select('lesson downloadable')
      .lean();
    let visible = false;
    let downloadable = false;
    for (const material of materials) {
      if (!(await findLessonForViewer(user, material.lesson))) continue;
      visible = true;
      downloadable ||= Boolean(material.downloadable);
    }
    if (visible) return { file, downloadable };
  }
  throw ApiError.notFound('File not found');
}
