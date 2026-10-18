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
      className="flex max-h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-2xl border border-slate-200/80 bg-white/95 text-left shadow-[0_15px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/15 dark:bg-[#0d1527]/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/10">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold text-slate-900 focus:outline-none dark:text-white"
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
            className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10 disabled:opacity-50 dark:text-cyan-400 dark:hover:bg-cyan-500/15"
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
          <div role="alert" className="p-4 text-sm text-rose-800 dark:text-rose-300">
            <p>{getErrorMessage(list.error, 'Notifications could not be loaded.')}</p>
            <button
              type="button"
              onClick={() => list.refetch()}
              className="mt-2 font-medium text-brand-600 hover:underline dark:text-cyan-400"
            >
              Try again
            </button>
          </div>
        ) : list.data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
            You’re all caught up. New notifications will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {list.data.items.map((notification) => (
              <li key={notification.id} className="px-4 py-3">
                <NotificationItem notification={notification} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
        <Link
          to={notificationsPath}
          onClick={() => onClose({ restoreFocus: false })}
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
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
        className="relative rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D12052] px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_8px_rgba(209,32,82,0.6)]"
          >
            {badgeText(count)}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-2.5 ${align === 'left' ? 'left-0' : 'right-0'}`}>
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
