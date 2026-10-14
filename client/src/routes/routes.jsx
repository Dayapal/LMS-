import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { RegisterPage } from '../features/auth/RegisterPage.jsx';
import { ProfilePage } from '../features/profile/ProfilePage.jsx';
import { AdminDashboardPage, StudentDashboardPage } from '../features/dashboard/DashboardPages.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { AdminCoursesPage } from '../features/courses/admin/AdminCoursesPage.jsx';
import { CourseBuilderPage } from '../features/courses/admin/CourseBuilderPage.jsx';
import { CourseCatalogPage } from '../features/courses/student/CourseCatalogPage.jsx';
import { CourseDetailPage } from '../features/courses/student/CourseDetailPage.jsx';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards.jsx';

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
          { index: true, element: <AdminDashboardPage /> },
          { path: 'courses', element: <AdminCoursesPage /> },
          { path: 'courses/:courseId', element: <CourseBuilderPage /> },
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
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
