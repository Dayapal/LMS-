import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardLayout } from '../../layouts/DashboardLayout.jsx';
import { NotificationsPage } from './NotificationsPage.jsx';
import { notificationKeys, notificationsApi, POLL_INTERVAL_MS } from './api.js';
import { badgeText, bellLabel, safeLink } from './format.js';
import { STUDENT } from '../courses/test-fixtures.js';
import { apiError, renderWithProviders } from '../../test/renderWithProviders.jsx';

const makeNotification = (overrides = {}) => ({
  id: 'n1',
  type: 'submission_reviewed',
  title: 'Feedback on Portfolio page',
  body: 'Your trainer reviewed attempt 1.',
  link: '/app/courses/c1/assignments/a1',
  read: false,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  ...overrides,
});

const listOf = (items, meta = {}) => ({
  items,
  meta: {
    page: 1,
    limit: 20,
    total: items.length,
    totalPages: 1,
    unread: items.filter((n) => !n.read).length,
    ...meta,
  },
});

const routes = [
  {
    path: '/app',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <h1>Student home</h1> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'courses/c1/assignments/a1', element: <h1>Assignment page</h1> },
    ],
  },
];
const open = (path = '/app') => renderWithProviders(routes, { path, user: STUDENT });

// Both the sidebar and the mobile header have a bell; jsdom shows both.
const bell = async (name = /^Notifications/) => (await screen.findAllByRole('button', { name }))[0];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('notification helpers', () => {
  it('labels the bell with the count and caps the badge', () => {
    expect(bellLabel(0)).toBe('Notifications');
    expect(bellLabel(undefined)).toBe('Notifications');
    expect(bellLabel(3)).toBe('Notifications, 3 unread');
    expect(badgeText(9)).toBe('9');
    expect(badgeText(12)).toBe('12');
    expect(badgeText(100)).toBe('99+');
    // The name always contains the visible badge text.
    expect(bellLabel(12)).toBe('Notifications, 12 unread');
    expect(bellLabel(150)).toBe('Notifications, 99+ unread');
  });

  it('follows in-app paths only', () => {
    expect(safeLink('/app/courses/c1')).toBe('/app/courses/c1');
    expect(safeLink('//evil.example/x')).toBeNull();
    expect(safeLink('https://evil.example')).toBeNull();
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});

describe('notification bell', () => {
  it('polls the unread count once for the whole layout, every minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const count = vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(2);
    open();

    expect(await bell('Notifications, 2 unread')).toBeInTheDocument();
    expect(count).toHaveBeenCalledTimes(1);

    count.mockResolvedValue(3);
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(await bell('Notifications, 3 unread')).toBeInTheDocument();
    expect(count).toHaveBeenCalledTimes(2);
    // The new arrival is announced once, politely.
    expect(screen.getByText('You have 3 unread notifications.')).toBeInTheDocument();
  });

  it('opens the latest notifications; Escape closes them and returns focus to the bell', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    const list = vi
      .spyOn(notificationsApi, 'list')
      .mockResolvedValue(
        listOf([makeNotification(), makeNotification({ id: 'n2', read: true, title: 'Older' })]),
      );
    open();

    const button = await bell('Notifications, 1 unread');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByRole('heading', { name: 'Notifications' })).toHaveFocus();
    expect(list.mock.calls[0][0]).toEqual({ page: 1, limit: 6, status: 'all' });

    const unread = await within(panel).findByRole('link', {
      name: 'Feedback on Portfolio page (unread)',
    });
    expect(unread).toHaveAttribute('href', '/app/courses/c1/assignments/a1');
    expect(within(panel).getByRole('link', { name: 'Older' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'View all notifications' })).toHaveAttribute(
      'href',
      '/app/notifications',
    );

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click outside', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    vi.spyOn(notificationsApi, 'list').mockResolvedValue(listOf([]));
    open();
    await userEvent.click(await bell());
    expect(await screen.findByText(/You’re all caught up/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('heading', { name: 'Student home' }));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('opening a notification marks it read and goes to what it is about', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    vi.spyOn(notificationsApi, 'list').mockResolvedValue(listOf([makeNotification()]));
    const markRead = vi
      .spyOn(notificationsApi, 'markRead')
      .mockResolvedValue({ notification: makeNotification({ read: true }), unread: 0 });
    open();

    await userEvent.click(await bell('Notifications, 1 unread'));
    await userEvent.click(
      await screen.findByRole('link', { name: 'Feedback on Portfolio page (unread)' }),
    );
    expect(await screen.findByRole('heading', { name: 'Assignment page' })).toBeInTheDocument();
    expect(markRead.mock.calls[0][0]).toBe('n1');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(await bell('Notifications')).toBeInTheDocument();
  });

  it('marks everything read', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(2);
    vi.spyOn(notificationsApi, 'list')
      .mockResolvedValueOnce(listOf([makeNotification(), makeNotification({ id: 'n2' })]))
      .mockResolvedValue(listOf([makeNotification({ read: true })]));
    const markAll = vi.spyOn(notificationsApi, 'markAllRead').mockResolvedValue({ updated: 2 });
    open();

    await userEvent.click(await bell('Notifications, 2 unread'));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(markAll).toHaveBeenCalledTimes(1);
    expect(await bell('Notifications')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument(),
    );
  });

  it('shows an error with a retry, and never links outside the app', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    vi.spyOn(notificationsApi, 'list')
      .mockRejectedValueOnce(apiError(500, 'Server down'))
      .mockResolvedValue(listOf([makeNotification({ link: '//evil.example', title: 'Odd' })]));
    open();

    await userEvent.click(await bell('Notifications, 1 unread'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Server down');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Odd')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Odd/ })).not.toBeInTheDocument();
  });

  it('refreshes an open list when a poll finds new notifications', async () => {
    const count = vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    const list = vi.spyOn(notificationsApi, 'list').mockResolvedValue(listOf([makeNotification()]));
    const { queryClient } = open();
    await userEvent.click(await bell('Notifications, 1 unread'));
    await screen.findByRole('link', { name: /Feedback on Portfolio page/ });
    expect(list).toHaveBeenCalledTimes(1);

    count.mockResolvedValue(2);
    await act(() => queryClient.refetchQueries({ queryKey: notificationKeys.count }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});

describe('NotificationsPage', () => {
  it('lists notifications, filters unread ones and pages through them', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    const list = vi
      .spyOn(notificationsApi, 'list')
      .mockResolvedValue(listOf([makeNotification()], { total: 25, totalPages: 2 }));
    open('/app/notifications');

    const items = await screen.findByRole('list', { name: 'Notifications' });
    expect(
      within(items).getByRole('link', { name: 'Feedback on Portfolio page (unread)' }),
    ).toBeInTheDocument();
    expect(list.mock.calls[0][0]).toEqual({ page: 1, limit: 20, status: 'all' });

    await userEvent.click(screen.getByRole('button', { name: /^Unread/ }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)[0]).toEqual({ page: 1, limit: 20, status: 'unread' }),
    );
    expect(screen.getByRole('button', { name: /^Unread/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)[0]).toEqual({ page: 2, limit: 20, status: 'unread' }),
    );
  });

  it('marks one as read, keeping focus on its row', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    vi.spyOn(notificationsApi, 'list').mockResolvedValue(listOf([makeNotification()]));
    const markRead = vi
      .spyOn(notificationsApi, 'markRead')
      .mockResolvedValue({ notification: makeNotification({ read: true }), unread: 0 });
    open('/app/notifications');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as read: Feedback on Portfolio page' }),
    );
    expect(markRead.mock.calls[0][0]).toBe('n1');
    expect(await screen.findByText('Marked as read.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Feedback on Portfolio page' })).toBeInTheDocument();
    expect(document.getElementById('notification-n1')).toHaveFocus();
    expect(await bell('Notifications')).toBeInTheDocument();
  });

  it('marks all as read from the page header', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1);
    vi.spyOn(notificationsApi, 'list').mockResolvedValue(listOf([makeNotification()]));
    const markAll = vi.spyOn(notificationsApi, 'markAllRead').mockResolvedValue({ updated: 1 });
    open('/app/notifications');

    const main = await screen.findByRole('main');
    await userEvent.click(await within(main).findByRole('button', { name: 'Mark all as read' }));
    expect(markAll).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('All notifications marked as read.')).toBeInTheDocument();
  });

  it('explains an empty list and an error', async () => {
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(0);
    const list = vi
      .spyOn(notificationsApi, 'list')
      .mockResolvedValueOnce(listOf([]))
      .mockRejectedValueOnce(apiError(500, 'Server down'))
      .mockResolvedValue(listOf([]));
    open('/app/notifications');

    expect(
      await screen.findByRole('heading', { name: 'No notifications yet' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Unread/ }));
    expect(await screen.findByText('Server down')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'No unread notifications' }),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(3);
  });
});
