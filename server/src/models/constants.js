export const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const COURSE_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

export const ENROLLMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  REMOVED: 'removed',
});

export const MATERIAL_TYPES = Object.freeze({
  NOTE: 'note',
  CODE: 'code',
  FILE: 'file',
  LINK: 'link',
});

// Languages a code material may declare. The client highlights each of them.
export const CODE_LANGUAGES = Object.freeze([
  'javascript',
  'jsx',
  'typescript',
  'tsx',
  'java',
  'sql',
  'html',
  'css',
  'json',
  'yaml',
  'bash',
  'text',
]);

// Later phases add thumbnail and avatar files.
export const FILE_PURPOSES = Object.freeze({
  MATERIAL: 'material',
  ASSIGNMENT: 'assignment',
  SUBMISSION: 'submission',
});

/** What a student may hand in: a link of one of three kinds, a PDF, or pasted code. */
export const SUBMISSION_TYPES = Object.freeze({
  DRIVE_URL: 'drive_url',
  GITHUB_URL: 'github_url',
  PROJECT_URL: 'project_url',
  PDF: 'pdf',
  CODE: 'code',
});

export const SUBMISSION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  RESUBMIT_REQUESTED: 'resubmit_requested',
});

/**
 * A student's derived state of an assignment (spec §5): `pending` or `overdue`
 * before anything is handed in, then the status of their latest attempt. Never stored.
 */
export const STUDENT_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  OVERDUE: 'overdue',
  ...SUBMISSION_STATUS,
});

/**
 * Learning events recorded in the append-only Activity log (spec §5). Each is
 * about one student; `actor` is the trainer when the trainer caused it.
 */
export const ACTIVITY_TYPES = Object.freeze({
  REGISTERED: 'registered',
  LOGIN: 'login',
  ENROLLMENT_REQUESTED: 'enrollment_requested',
  ENROLLED: 'enrolled',
  ENROLLMENT_REMOVED: 'enrollment_removed',
  LESSON_COMPLETED: 'lesson_completed',
  SUBMISSION_CREATED: 'submission_created',
  SUBMISSION_REVIEWED: 'submission_reviewed',
  RESUBMISSION_REQUESTED: 'resubmission_requested',
});
