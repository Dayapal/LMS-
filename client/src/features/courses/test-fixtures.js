export const STUDENT = {
  id: 's1',
  name: 'Asha Student',
  email: 'asha@example.com',
  role: 'student',
};
export const ADMIN = { id: 'a1', name: 'Tara Trainer', email: 'tara@example.com', role: 'admin' };

export const makeCourse = (overrides = {}) => ({
  id: 'c1',
  title: 'Full-Stack MERN Development',
  slug: 'full-stack-mern-development',
  summary: 'Build full-stack apps.',
  description: 'First paragraph.\n\nSecond paragraph.',
  thumbnailUrl: null,
  level: 'beginner',
  estimatedHours: 220,
  status: 'published',
  tags: ['react'],
  stats: { moduleCount: 2, lessonCount: 3, totalMinutes: 150 },
  enrollment: null,
  ...overrides,
});

export const makeLesson = (id, moduleId, overrides = {}) => ({
  id,
  moduleId,
  courseId: 'c1',
  title: `Lesson ${id}`,
  slug: id,
  summary: `Summary of ${id}`,
  objectives: ['Understand it'],
  prerequisites: [],
  estimatedMinutes: 50,
  order: 0,
  status: 'published',
  ...overrides,
});

export const makeRoadmap = (courseOverrides = {}) => ({
  course: makeCourse(courseOverrides),
  modules: [
    {
      id: 'm1',
      courseId: 'c1',
      title: 'HTML Fundamentals',
      description: 'Structure pages.',
      order: 0,
      status: 'published',
      lessons: [makeLesson('l1', 'm1'), makeLesson('l2', 'm1', { status: 'draft' })],
    },
    {
      id: 'm2',
      courseId: 'c1',
      title: 'CSS Layouts',
      description: '',
      order: 1,
      status: 'draft',
      lessons: [makeLesson('l3', 'm2')],
    },
  ],
});

/** The enrolled student's progress block of a roadmap (see GET /courses/:id/roadmap). */
export const makeProgress = (overrides = {}) => ({
  completedLessons: 0,
  totalLessons: 1,
  percent: 0,
  completed: false,
  lastCompletedAt: null,
  nextLesson: {
    id: 'l1',
    title: 'Lesson l1',
    moduleId: 'm1',
    moduleTitle: 'HTML Fundamentals',
    kind: 'start',
  },
  ...overrides,
});
