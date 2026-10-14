export const ROLE_HOME = Object.freeze({ admin: '/admin', student: '/app' });

export const homeFor = (user) => ROLE_HOME[user?.role] ?? '/login';

/** Only follow a post-login redirect into the area the user's role may enter. */
export function safeRedirect(user, from) {
  const home = homeFor(user);
  if (typeof from === 'string' && (from === home || from.startsWith(`${home}/`))) return from;
  return home;
}
