import { z } from '../../utils/zod.js';
import { linesToList } from '../courses/format.js';

// Mirrors server/src/validators/assignment.validators.js and links.js. The
// server checks everything again; these give quick feedback in the form.

const optionalInt = (min, max, message) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number({ error: 'Enter a number' }).int(message).min(min).max(max).nullable());

export const assignmentFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(140, 'Title must be at most 140 characters'),
    status: z.enum(['draft', 'published', 'archived']),
    placement: z.string(),
    dueAt: z.string().min(1, 'Choose the due date and time'),
    maxMarks: z.coerce
      .number({ error: 'Enter a number' })
      .int('Use whole marks')
      .min(1, 'At least 1 mark')
      .max(1000, 'At most 1000 marks'),
    maxAttempts: optionalInt(1, 20, 'Use a whole number'),
    allowedSubmissionTypes: z.array(z.string()).min(1, 'Allow at least one way to submit'),
    latePolicy: z.object({
      allowLate: z.boolean(),
      lateUntil: z.string(),
      penaltyPercent: z.coerce
        .number({ error: 'Enter a number' })
        .int('Use a whole percentage')
        .min(0, 'Cannot be negative')
        .max(100, 'At most 100%'),
    }),
    objectives: z
      .string()
      .transform(linesToList)
      .pipe(
        z
          .array(z.string().max(200, 'Each objective must be at most 200 characters'))
          .max(20, 'At most 20 objectives'),
      ),
    instructions: z.string().trim().max(20_000, 'Instructions must be at most 20,000 characters'),
  })
  .superRefine((values, ctx) => {
    const { allowLate, lateUntil } = values.latePolicy;
    if (!allowLate) return;
    const path = ['latePolicy', 'lateUntil'];
    if (!lateUntil) {
      ctx.addIssue({ code: 'custom', path, message: 'Set the last date late work is accepted' });
    } else if (values.dueAt && new Date(lateUntil) <= new Date(values.dueAt)) {
      ctx.addIssue({ code: 'custom', path, message: 'The late cutoff must be after the due date' });
    }
  });

/** Upload rules for trainer handouts: the same as study materials. */
export const ATTACHMENT_RULES = {
  maxBytes: 20 * 1024 * 1024,
  extensions: ['pdf', 'docx', 'pptx'],
  accept:
    '.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export function checkAttachmentFile(file) {
  if (!ATTACHMENT_RULES.extensions.includes(extensionOf(file.name))) {
    return 'Only PDF, DOCX and PPTX files are allowed';
  }
  if (file.size === 0) return 'The file is empty';
  if (file.size > ATTACHMENT_RULES.maxBytes) return 'Files must be 20 MB or smaller';
  return null;
}

// ---- Submissions ----

export const SUBMISSION_PDF_MAX_BYTES = 10 * 1024 * 1024;

/** A message describing why `file` can't be submitted, or null when it looks fine. */
export function checkSubmissionPdf(file) {
  if (extensionOf(file.name) !== 'pdf') return 'Only PDF files can be submitted';
  if (file.size === 0) return 'The file is empty';
  if (file.size > SUBMISSION_PDF_MAX_BYTES) return 'PDFs must be 10 MB or smaller';
  return null;
}

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.\d+\.\d+\.\d+|\[.*\])$/i;

/** Why `value` isn't an acceptable link of `type`, or null. */
export function linkProblem(type, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'Enter a full https:// address';
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return 'Enter a full https:// address';
  }
  const host = url.hostname.toLowerCase();
  if (type === 'drive_url') {
    return ['drive.google.com', 'docs.google.com'].includes(host)
      ? null
      : 'Use a Google Drive or Google Docs link';
  }
  if (type === 'github_url') {
    if (!['github.com', 'www.github.com'].includes(host)) return 'Use a github.com repository link';
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    return owner && repo ? null : 'Link to a repository: https://github.com/<owner>/<repository>';
  }
  return PRIVATE_HOST.test(host) || !host.includes('.')
    ? 'Use the public address of your deployed project'
    : null;
}

const MAX_CODE_BYTES = 100 * 1024;

export const codeSizeProblem = (source) =>
  new TextEncoder().encode(source).length > MAX_CODE_BYTES ? 'Code must be at most 100 KB' : null;

export const noteSchema = z.string().trim().max(2000, 'The note must be at most 2000 characters');

const marksValue = (maxMarks) =>
  z
    .number({ error: 'Enter a number' })
    .min(0, 'Marks cannot be negative')
    .max(maxMarks, `At most ${maxMarks} marks`)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      'Use at most two decimals',
    );

const feedback = z.string().trim().max(10_000, 'Feedback must be at most 10,000 characters');

/** Grading: marks are required. */
export const reviewFormSchema = (maxMarks) =>
  z.object({
    marks: z.string().trim().min(1, 'Enter the marks').transform(Number).pipe(marksValue(maxMarks)),
    feedback,
  });

/** Asking for a resubmission: feedback is required, marks are optional. */
export const resubmitFormSchema = (maxMarks) =>
  z.object({
    marks: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : Number(value)))
      .pipe(marksValue(maxMarks).nullable()),
    feedback: feedback.min(1, 'Tell the student what to change'),
  });
