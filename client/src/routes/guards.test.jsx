import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation } from 'react-router';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards.jsx';
import { safeRedirect } from './paths.js';
import { ADMIN, renderWithAuth, STUDENT } from '../test/renderWithAuth.jsx';

function LoginProbe() {
  const location = useLocation();
  return <p>login page (from: {location.state?.from ?? 'none'})</p>;
}

const routes = [
  { path: '/', element: <HomeRedirect /> },
  { element: <GuestOnly />, children: [{ path: '/login', element: <LoginProbe /> }] },
  {
    path: '/admin',
    element: <RequireAuth roles={['admin']} />,
    children: [{ index: true, element: <p>admin area</p> }],
  },
  {
    path: '/app',
    element: <RequireAuth roles={['student']} />,
    children: [
      { index: true, element: <p>student area</p> },
      { path: 'profile', element: <p>student profile</p> },
    ],
  },
];

describe('route guards', () => {
  it('shows a spinner while the session is being restored', () => {
    renderWithAuth(routes, { path: '/app', auth: { status: 'loading' } });
    expect(screen.getByRole('status', { name: /loading your session/i })).toBeInTheDocument();
  });

  it('sends anonymous users to login and remembers where they were going', () => {
    renderWithAuth(routes, { path: '/app/profile' });
    expect(screen.getByText('login page (from: /app/profile)')).toBeInTheDocument();
  });

  it('lets a student into the student area', () => {
    renderWithAuth(routes, { path: '/app', auth: { status: 'authenticated', user: STUDENT } });
    expect(screen.getByText('student area')).toBeInTheDocument();
  });

  it('redirects a student away from the admin area', () => {
    renderWithAuth(routes, { path: '/admin', auth: { status: 'authenticated', user: STUDENT } });
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
    expect(screen.getByText('student area')).toBeInTheDocument();
  });

  it('redirects an admin away from the student area', () => {
    renderWithAuth(routes, { path: '/app', auth: { status: 'authenticated', user: ADMIN } });
    expect(screen.getByText('admin area')).toBeInTheDocument();
  });

  it('sends signed-in users from /login to their dashboard', () => {
    renderWithAuth(routes, { path: '/login', auth: { status: 'authenticated', user: ADMIN } });
    expect(screen.getByText('admin area')).toBeInTheDocument();
  });

  it('routes / to the right home', () => {
    renderWithAuth(routes, { path: '/', auth: { status: 'authenticated', user: STUDENT } });
    expect(screen.getByText('student area')).toBeInTheDocument();
  });
});

describe('safeRedirect', () => {
  it('only follows redirects inside the role home', () => {
    expect(safeRedirect(STUDENT, '/app/profile')).toBe('/app/profile');
    expect(safeRedirect(STUDENT, '/admin')).toBe('/app');
    expect(safeRedirect(STUDENT, '/application')).toBe('/app');
    expect(safeRedirect(STUDENT, 'https://evil.example')).toBe('/app');
    expect(safeRedirect(ADMIN, undefined)).toBe('/admin');
  });
});
