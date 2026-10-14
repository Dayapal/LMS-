export const makeLessonDetail = (overrides = {}) => ({
  id: 'l2',
  courseId: 'c1',
  moduleId: 'm1',
  title: 'Flexbox Layouts',
  slug: 'flexbox-layouts',
  summary: 'Align and distribute items in one dimension.',
  objectives: ['Build navigation bars', 'Use gap'],
  prerequisites: ['Selectors'],
  estimatedMinutes: 60,
  order: 1,
  status: 'published',
  module: { id: 'm1', title: 'CSS Layouts' },
  course: { id: 'c1', title: 'Full-Stack MERN Development' },
  ...overrides,
});

const base = (id, type, order, overrides) => ({
  id,
  lessonId: 'l2',
  courseId: 'c1',
  type,
  order,
  status: 'published',
  updatedAt: '2026-10-14T10:00:00.000Z',
  ...overrides,
});

export const noteMaterial = (overrides = {}) =>
  base('n1', 'note', 0, {
    title: 'Lesson notes',
    body: '## One axis\n\nFlexbox lays items out in **one** dimension.',
    ...overrides,
  });

export const codeMaterial = (overrides = {}) =>
  base('k1', 'code', 1, {
    title: 'Navbar layout',
    language: 'css',
    source: '.nav {\n  display: flex;\n}',
    caption: 'Space between the logo and links',
    ...overrides,
  });

export const fileMaterial = (overrides = {}) =>
  base('f1', 'file', 2, {
    title: 'Flexbox cheat sheet',
    downloadable: true,
    file: {
      id: 'file1',
      originalName: 'flexbox.pdf',
      mimeType: 'application/pdf',
      size: 48_000,
      purpose: 'material',
      courseId: 'c1',
    },
    ...overrides,
  });

export const linkMaterial = (id, overrides = {}) =>
  base(id, 'link', 3, {
    title: `Guide ${id}`,
    url: `https://developer.mozilla.org/${id}`,
    description: '',
    ...overrides,
  });

export const makeNavigation = (overrides = {}) => ({
  previous: { id: 'l1', title: 'Selectors', moduleId: 'm1', moduleTitle: 'CSS Layouts' },
  next: { id: 'l3', title: 'CSS Grid', moduleId: 'm2', moduleTitle: 'Grid' },
  position: 2,
  total: 5,
  ...overrides,
});
