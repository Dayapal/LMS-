import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { RouteErrorPage } from '../pages/RouteErrorPage.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards.jsx';

// Shown while a lazy page loads on a fresh page load (deep link or reload).
// Client-side navigations keep the current page and show the layout's loading bar.
const pageLoading = (
  <div className="flex justify-center py-16 text-cyan-500">
    <Spinner className="size-8" label="Loading page" />
  </div>
);

/**
 * A page loaded on first use. The startup bundle holds only the shell
 * (layouts, guards, auth and toasts); every page, and the libraries only
 * pages use (forms and validation, Markdown, code highlighting, CodeMirror),
 * arrive with the page. `title` names the browser tab.
 */
const page = (load, name, title, extra = {}) => ({
  lazy: async () => ({ Component: (await load())[name] }),
  hydrateFallbackElement: pageLoading,
  handle: { title },
  ...extra,
});

const authPages = () => import('../features/auth/pages.js');
const coursesAdmin = () => import('../features/courses/admin/pages.js');
const coursesStudent = () => import('../features/courses/student/pages.js');
const profile = () => import('../features/profile/ProfilePage.jsx');
const notifications = () => import('../features/notifications/NotificationsPage.jsx');
// Lesson pages pull in the Markdown and syntax-highlighting libraries.
const lessonReader = () => import('../features/lessons/LessonReaderPage.jsx');
const lessonMaterials = () => import('../features/lessons/admin/LessonMaterialsPage.jsx');
// Assignment pages use the Markdown renderer, code highlighting and the code editor.
const assignments = () => import('../features/assignments/pages.js');
// The trainer's dashboard, review queue, students and reports (Phase 6), as one chunk.
const trainer = () => import('../features/trainer/pages.js');
const studyPages = () => import('../features/study-materials/pages.js');

const studyReader = (mode, title) => ({
  lazy: async () => {
    const { StudyReaderPage } = await studyPages();
    return { element: <StudyReaderPage mode={mode} /> };
  },
  hydrateFallbackElement: pageLoading,
  handle: { title },
});

const readerPage = (mode, title) => ({
  lazy: async () => {
    const { LessonReaderPage } = await lessonReader();
    return { element: <LessonReaderPage mode={mode} /> };
  },
  hydrateFallbackElement: pageLoading,
  handle: { title },
});

/** The signed-in area of one role: the dashboard layout around its pages. */
const dashboardArea = (path, role, children) => ({
  path,
  element: <RequireAuth roles={[role]} />,
  errorElement: <RouteErrorPage />,
  children: [
    {
      element: <DashboardLayout />,
      // A page that fails to load or crashes is replaced inside the layout,
      // so navigation keeps working.
      children: [{ errorElement: <RouteErrorPage inLayout />, children }],
    },
  ],
});

export const routes = [
  { path: '/', element: <HomeRedirect />, errorElement: <RouteErrorPage /> },
  {
    element: <GuestOnly />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', ...page(authPages, 'LoginPage', 'Sign in') },
          { path: '/register', ...page(authPages, 'RegisterPage', 'Create your account') },
        ],
      },
    ],
  },
  dashboardArea('/admin', 'admin', [
    { index: true, ...page(trainer, 'TrainerDashboardPage', 'Dashboard') },
    { path: 'reviews', ...page(trainer, 'ReviewQueuePage', 'Reviews') },
    { path: 'students', ...page(trainer, 'StudentsPage', 'Students') },
    { path: 'students/:studentId', ...page(trainer, 'StudentDetailPage', 'Student') },
    { path: 'reports', ...page(trainer, 'ReportsPage', 'Reports') },
    { path: 'reports/courses/:courseId', ...page(trainer, 'CourseReportPage', 'Course report') },
    { path: 'courses', ...page(coursesAdmin, 'AdminCoursesPage', 'Courses') },
    { path: 'study-materials', ...page(studyPages, 'AdminStudyMaterialsPage', 'Study Books') },
    { path: 'study-materials/reports', ...page(studyPages, 'AdminStudyReportsPage', 'Study Reports') },
    { path: 'study-materials/preview/:moduleId', ...studyReader('preview', 'Study Book Preview') },
    { path: 'courses/:courseId', ...page(coursesAdmin, 'CourseBuilderPage', 'Course builder') },
    {
      path: 'courses/:courseId/lessons/:lessonId',
      ...page(lessonMaterials, 'LessonMaterialsPage', 'Lesson materials'),
    },
    {
      path: 'courses/:courseId/lessons/:lessonId/preview',
      ...readerPage('preview', 'Lesson preview'),
    },
    {
      path: 'courses/:courseId/assignments/new',
      ...page(assignments, 'AssignmentEditorPage', 'New assignment'),
    },
    {
      path: 'courses/:courseId/assignments/:assignmentId',
      ...page(assignments, 'AdminAssignmentPage', 'Assignment'),
    },
    {
      path: 'courses/:courseId/assignments/:assignmentId/edit',
      ...page(assignments, 'AssignmentEditorPage', 'Edit assignment'),
    },
    {
      path: 'courses/:courseId/assignments/:assignmentId/submissions/:submissionId',
      ...page(assignments, 'SubmissionReviewPage', 'Review submission'),
    },
    { path: 'notifications', ...page(notifications, 'NotificationsPage', 'Notifications') },
    { path: 'profile', ...page(profile, 'ProfilePage', 'Profile') },
  ]),
  dashboardArea('/app', 'student', [
    { index: true, ...page(coursesStudent, 'StudentDashboardPage', 'Dashboard') },
    { path: 'courses', ...page(coursesStudent, 'CourseCatalogPage', 'Courses') },
    { path: 'courses/:courseId', ...page(coursesStudent, 'CourseDetailPage', 'Course') },
    { path: 'study-materials', ...page(studyPages, 'StudyLibraryPage', 'Study Books') },
    { path: 'study-materials/report', ...page(studyPages, 'StudentProgressReportPage', 'Study Report') },
    { path: 'study-materials/:bookSlug', ...page(studyPages, 'StudentBookRoadmapPage', 'Study Book') },
    { path: 'study-materials/:bookSlug/modules/:moduleSlug', ...studyReader('student', 'Study Book') },
    { path: 'assignments', ...page(assignments, 'MyAssignmentsPage', 'Assignments') },
    { path: 'courses/:courseId/lessons/:lessonId', ...readerPage('student', 'Lesson') },
    {
      path: 'courses/:courseId/assignments/:assignmentId',
      ...page(assignments, 'AssignmentPage', 'Assignment'),
    },
    { path: 'notifications', ...page(notifications, 'NotificationsPage', 'Notifications') },
    { path: 'profile', ...page(profile, 'ProfilePage', 'Profile') },
  ]),
  { path: '*', element: <NotFoundPage />, handle: { title: 'Page not found' } },
];
