// Sidebar entries per role. Later phases add courses, assignments, reports, etc.
export const NAVIGATION = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/profile', label: 'Profile', icon: 'user' },
  ],
  student: [
    { to: '/app', label: 'Dashboard', icon: 'home', end: true },
    { to: '/app/profile', label: 'Profile', icon: 'user' },
  ],
};

export const ROLE_LABEL = { admin: 'Trainer', student: 'Student' };
