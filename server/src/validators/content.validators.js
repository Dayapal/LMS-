import { z } from 'zod';
import { CONTENT_STATUS, COURSE_LEVELS, ENROLLMENT_STATUS } from '../models/constants.js';
import { email, httpsUrl } from './common.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParams = z.object({ id: objectId });

const status = z.enum(Object.values(CONTENT_STATUS));
const title = (max) => z.string().trim().min(3, 'Title must be at least 3 characters').max(max);
const shortList = (label) =>
  z
    .array(z.string().trim().min(1, `${label} cannot be empty`).max(200))
    .max(20, `At most 20 ${label.toLowerCase()} items`);

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
};

// ---- Courses ----

const courseFields = {
  title: title(120),
  summary: z.string().trim().max(300, 'Summary must be at most 300 characters'),
  description: z.string().trim().max(10_000, 'Description is too long'),
  thumbnailUrl: z.union([httpsUrl, z.literal('')]),
  level: z.enum(COURSE_LEVELS),
  estimatedHours: z.coerce.number().min(0).max(2000),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(10, 'At most 10 tags')
    .transform((tags) => [...new Set(tags)]),
};

export const createCourseSchema = z.object({
  ...courseFields,
  summary: courseFields.summary.default(''),
  description: courseFields.description.default(''),
  thumbnailUrl: courseFields.thumbnailUrl.optional(),
  level: courseFields.level.default('beginner'),
  estimatedHours: courseFields.estimatedHours.default(0),
  tags: courseFields.tags.default([]),
});

export const updateCourseSchema = z
  .object(courseFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const courseStatusSchema = z.object({ status });

export const listCoursesQuery = z.object({
  ...pageQuery,
  q: z.string().trim().max(100).optional(),
  status: status.optional(),
  level: z.enum(COURSE_LEVELS).optional(),
});

// ---- Modules ----

export const createModuleSchema = z.object({
  title: title(120),
  description: z.string().trim().max(1000).default(''),
  status: status.default(CONTENT_STATUS.DRAFT),
});

export const updateModuleSchema = z
  .object({
    title: title(120),
    description: z.string().trim().max(1000),
    status,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

// ---- Lessons ----

const lessonFields = {
  title: title(140),
  summary: z.string().trim().max(300, 'Summary must be at most 300 characters'),
  objectives: shortList('Objectives'),
  prerequisites: shortList('Prerequisites'),
  estimatedMinutes: z.coerce.number().int().min(0).max(1440),
  status,
};

export const createLessonSchema = z.object({
  title: lessonFields.title,
  summary: lessonFields.summary.default(''),
  objectives: lessonFields.objectives.default([]),
  prerequisites: lessonFields.prerequisites.default([]),
  estimatedMinutes: lessonFields.estimatedMinutes.default(0),
  status: lessonFields.status.default(CONTENT_STATUS.DRAFT),
});

export const updateLessonSchema = z
  .object({ ...lessonFields, moduleId: objectId })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

// ---- Ordering ----

export const reorderSchema = z.object({
  ids: z
    .array(objectId)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Ids must be unique'),
});

// ---- Enrollments ----

export const listEnrollmentsQuery = z.object({
  ...pageQuery,
  limit: pageQuery.limit.default(20),
  course: objectId.optional(),
  status: z.enum(Object.values(ENROLLMENT_STATUS)).optional(),
});

export const adminEnrollSchema = z.object({ courseId: objectId, email });

export const updateEnrollmentSchema = z.object({
  status: z.enum([ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.REMOVED]),
});
