// Sidebar entries per role. Later phases add reviews, reports, etc.
export const NAVIGATION = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/courses', label: 'Courses', icon: 'book' },
    { to: '/admin/profile', label: 'Profile', icon: 'user' },
  ],
  student: [
    { to: '/app', label: 'Dashboard', icon: 'home', end: true },
    { to: '/app/courses', label: 'Courses', icon: 'book' },
    { to: '/app/assignments', label: 'Assignments', icon: 'clipboard' },
    { to: '/app/profile', label: 'Profile', icon: 'user' },
  ],
};

export const ROLE_LABEL = { admin: 'Trainer', student: 'Student' };
