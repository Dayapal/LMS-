import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext } from '../context/authContextObject.js';

export const STUDENT = {
  id: 's1',
  name: 'Asha Student',
  email: 'asha@example.com',
  role: 'student',
};
export const ADMIN = { id: 'a1', name: 'Tara Trainer', email: 'tara@example.com', role: 'admin' };

/** Renders `routes` at `path` with a stubbed auth context. */
export function renderWithAuth(routes, { path = '/', auth = {} } = {}) {
  const value = {
    status: 'anonymous',
    user: null,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    signIn: () => {},
    updateUser: () => {},
    ...auth,
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return { ...utils, router, auth: value };
}
