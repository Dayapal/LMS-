import { z } from 'zod';
import { CONTENT_STATUS, ENROLLMENT_STATUS } from '../models/constants.js';
import { REVIEW_STATES } from '../services/submissionQueries.js';
import { LEARNING_FILTERS } from '../services/student.service.js';
import { objectId, pageQuery } from './content.validators.js';

// Query strings only: anything but exactly "true" or "false" is rejected.
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

const search = z.string().trim().max(100, 'Search text is too long').optional();

// A page number past this would make MongoDB's skip fail (a 500) instead of a clear 400.
const page = z.coerce.number().int().min(1).max(10_000).default(1);

const listPage = { ...pageQuery, page, limit: pageQuery.limit.default(20) };

/** GET /admin/submissions */
export const reviewQueueQuery = z.object({
  ...listPage,
  q: search,
  course: objectId.optional(),
  assignment: objectId.optional(),
  student: objectId.optional(),
  status: z.enum(Object.values(REVIEW_STATES)).optional(),
  late: flag.optional(),
  sort: z.enum(['priority', 'oldest', 'newest']).default('priority'),
});

/** GET /admin/students */
export const listStudentsQuery = z.object({
  ...listPage,
  q: search,
  course: objectId.optional(),
  enrollment: z.enum([...Object.values(ENROLLMENT_STATUS), 'none']).optional(),
  learning: z.enum(LEARNING_FILTERS).optional(),
  sort: z.enum(['name', 'newest', 'recent']).default('name'),
});

/** GET /reports/courses */
export const courseReportsQuery = z.object({
  ...pageQuery,
  page,
  limit: pageQuery.limit.default(50),
  q: search,
  status: z.enum(Object.values(CONTENT_STATUS)).optional(),
});

/** GET /reports/courses/:id (the query pages through the course's students) */
export const courseReportQuery = z.object({
  ...listPage,
  q: search,
  enrollment: z.enum(Object.values(ENROLLMENT_STATUS)).default(ENROLLMENT_STATUS.ACTIVE),
  sort: z.enum(['name', 'progress_desc', 'progress_asc', 'recent']).default('name'),
});
