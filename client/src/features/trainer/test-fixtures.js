/** Server-shaped data for the trainer page tests. */

export const reviewCounts = (overrides = {}) => ({
  all: 5,
  submitted: 3,
  resubmitted: 1,
  resubmit_requested: 1,
  reviewed: 1,
  ...overrides,
});

export const makeQueueRow = (overrides = {}) => ({
  id: 'sub1',
  attempt: 1,
  attempts: 1,
  status: 'submitted',
  isLate: false,
  submittedAt: '2026-10-15T10:00:00Z',
  editedAt: null,
  review: null,
  student: { id: 'st1', name: 'Asha Rao', email: 'asha@example.com' },
  course: { id: 'c1', title: 'MERN Development', status: 'published' },
  assignment: {
    id: 'a1',
    title: 'Personal Profile Page',
    status: 'published',
    dueAt: '2026-10-20T18:30:00Z',
    closesAt: '2026-10-27T18:30:00Z',
    maxMarks: 100,
    maxAttempts: 2,
  },
  enrollmentStatus: 'active',
  ...overrides,
});

export const queuePage = (items, counts = reviewCounts(), meta = {}) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1, counts, ...meta },
});

export const page = (items, meta = {}) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta },
});

export const makeProgress = (overrides = {}) => ({
  completedLessons: 8,
  totalLessons: 38,
  percent: 21,
  completed: false,
  lastCompletedAt: '2026-10-14T10:00:00Z',
  ...overrides,
});

export const makeStudentRow = (overrides = {}) => ({
  id: 'st1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  bio: '',
  avatarUrl: null,
  isActive: true,
  createdAt: '2026-09-01T10:00:00Z',
  lastLoginAt: null,
  lastAccessedAt: null,
  enrollments: { active: 1, pending: 1, removed: 0 },
  courses: [
    {
      id: 'c1',
      title: 'MERN Development',
      status: 'published',
      enrollmentStatus: 'active',
      progress: makeProgress(),
    },
    { id: 'c2', title: 'Java', status: 'published', enrollmentStatus: 'pending', progress: null },
  ],
  awaitingReview: 1,
  overdue: 2,
  ...overrides,
});

const counts = (overrides = {}) => ({
  all: 3,
  pending: 1,
  overdue: 2,
  submitted: 0,
  reviewed: 0,
  resubmit_requested: 0,
  ...overrides,
});

export const makeStudentDetail = (overrides = {}) => ({
  student: {
    id: 'st1',
    name: 'Asha Rao',
    email: 'asha@example.com',
    bio: 'Learning React.',
    avatarUrl: null,
    isActive: true,
    createdAt: '2026-09-01T10:00:00Z',
    lastLoginAt: '2026-10-16T08:00:00Z',
  },
  summary: {
    activeCourses: 1,
    pendingRequests: 1,
    removedCourses: 1,
    completedCourses: 0,
    lessonsCompleted: 8,
    awaitingReview: 1,
    assignments: counts(),
  },
  enrollments: [
    {
      id: 'e1',
      status: 'active',
      requestedAt: '2026-09-01T10:00:00Z',
      enrolledAt: '2026-09-02T10:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z',
      lastAccessedAt: '2026-10-16T08:00:00Z',
      course: { id: 'c1', title: 'MERN Development', status: 'published' },
      progress: makeProgress(),
      awaitingReview: 1,
      overdue: 2,
    },
    {
      id: 'e2',
      status: 'pending',
      requestedAt: '2026-10-10T10:00:00Z',
      enrolledAt: null,
      updatedAt: '2026-10-10T10:00:00Z',
      lastAccessedAt: null,
      course: { id: 'c2', title: 'Java', status: 'published' },
      progress: null,
      awaitingReview: 0,
      overdue: 0,
    },
    {
      id: 'e3',
      status: 'removed',
      requestedAt: '2026-08-01T10:00:00Z',
      enrolledAt: '2026-08-02T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
      lastAccessedAt: null,
      course: { id: 'c3', title: 'DSA', status: 'archived' },
      progress: makeProgress({ completedLessons: 2, totalLessons: 10, percent: 20 }),
      awaitingReview: 0,
      overdue: 0,
    },
  ],
  ...overrides,
});

export const makeStudentReport = (overrides = {}) => ({
  student: { id: 'st1', name: 'Asha Rao', email: 'asha@example.com' },
  courses: [
    {
      course: { id: 'c1', title: 'MERN Development', status: 'published' },
      enrollmentStatus: 'active',
      progress: makeProgress(),
      modules: [
        {
          id: 'm1',
          title: 'HTML Fundamentals',
          completedLessons: 3,
          totalLessons: 3,
          percent: 100,
        },
        { id: 'm2', title: 'CSS Layout', completedLessons: 1, totalLessons: 4, percent: 25 },
      ],
    },
  ],
  assignments: {
    counts: counts(),
    items: [
      {
        id: 'a1',
        title: 'Personal Profile Page',
        status: 'published',
        dueAt: '2026-10-10T18:30:00Z',
        closesAt: '2026-10-10T18:30:00Z',
        maxMarks: 100,
        course: { id: 'c1', title: 'MERN Development' },
        state: 'overdue',
        attempts: 0,
        latest: null,
      },
    ],
  },
  submissions: [
    {
      id: 'sub9',
      attempt: 1,
      attempts: 1,
      status: 'reviewed',
      isLate: true,
      submittedAt: '2026-10-01T10:00:00Z',
      review: { marks: 80, finalMarks: 72, reviewedAt: '2026-10-02T10:00:00Z' },
      assignment: {
        id: 'a2',
        title: 'Flexbox Gallery',
        status: 'archived',
        dueAt: '2026-09-30T18:30:00Z',
        closesAt: '2026-10-05T18:30:00Z',
        maxMarks: 100,
      },
      course: { id: 'c3', title: 'DSA', status: 'archived' },
    },
  ],
  marks: { reviewed: 1, averagePercent: 72 },
  activity: [
    {
      id: 'ev1',
      type: 'lesson_completed',
      createdAt: '2026-10-16T08:00:00Z',
      student: { id: 'st1', name: 'Asha Rao' },
      actor: null,
      course: { id: 'c1', title: 'MERN Development' },
      lesson: { id: 'l1', title: 'Flexbox Layouts' },
      assignment: null,
      submissionId: null,
      attempt: null,
    },
  ],
  ...overrides,
});

