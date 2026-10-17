/** A course entry of GET /me/courses (also used inside the dashboard). */
export const makeMyCourse = (overrides = {}) => ({
  course: {
    id: 'c1',
    title: 'Full-Stack MERN Development',
    slug: 'full-stack-mern-development',
    summary: 'Build full-stack apps.',
    thumbnailUrl: null,
    level: 'beginner',
    estimatedHours: 220,
  },
  enrollment: {
    status: 'active',
    enrolledAt: '2026-10-01T00:00:00.000Z',
    requestedAt: '2026-09-30T00:00:00.000Z',
    lastAccessedAt: '2026-10-15T10:00:00.000Z',
  },
  progress: {
    completedLessons: 8,
    totalLessons: 38,
    percent: 21,
    completed: false,
    lastCompletedAt: '2026-10-15T09:00:00.000Z',
    nextLesson: {
      id: 'l9',
      title: 'Flexbox Layouts',
      moduleId: 'm3',
      moduleTitle: 'CSS Layouts',
      kind: 'resume',
    },
  },
  ...overrides,
});

export const pendingCourse = () =>
  makeMyCourse({
    course: {
      id: 'c2',
      title: 'Java Full-Stack Development',
      slug: 'java-full-stack-development',
      summary: '',
      thumbnailUrl: null,
      level: 'intermediate',
      estimatedHours: 200,
    },
    enrollment: {
      status: 'pending',
      enrolledAt: null,
      requestedAt: '2026-10-10T00:00:00.000Z',
      lastAccessedAt: null,
    },
    progress: null,
  });

/** A row of GET /me/assignments in the given derived state. */
export const makeMyAssignment = (id, status, overrides = {}) => ({
  id,
  title: `Assignment ${id}`,
  status: 'published',
  dueAt: '2026-10-20T18:30:00.000Z',
  closesAt: '2026-10-20T18:30:00.000Z',
  maxMarks: 100,
  allowedSubmissionTypes: ['github_url'],
  course: { id: 'c1', title: 'Full-Stack MERN Development' },
  module: { id: 'm1', title: 'HTML Fundamentals' },
  lesson: null,
  mySubmission: {
    status,
    attempts: ['pending', 'overdue'].includes(status) ? 0 : 1,
    latest: ['pending', 'overdue'].includes(status)
      ? null
      : {
          id: `s-${id}`,
          attempt: 1,
          status,
          isLate: false,
          submittedAt: '2026-10-14T10:00:00.000Z',
          finalMarks: status === 'reviewed' ? 86 : null,
          reviewedAt: status === 'submitted' ? null : '2026-10-15T10:00:00.000Z',
        },
    canSubmit: ['pending', 'resubmit_requested'].includes(status),
    canEdit: status === 'submitted',
    blockedReason: null,
  },
  ...overrides,
});

export const COUNTS = {
  all: 5,
  pending: 1,
  overdue: 1,
  submitted: 1,
  reviewed: 1,
  resubmit_requested: 1,
};

export const makeDashboard = (overrides = {}) => {
  const active = makeMyCourse();
  return {
    summary: {
      activeCourses: 1,
      completedCourses: 0,
      pendingRequests: 1,
      lessonsCompleted: 8,
      assignments: COUNTS,
    },
    continueLearning: active,
    courses: [active, pendingCourse()],
    upcoming: [makeMyAssignment('a1', 'resubmit_requested'), makeMyAssignment('a2', 'pending')],
    recentFeedback: [makeMyAssignment('a3', 'reviewed')],
    ...overrides,
  };
};
