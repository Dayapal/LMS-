import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../components/ui/Feedback.jsx';
import { FilterPills } from '../../components/ui/FilterPills.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { useMarkAllRead, useMarkRead, useNotifications } from './api.js';
import { NotificationItem } from './components/NotificationItem.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

/** Every notification of the signed-in user (both roles), with an unread filter. */
export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') === 'unread' ? 'unread' : 'all';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const list = useNotifications({ page, limit: 20, status });
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const toast = useToast();
  const unread = list.data?.meta.unread ?? 0;

  const update = (changes) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value && value !== 'all' && value !== 1) next.set(key, String(value));
        else next.delete(key);
      }
      return next;
    });

  // From the button: the button disappears, so focus moves to its row.
  const read = (notification, { fromButton = false } = {}) =>
    markRead.mutate(notification.id, {
      onSuccess: () => {
        if (!fromButton) return;
        document.getElementById(`notification-${notification.id}`)?.focus();
        toast.success('Marked as read.');
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="New materials and assignments, feedback on your work and approaching deadlines."
        actions={
          unread > 0 && (
            <Button
              variant="secondary"
              loading={markAll.isPending}
              onClick={() =>
                markAll.mutate(undefined, {
                  onSuccess: () => toast.success('All notifications marked as read.'),
                  onError: (error) => toast.error(getErrorMessage(error)),
                })
              }
            >
              Mark all as read
            </Button>
          )
        }
      />

      <FilterPills
        label="Show"
        options={FILTERS}
        value={status}
        counts={{ unread: list.data ? unread : undefined }}
        onChange={(value) => update({ status: value, page: 1 })}
      />

      {list.isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={status === 'unread' ? 'No unread notifications' : 'No notifications yet'}
        >
          {status === 'unread'
            ? 'You’re all caught up.'
            : 'You’ll be told here about new study materials and assignments, reviews of your work and deadlines coming up.'}
        </EmptyState>
      ) : (
        <>
          <Card as="div">
            <ul aria-label="Notifications" className="divide-y divide-slate-100">
              {list.data.items.map((notification) => (
                <li
                  key={notification.id}
                  id={`notification-${notification.id}`}
                  tabIndex={-1}
                  className="px-5 py-4"
                >
                  <NotificationItem
                    notification={notification}
                    onOpen={(n) => !n.read && read(n)}
                    actions={
                      !notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => read(notification, { fromButton: true })}
                          aria-label={`Mark “${notification.title}” as read`}
                        >
                          Mark as read
                        </Button>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
          <Pagination meta={list.data.meta} onPageChange={(next) => update({ page: next })} />
        </>
      )}
    </div>
  );
}
