// Sidebar entries per role.
export const NAVIGATION = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/courses', label: 'Courses', icon: 'book' },
    { to: '/admin/study-materials', label: 'Study Books', icon: 'book-open' },
    { to: '/admin/reviews', label: 'Reviews', icon: 'inbox' },
    { to: '/admin/students', label: 'Students', icon: 'users' },
    { to: '/admin/reports', label: 'Reports', icon: 'chart' },
    { to: '/admin/profile', label: 'Profile', icon: 'user' },
  ],
  student: [
    { to: '/app', label: 'Dashboard', icon: 'home', end: true },
    { to: '/app/courses', label: 'Courses', icon: 'book' },
    { to: '/app/study-materials', label: 'Study Books', icon: 'book-open' },
    { to: '/app/assignments', label: 'Assignments', icon: 'clipboard' },
    { to: '/app/profile', label: 'Profile', icon: 'user' },
  ],
};

export const ROLE_LABEL = { admin: 'Trainer', student: 'Student' };
