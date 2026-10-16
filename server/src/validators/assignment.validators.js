import { z } from 'zod';
import {
  CODE_LANGUAGES,
  CONTENT_STATUS,
  SUBMISSION_STATUS,
  SUBMISSION_TYPES,
} from '../models/constants.js';
import { objectId, pageQuery } from './content.validators.js';
import { submissionLink } from './links.js';

const status = z.enum(Object.values(CONTENT_STATUS));

// ISO 8601 with a time zone offset (`Z` or `+05:30`); stored as UTC.
const dateTime = z.iso
  .datetime({ offset: true, error: 'Enter a valid date and time' })
  .transform((value) => new Date(value));

const fields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  instructions: z.string().trim().max(20_000, 'Instructions must be at most 20,000 characters'),
  objectives: z
    .array(z.string().trim().min(1, 'Objectives cannot be empty').max(200))
    .max(20, 'At most 20 objectives'),
  moduleId: objectId.nullable(),
  lessonId: objectId.nullable(),
  dueAt: dateTime,
  maxMarks: z.coerce
    .number()
    .int('Use whole marks')
    .min(1, 'At least 1 mark')
    .max(1000, 'At most 1000 marks'),
  allowedSubmissionTypes: z
    .array(z.enum(Object.values(SUBMISSION_TYPES), { error: 'Unknown submission type' }))
    .min(1, 'Allow at least one way to submit')
    .transform((types) => [...new Set(types)]),
  attachmentIds: z
    .array(objectId)
    .max(10, 'At most 10 attachments')
    .transform((ids) => [...new Set(ids)]),
  latePolicy: z.object({
    allowLate: z.boolean(),
    lateUntil: dateTime.nullable().default(null),
    penaltyPercent: z.coerce
      .number()
      .int('Use a whole percentage')
      .min(0, 'Cannot be negative')
      .max(100, 'At most 100%')
      .default(0),
  }),
  maxAttempts: z.coerce
    .number()
    .int()
    .min(1, 'At least 1 attempt')
    .max(20, 'At most 20 attempts')
    .nullable(),
  status,
};

/** Cross-field rules (late cutoff after the due date) are checked by the service after merging. */
export const createAssignmentSchema = z.object({
  courseId: objectId,
  title: fields.title,
  instructions: fields.instructions.default(''),
  objectives: fields.objectives.default([]),
  moduleId: fields.moduleId.default(null),
  lessonId: fields.lessonId.default(null),
  dueAt: fields.dueAt,
  maxMarks: fields.maxMarks,
  allowedSubmissionTypes: fields.allowedSubmissionTypes,
  attachmentIds: fields.attachmentIds.default([]),
  latePolicy: fields.latePolicy.default({ allowLate: false, lateUntil: null, penaltyPercent: 0 }),
  maxAttempts: fields.maxAttempts.default(null),
  status: status.default(CONTENT_STATUS.DRAFT),
});

// The course is fixed once an assignment exists.
export const updateAssignmentSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const listAssignmentsQuery = z.object({
  ...pageQuery,
  limit: pageQuery.limit.default(50),
  course: objectId.optional(),
  module: objectId.optional(),
  lesson: objectId.optional(),
  status: status.optional(),
});

// ---- Submissions ----

const MAX_CODE_BYTES = 100 * 1024;

const linkItem = (type) => z.object({ type: z.literal(type), url: submissionLink(type) });

const submissionItem = z.discriminatedUnion(
  'type',
  [
    linkItem(SUBMISSION_TYPES.DRIVE_URL),
    linkItem(SUBMISSION_TYPES.GITHUB_URL),
    linkItem(SUBMISSION_TYPES.PROJECT_URL),
    z.object({ type: z.literal(SUBMISSION_TYPES.PDF), fileId: objectId }),
    z.object({
      type: z.literal(SUBMISSION_TYPES.CODE),
      code: z.object({
        language: z.enum(CODE_LANGUAGES, { error: 'Choose a supported language' }),
        // Not trimmed: indentation is part of the code. It is stored as text and never run.
        source: z
          .string()
          .refine((value) => value.trim().length > 0, 'Add some code')
          .refine(
            (value) => Buffer.byteLength(value, 'utf8') <= MAX_CODE_BYTES,
            'Code must be at most 100 KB',
          ),
      }),
    }),
  ],
  { error: 'Choose a submission type: drive_url, github_url, project_url, pdf or code' },
);

const submissionFields = {
  items: z
    .array(submissionItem)
    .min(1, 'Add at least one link, file or code snippet')
    .max(5, 'At most 5 items per submission'),
  note: z.string().trim().max(2000, 'The note must be at most 2000 characters'),
};

// `student`, `status`, `isLate`, `attempt` and `review` are stripped: the server sets them.
export const createSubmissionSchema = z.object({
  items: submissionFields.items,
  note: submissionFields.note.default(''),
});

export const updateSubmissionSchema = z
  .object(submissionFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const listSubmissionsQuery = z.object({
  ...pageQuery,
  limit: pageQuery.limit.default(20),
  status: z.enum(Object.values(SUBMISSION_STATUS)).optional(),
});

// ---- Reviews ----

// Up to two decimals; capped at the assignment's maxMarks by the service.
const marks = z.coerce
  .number({ error: 'Enter the marks' })
  .min(0, 'Marks cannot be negative')
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'Use at most two decimals',
  );

const feedback = z.string().trim().max(10_000, 'Feedback must be at most 10,000 characters');

export const reviewSchema = z.object({ marks, feedback: feedback.default('') });

export const resubmissionSchema = z.object({
  feedback: feedback.min(1, 'Tell the student what to change'),
  marks: marks.nullable().default(null),
});
