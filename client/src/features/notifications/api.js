import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';

// Spec D6: the unread count is polled once a minute, and only while the tab is visible.
export const POLL_INTERVAL_MS = 60_000;

export const notificationKeys = {
  all: ['notifications'],
  count: ['notifications', 'count'],
  lists: ['notifications', 'list'],
  list: (params) => ['notifications', 'list', params],
};

export const notificationsApi = {
  unreadCount: () => http.get('/notifications/unread-count').then((res) => res.data.data.count),
  list: (params) =>
    http
      .get('/notifications', { params })
      .then((res) => ({ items: res.data.data, meta: res.data.meta })),
  markRead: (id) =>
    http
      .patch(`/notifications/${id}/read`)
      .then((res) => ({ notification: res.data.data, unread: res.data.meta.unread })),
  markAllRead: () => http.patch('/notifications/read-all').then((res) => res.data.data),
};

/**
 * The signed-in user's unread count, refreshed every minute while the tab is
 * visible and when the user comes back to it. Call it once (the layout does)
 * and pass the number down. When a poll finds more unread than before, open
 * notification lists refresh too, so new ones appear without a reload. (Lower
 * counts come from the user's own actions, which update the lists directly.)
 */
export function useNotificationPolling() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: notificationKeys.count,
    queryFn: async () => {
      const count = await notificationsApi.unreadCount();
      const known = queryClient.getQueryData(notificationKeys.count);
      if (known !== undefined && count > known) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.lists });
      }
      return count;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

/** One page of notifications. Its `meta.unread` also updates the badge, saving a request. */
export function useNotifications(params, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      const result = await notificationsApi.list(params);
      queryClient.setQueryData(notificationKeys.count, result.meta.unread);
      return result;
    },
    placeholderData: keepPreviousData,
    // Opening the list always shows the latest.
    staleTime: 0,
    enabled,
  });
}

/** Marks one notification read in every cached list and sets the badge from the server's count. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: ({ notification, unread }) => {
      queryClient.setQueryData(notificationKeys.count, unread);
      queryClient.setQueriesData({ queryKey: notificationKeys.lists }, (list) =>
        list
          ? {
              ...list,
              items: list.items.map((item) => (item.id === notification.id ? notification : item)),
            }
          : list,
      );
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.count, 0);
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists });
    },
  });
}
