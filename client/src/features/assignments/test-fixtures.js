const DAY = 24 * 60 * 60 * 1000;

export const makeAssignment = (overrides = {}) => ({
  id: 'a1',
  courseId: 'c1',
  moduleId: 'm1',
  lessonId: null,
  title: 'Personal Profile Page',
  instructions: '## Requirements\n\n- A header\n- A **contact** form',
  objectives: ['Use semantic tags'],
  dueAt: new Date(Date.now() + 3 * DAY).toISOString(),
  closesAt: new Date(Date.now() + 3 * DAY).toISOString(),
  maxMarks: 100,
  allowedSubmissionTypes: ['github_url', 'project_url', 'pdf', 'code'],
  attachments: [],
  latePolicy: { allowLate: false, lateUntil: null, penaltyPercent: 0 },
  maxAttempts: 2,
  status: 'published',
  course: { id: 'c1', title: 'Full-Stack MERN Development' },
  module: { id: 'm1', title: 'HTML Fundamentals' },
  lesson: null,
  ...overrides,
});

export const studentState = (overrides = {}) => ({
  status: 'pending',
  attempts: 0,
  latest: null,
  canSubmit: true,
  canEdit: false,
  blockedReason: null,
  ...overrides,
});

export const makeSubmission = (overrides = {}) => ({
  id: 's1',
  assignmentId: 'a1',
  courseId: 'c1',
  student: { id: 'st1', name: 'Asha Student', email: 'asha@example.com' },
  attempt: 1,
  items: [{ type: 'github_url', url: 'https://github.com/asha/profile' }],
  note: '',
  submittedAt: '2026-10-16T10:00:00.000Z',
  editedAt: null,
  isLate: false,
  status: 'submitted',
  review: null,
  ...overrides,
});

export const page = (items) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
});
