import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext } from '../context/authContextObject.js';
import { ToastProvider } from '../context/ToastContext.jsx';

/** Renders routes with a fresh query client, toasts and a signed-in user. */
export function renderWithProviders(routes, { path = '/', user } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth = {
    status: user ? 'authenticated' : 'anonymous',
    user: user ?? null,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    signIn: () => {},
    updateUser: () => {},
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}

export const notFoundError = () =>
  Object.assign(new Error('Not found'), {
    response: {
      status: 404,
      data: { success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } },
    },
  });

export const apiError = (status, message, details) =>
  Object.assign(new Error(message), {
    response: { status, data: { success: false, error: { code: 'ERROR', message, details } } },
  });
