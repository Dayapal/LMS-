import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { routes } from './routes.jsx';
import { DashboardLayout } from '../layouts/DashboardLayout.jsx';
import { RouteErrorPage } from '../pages/RouteErrorPage.jsx';
import { notificationsApi } from '../features/notifications/api.js';
import { STUDENT } from '../features/courses/test-fixtures.js';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Every route object in the tree, with its full path. */
function flatten(list, parent = '') {
  return list.flatMap((route) => {
    const path = route.path?.startsWith('/')
      ? route.path
      : [parent, route.path].filter(Boolean).join('/');
    return [
      { ...route, fullPath: path || parent },
      ...flatten(route.children ?? [], path || parent),
    ];
  });
}

const pages = flatten(routes).filter((route) => route.lazy);

describe('route table', () => {
  it('loads every page lazily, so none of them is in the startup bundle', () => {
    const eager = flatten(routes).filter(
      (route) => route.element && !route.children && route.path !== '*' && route.path !== '/',
    );
    expect(eager.map((route) => route.fullPath)).toEqual([]);
    // 16 trainer pages, 8 student pages, sign-in and sign-up.
    expect(pages).toHaveLength(26);
  });

  it.each(pages.map((route) => [route.fullPath || '(index)', route]))(
    '%s resolves to a page and names the tab',
    async (_, route) => {
      const loaded = await route.lazy();
      expect(loaded.Component ?? loaded.element).toBeTruthy();
      expect(route.handle?.title).toEqual(expect.any(String));
      expect(route.hydrateFallbackElement).toBeTruthy();
    },
  );

  it('puts an error boundary on every area', () => {
    for (const route of routes.filter((r) => r.path !== '*')) {
      expect(route.errorElement, route.path ?? 'guest area').toBeTruthy();
    }
  });
});

describe('RouteErrorPage', () => {
  const area = (lazy) => [
    {
      path: '/app',
      element: <DashboardLayout />,
      children: [
        {
          errorElement: <RouteErrorPage inLayout />,
          children: [{ path: 'broken', lazy }],
        },
      ],
    },
  ];

  it('offers a reload when a page’s code cannot be fetched, inside the layout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    renderWithProviders(
      area(() =>
        Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
      ),
      { path: '/app/broken', user: STUDENT },
    );

    expect(
      await screen.findByRole('heading', { name: 'This page couldn’t be loaded' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/');
    // The sidebar stays usable.
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
  });

  it('explains an unexpected crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    const Crash = () => {
      throw new Error('boom');
    };
    renderWithProviders(
      area(async () => ({ Component: Crash })),
      { path: '/app/broken', user: STUDENT },
    );
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reloading usually fixes it');
  });
});
