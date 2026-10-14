import { CONTENT_STATUS, CourseModule, Lesson } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify, uniqueSlug } from '../utils/text.js';
import {
  getCourseForViewer,
  getLessonForViewer,
  getModuleForViewer,
  visibleTo,
} from './access.service.js';
import { findCourseOr404 } from './course.service.js';
import { applyOrder, nextOrder } from './ordering.js';
import { toLessonDTO, toModuleDTO } from './serializers.js';

// Phases 4-5 extend these guards with assignment, submission and progress checks.
function assertNotPublished(doc, label) {
  if (doc.status === CONTENT_STATUS.PUBLISHED) {
    throw ApiError.conflict(
      `Published ${label}s cannot be deleted. Move it back to draft or archive it first.`,
    );
  }
}

// ---- Modules ----

async function findModuleOr404(moduleId) {
  const module = await CourseModule.findById(moduleId);
  if (!module) throw ApiError.notFound('Module not found');
  return module;
}

export async function listModules(user, courseId) {
  const course = await getCourseForViewer(user, courseId);
  const modules = await CourseModule.find({ course: course._id, ...visibleTo(user) }).sort({
    order: 1,
  });
  return modules.map((m) => toModuleDTO(m));
}

export async function createModule(courseId, data) {
  const course = await findCourseOr404(courseId);
  const module = await CourseModule.create({
    ...data,
    course: course._id,
    order: await nextOrder(CourseModule, { course: course._id }),
  });
  return toModuleDTO(module);
}

export async function updateModule(moduleId, data) {
  const module = await findModuleOr404(moduleId);
  module.set(data);
  await module.save();
  return toModuleDTO(module);
}

export async function reorderModules(courseId, ids) {
  const course = await findCourseOr404(courseId);
  await applyOrder(CourseModule, { course: course._id }, ids, 'module of this course');
  const modules = await CourseModule.find({ course: course._id }).sort({ order: 1 });
  return modules.map((m) => toModuleDTO(m));
}

/** Deletes an unpublished module together with its lessons, none of which may be published. */
export async function deleteModule(moduleId) {
  const module = await findModuleOr404(moduleId);
  assertNotPublished(module, 'module');
  const publishedLessons = await Lesson.countDocuments({
    module: module._id,
    status: CONTENT_STATUS.PUBLISHED,
  });
  if (publishedLessons > 0) {
    throw ApiError.conflict(
      'This module still has published lessons. Unpublish or archive them before deleting it.',
    );
  }
  await Lesson.deleteMany({ module: module._id });
  await module.deleteOne();
}

// ---- Lessons ----

async function findLessonOr404(lessonId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  return lesson;
}

export async function listLessons(user, moduleId) {
  const { module } = await getModuleForViewer(user, moduleId);
  const lessons = await Lesson.find({ module: module._id, ...visibleTo(user) }).sort({ order: 1 });
  return lessons.map(toLessonDTO);
}

export async function getLesson(user, lessonId) {
  const { lesson, module, course } = await getLessonForViewer(user, lessonId);
  return {
    ...toLessonDTO(lesson),
    module: { id: module._id.toString(), title: module.title },
    course: { id: course._id.toString(), title: course.title },
  };
}

const lessonSlug = (courseId, title) =>
  uniqueSlug(slugify(title), (slug) => Lesson.exists({ course: courseId, slug }));

export async function createLesson(moduleId, data) {
  const module = await findModuleOr404(moduleId);
  const lesson = await Lesson.create({
    ...data,
    course: module.course,
    module: module._id,
    slug: await lessonSlug(module.course, data.title),
    order: await nextOrder(Lesson, { module: module._id }),
  });
  return toLessonDTO(lesson);
}

/** Updates fields; `moduleId` moves the lesson to the end of another module in the same course. */
export async function updateLesson(lessonId, { moduleId, ...data }) {
  const lesson = await findLessonOr404(lessonId);
  if (moduleId && moduleId !== lesson.module.toString()) {
    const target = await CourseModule.findById(moduleId);
    if (!target || !target.course.equals(lesson.course)) {
      throw ApiError.validation([
        { path: 'moduleId', message: 'Choose a module from the same course' },
      ]);
    }
    lesson.module = target._id;
    lesson.order = await nextOrder(Lesson, { module: target._id });
  }
  lesson.set(data);
  await lesson.save();
  return toLessonDTO(lesson);
}

export async function reorderLessons(moduleId, ids) {
  const module = await findModuleOr404(moduleId);
  await applyOrder(Lesson, { module: module._id }, ids, 'lesson of this module');
  const lessons = await Lesson.find({ module: module._id }).sort({ order: 1 });
  return lessons.map(toLessonDTO);
}

export async function deleteLesson(lessonId) {
  const lesson = await findLessonOr404(lessonId);
  assertNotPublished(lesson, 'lesson');
  await lesson.deleteOne();
}
