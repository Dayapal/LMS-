import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { RegisterPage } from '../features/auth/RegisterPage.jsx';
import { ProfilePage } from '../features/profile/ProfilePage.jsx';
import { StudentDashboardPage } from '../features/dashboard/StudentDashboardPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { AdminCoursesPage } from '../features/courses/admin/AdminCoursesPage.jsx';
import { CourseBuilderPage } from '../features/courses/admin/CourseBuilderPage.jsx';
import { CourseCatalogPage } from '../features/courses/student/CourseCatalogPage.jsx';
import { CourseDetailPage } from '../features/courses/student/CourseDetailPage.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards.jsx';

// Lesson pages pull in the Markdown and syntax-highlighting libraries, so they
// load on first use instead of with the main bundle.
const lessonReader = (mode) => async () => {
  const { LessonReaderPage } = await import('../features/lessons/LessonReaderPage.jsx');
  return { element: <LessonReaderPage mode={mode} /> };
};
const lessonMaterials = async () => ({
  Component: (await import('../features/lessons/admin/LessonMaterialsPage.jsx'))
    .LessonMaterialsPage,
});
// Assignment pages use the Markdown renderer, code highlighting and the code editor.
const assignmentPage = (name) => async () => ({
  Component: (await import('../features/assignments/pages.js'))[name],
});
// The trainer's dashboard, review queue, students and reports (Phase 6), as one chunk.
const trainerPage = (name) => async () => ({
  Component: (await import('../features/trainer/pages.js'))[name],
});
// Shown while a lazy page loads on a fresh page load (deep link or reload).
const pageLoading = (
  <div className="flex justify-center py-16 text-brand-600">
    <Spinner className="size-8" label="Loading page" />
  </div>
);

export const routes = [
  { path: '/', element: <HomeRedirect /> },
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth roles={['admin']} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            lazy: trainerPage('TrainerDashboardPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'reviews',
            lazy: trainerPage('ReviewQueuePage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'students',
            lazy: trainerPage('StudentsPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'students/:studentId',
            lazy: trainerPage('StudentDetailPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'reports',
            lazy: trainerPage('ReportsPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'reports/courses/:courseId',
            lazy: trainerPage('CourseReportPage'),
            hydrateFallbackElement: pageLoading,
          },
          { path: 'courses', element: <AdminCoursesPage /> },
          { path: 'courses/:courseId', element: <CourseBuilderPage /> },
          {
            path: 'courses/:courseId/lessons/:lessonId',
            lazy: lessonMaterials,
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/lessons/:lessonId/preview',
            lazy: lessonReader('preview'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/assignments/new',
            lazy: assignmentPage('AssignmentEditorPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/assignments/:assignmentId',
            lazy: assignmentPage('AdminAssignmentPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/assignments/:assignmentId/edit',
            lazy: assignmentPage('AssignmentEditorPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/assignments/:assignmentId/submissions/:submissionId',
            lazy: assignmentPage('SubmissionReviewPage'),
            hydrateFallbackElement: pageLoading,
          },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: '/app',
    element: <RequireAuth roles={['student']} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <StudentDashboardPage /> },
          { path: 'courses', element: <CourseCatalogPage /> },
          { path: 'courses/:courseId', element: <CourseDetailPage /> },
          {
            path: 'assignments',
            lazy: assignmentPage('MyAssignmentsPage'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/lessons/:lessonId',
            lazy: lessonReader('student'),
            hydrateFallbackElement: pageLoading,
          },
          {
            path: 'courses/:courseId/assignments/:assignmentId',
            lazy: assignmentPage('AssignmentPage'),
            hydrateFallbackElement: pageLoading,
          },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
