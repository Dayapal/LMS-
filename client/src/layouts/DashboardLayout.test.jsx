import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router';
import { DashboardLayout } from './DashboardLayout.jsx';
import { notificationsApi } from '../features/notifications/api.js';
import { STUDENT } from '../features/courses/test-fixtures.js';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

let finishLoading;
const routes = [
  {
    path: '/app',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        handle: { title: 'Dashboard' },
        element: (
          <>
            <h1>Student home</h1>
            <Link to="/app/courses">Go to courses</Link>
            <Link to="/app/slow">Open a slow page</Link>
          </>
        ),
      },
      { path: 'courses', handle: { title: 'Courses' }, element: <h1>Course catalog</h1> },
      {
        path: 'slow',
        handle: { title: 'Slow' },
        lazy: () =>
          new Promise((resolve) => {
            finishLoading = () => resolve({ element: <h1>Slow page</h1> });
          }),
      },
    ],
  },
];

const open = () => renderWithProviders(routes, { path: '/app', user: STUDENT });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DashboardLayout', () => {
  it('names the tab after the page and moves focus to the new page on navigation', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    open();
    await screen.findByRole('heading', { name: 'Student home' });
    expect(document.title).toBe('Dashboard · Training LMS');
    // Not on the first load.
    expect(screen.getByRole('main')).not.toHaveFocus();

    await userEvent.click(screen.getByRole('link', { name: 'Go to courses' }));
    expect(await screen.findByRole('heading', { name: 'Course catalog' })).toBeInTheDocument();
    expect(document.title).toBe('Courses · Training LMS');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('has a skip link to the focusable main region', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    open();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('shows that a page is loading while its code arrives', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    open();
    await userEvent.click(await screen.findByRole('link', { name: 'Open a slow page' }));
    await waitFor(() => expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByText('Loading page')).toBeInTheDocument();

    finishLoading();
    expect(await screen.findByRole('heading', { name: 'Slow page' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
  });

  it('keeps focus inside the mobile navigation and returns it on Escape', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    open();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(menu);

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    // Shift+Tab from the first control wraps to the last one inside the drawer.
    await userEvent.tab({ shift: true });
    expect(drawer).toContainElement(document.activeElement);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });
});