export const makeCourseSummary = (overrides = {}) => ({
  id: 'c1',
  title: 'MERN Development',
  status: 'published',
  lessons: 38,
  enrollments: { active: 2, pending: 1, removed: 0 },
  progress: { students: 2, averagePercent: 14, completedStudents: 0, notStarted: 0, inProgress: 2 },
  assignments: { published: 2, draft: 0, archived: 0 },
  reviews: { all: 2, submitted: 1, resubmitted: 0, resubmit_requested: 1, reviewed: 1 },
  overdue: 3,
  ...overrides,
});

export const makeDashboard = (overrides = {}) => ({
  summary: {
    students: { total: 12, newThisWeek: 2, enrolled: 9, activeThisWeek: 5 },
    enrollments: { active: 10, pending: 2, removed: 1 },
    reviews: { all: 6, submitted: 3, resubmitted: 1, resubmit_requested: 1, reviewed: 2 },
    overdue: { total: 4, students: 3 },
  },
  courses: [makeCourseSummary()],
  reviewQueue: [makeQueueRow()],
  pendingRequests: {
    total: 1,
    items: [
      {
        id: 'e2',
        status: 'pending',
        enrolledAt: null,
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
        user: { id: 'st2', name: 'Kabir Singh', email: 'kabir@example.com' },
        course: { id: 'c2', title: 'DSA' },
      },
    ],
  },
  upcoming: [
    {
      id: 'a3',
      courseId: 'c1',
      title: 'Responsive Landing Page',
      status: 'published',
      dueAt: '2026-10-19T18:30:00Z',
      closesAt: '2026-10-19T18:30:00Z',
      maxMarks: 50,
      course: { id: 'c1', title: 'MERN Development' },
      stats: { expected: 10, handedIn: 4, pending: 6, overdue: 0 },
    },
  ],
  overdue: [
    {
      id: 'a1',
      courseId: 'c1',
      title: 'Personal Profile Page',
      status: 'published',
      dueAt: '2026-10-10T18:30:00Z',
      closesAt: '2099-10-17T18:30:00Z',
      maxMarks: 100,
      course: { id: 'c1', title: 'MERN Development' },
      stats: { expected: 10, handedIn: 7, pending: 0, overdue: 3 },
    },
  ],
  recentActivity: [
    {
      id: 'ev1',
      type: 'submission_created',
      createdAt: '2026-10-16T08:00:00Z',
      student: { id: 'st1', name: 'Asha Rao' },
      actor: null,
      course: { id: 'c1', title: 'MERN Development' },
      lesson: null,
      assignment: { id: 'a1', title: 'Personal Profile Page' },
      submissionId: 'sub1',
      attempt: 2,
    },
  ],
  ...overrides,
});

export const makeCourseReport = (overrides = {}) => ({
  course: { ...makeCourseSummary(), modules: 2 },
  distribution: [
    { label: 'Not started', min: 0, max: 0, students: 0 },
    { label: '1–24%', min: 1, max: 24, students: 2 },
    { label: '25–49%', min: 25, max: 49, students: 0 },
    { label: '50–74%', min: 50, max: 74, students: 0 },
    { label: '75–99%', min: 75, max: 99, students: 0 },
    { label: 'Completed', min: 100, max: 100, students: 0 },
  ],
  modules: [
    { id: 'm1', title: 'HTML Fundamentals', lessons: 3, completions: 5, percent: 83 },
    { id: 'm2', title: 'CSS Layout', lessons: 4, completions: 0, percent: 0 },
  ],
  assignments: [
    {
      id: 'a1',
      courseId: 'c1',
      title: 'Personal Profile Page',
      status: 'published',
      dueAt: '2026-10-10T18:30:00Z',
      closesAt: '2026-10-17T18:30:00Z',
      maxMarks: 100,
      stats: {
        students: 2,
        submitted: 0,
        resubmitted: 0,
        resubmit_requested: 1,
        reviewed: 1,
        averageMarks: 86,
        openToStudents: true,
        expected: 2,
        handedIn: 2,
        pending: 0,
        overdue: 0,
      },
    },
  ],
  students: [
    {
      enrollmentId: 'e1',
      status: 'active',
      requestedAt: '2026-09-01T10:00:00Z',
      enrolledAt: '2026-09-02T10:00:00Z',
      lastAccessedAt: '2026-10-16T08:00:00Z',
      student: { id: 'st1', name: 'Aarav Mehta', email: 'aarav@example.com', lastLoginAt: null },
      progress: makeProgress(),
      reviews: { all: 1, submitted: 0, resubmitted: 0, resubmit_requested: 0, reviewed: 1 },
      overdue: 1,
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  ...overrides,
});
