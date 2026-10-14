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

// Later phases add assignment, submission, thumbnail and avatar files.
export const FILE_PURPOSES = Object.freeze({ MATERIAL: 'material' });
