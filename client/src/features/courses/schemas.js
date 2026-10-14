import { z } from 'zod';
import { linesToList } from './format.js';

// Mirrors server/src/validators/content.validators.js.
const title = (max) =>
  z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(max, `Title must be at most ${max} characters`);

const optionalHttpsUrl = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https$/, error: 'Must be a valid https:// URL' })),
]);

const status = z.enum(['draft', 'published', 'archived']);

export const courseFormSchema = z.object({
  title: title(120),
  summary: z.string().trim().max(300, 'Summary must be at most 300 characters'),
  description: z.string().trim().max(10_000, 'Description is too long'),
  thumbnailUrl: optionalHttpsUrl,
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedHours: z.coerce
    .number({ error: 'Enter a number' })
    .min(0, 'Cannot be negative')
    .max(2000, 'At most 2000 hours'),
  tags: z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ])
    .pipe(
      z
        .array(z.string().max(30, 'Each tag must be at most 30 characters'))
        .max(10, 'At most 10 tags'),
    ),
});

export const moduleFormSchema = z.object({
  title: title(120),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters'),
  status,
});

const lines = (label) =>
  z
    .string()
    .transform(linesToList)
    .pipe(
      z
        .array(z.string().max(200, `Each ${label} must be at most 200 characters`))
        .max(20, `At most 20 ${label}s`),
    );

export const lessonFormSchema = z.object({
  title: title(140),
  summary: z.string().trim().max(300, 'Summary must be at most 300 characters'),
  objectives: lines('objective'),
  prerequisites: lines('prerequisite'),
  estimatedMinutes: z.coerce
    .number({ error: 'Enter a number' })
    .int('Use whole minutes')
    .min(0, 'Cannot be negative')
    .max(1440, 'At most 1440 minutes'),
  status,
  moduleId: z.string(),
});

export const enrollFormSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
});
