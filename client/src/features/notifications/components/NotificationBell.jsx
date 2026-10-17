import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../../components/Icon.jsx';
import { Skeleton } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useMarkAllRead, useMarkRead, useNotifications } from '../api.js';
import { badgeText, bellLabel } from '../format.js';
import { NotificationItem } from './NotificationItem.jsx';

const PREVIEW = { page: 1, limit: 6, status: 'all' };

function Panel({ id, headingId, notificationsPath, onClose }) {
  const toast = useToast();
  const list = useNotifications(PREVIEW);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = list.data?.meta.unread ?? 0;
  const headingRef = useRef(null);

  useEffect(() => headingRef.current?.focus(), []);

  const open = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    onClose({ restoreFocus: false });
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={headingId}
      className="flex max-h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-slate-200 bg-white text-left shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold text-slate-900 focus:outline-none"
        >
          Notifications
        </h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={() =>
              markAll.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })
            }
            disabled={markAll.isPending}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.isPending ? (
          <div className="space-y-3 p-4" aria-label="Loading notifications" role="status">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : list.isError ? (
          <div role="alert" className="p-4 text-sm text-red-800">
            <p>{getErrorMessage(list.error, 'Notifications could not be loaded.')}</p>
            <button
              type="button"
              onClick={() => list.refetch()}
              className="mt-2 font-medium text-brand-700 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : list.data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600">
            You’re all caught up. New notifications will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.data.items.map((notification) => (
              <li key={notification.id} className="px-4 py-3">
                <NotificationItem notification={notification} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-2.5">
        <Link
          to={notificationsPath}
          onClick={() => onClose({ restoreFocus: false })}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}

/**
 * The bell with the unread count, opening a panel with the latest
 * notifications. It's a non-modal popup: Escape or a click outside closes it
 * and returns focus to the bell; Tab can leave it. `count` comes from the
 * layout's single poll.
 */
export function NotificationBell({ count, notificationsPath, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const headingId = useId();

  const close = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onFocusIn = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={bellLabel(count)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white"
          >
            {badgeText(count)}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-2 ${align === 'left' ? 'left-0' : 'right-0'}`}>
          <Panel
            id={panelId}
            headingId={headingId}
            notificationsPath={notificationsPath}
            onClose={close}
          />
        </div>
      )}
    </div>
  );
}
