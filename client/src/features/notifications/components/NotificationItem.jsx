import { Link } from 'react-router';
import { formatDateTime, relativeTime } from '../../assignments/format.js';
import { safeLink } from '../format.js';

/**
 * One notification. The title links to what it is about; following it marks
 * it read (`onOpen`). Unread ones have a dot and say so to screen readers.
 */
export function NotificationItem({ notification, onOpen, actions }) {
  const link = safeLink(notification.link);
  const unread = !notification.read;
  // The hidden word comes after the title: as the first piece of the link it
  // would sit a pixel outside it, where test tools aim their clicks.
  const title = (
    <>
      {notification.title}
      {unread && <span className="sr-only"> (unread)</span>}
    </>
  );

  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full transition-all ${
          unread
            ? 'bg-brand-500 shadow-[0_0_8px_rgba(3,174,210,0.6)] dark:bg-cyan-400'
            : 'bg-transparent'
        }`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm wrap-break-word ${
            unread ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {link ? (
            <Link
              to={link}
              onClick={() => onOpen?.(notification)}
              className="transition-colors hover:text-brand-600 dark:hover:text-cyan-400 hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {notification.body && (
          <p className="mt-0.5 text-sm wrap-break-word text-slate-600 dark:text-slate-400">{notification.body}</p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          <time dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
            {relativeTime(notification.createdAt)}
          </time>
        </p>
      </div>
      {actions}
    </div>
  );
}
