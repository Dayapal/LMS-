import { useEffect, useRef, useState } from 'react';
import {
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { Logo } from '../components/Logo.jsx';
import { Icon } from '../components/Icon.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useNotificationPolling } from '../features/notifications/api.js';
import { NotificationBell } from '../features/notifications/components/NotificationBell.jsx';
import { NAVIGATION, ROLE_LABEL } from './navigation.js';
import { ROLE_HOME } from '../routes/paths.js';

function SidebarNav({ items, onNavigate }) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserPanel({ user, onLogout, loggingOut }) {
  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar name={user.name} src={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );
}

/** Tells screen reader users when new notifications arrive (not on the first load). */
function useNewNotificationAnnouncement(count) {
  const [message, setMessage] = useState('');
  const previous = useRef(count);
  useEffect(() => {
    if (count !== undefined && previous.current !== undefined && count > previous.current) {
      setMessage(`You have ${count} unread notification${count === 1 ? '' : 's'}.`);
    }
    previous.current = count;
  }, [count]);
  return message;
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawerRef = useRef(null);
  const mainRef = useRef(null);
  const items = NAVIGATION[user.role] ?? [];
  const notificationsPath = `${ROLE_HOME[user.role]}/notifications`;
  const { data: unreadCount } = useNotificationPolling();
  const announcement = useNewNotificationAnnouncement(unreadCount);
  const loadingPage = navigation.state === 'loading';

  useDocumentTitle();
  useFocusTrap(drawerRef, drawerOpen, { onEscape: () => setDrawerOpen(false) });

  // A new page: close the drawer and move focus to the main region, so
  // keyboard and screen reader users start at the new content (not on the
  // first load, and not when only the query string changes).
  const firstPath = useRef(location.pathname);
  useEffect(() => {
    setDrawerOpen(false);
    if (firstPath.current === location.pathname) return;
    firstPath.current = null;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const sidebar = (bell) => (
    <>
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-5">
        <Logo />
        {bell}
      </div>
      <SidebarNav items={items} onNavigate={() => setDrawerOpen(false)} />
      <UserPanel user={user} onLogout={handleLogout} loggingOut={loggingOut} />
    </>
  );

  return (
    <div className="min-h-screen">
      <ScrollRestoration />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-70 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {loadingPage && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-70 h-1 animate-pulse bg-brand-600"
        />
      )}
      <p className="sr-only" aria-live="polite">
        {loadingPage ? 'Loading page' : ''}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {sidebar(
          <NotificationBell
            count={unreadCount}
            notificationsPath={notificationsPath}
            align="left"
          />,
        )}
      </aside>

      {drawerOpen && (
        <div
          ref={drawerRef}
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 rounded-md p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <Icon name="close" />
            </button>
            {sidebar(null)}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Icon name="menu" />
          </button>
          <Logo />
          <div className="ml-auto">
            <NotificationBell count={unreadCount} notificationsPath={notificationsPath} />
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          aria-busy={loadingPage || undefined}
          className="mx-auto w-full max-w-6xl px-4 py-8 focus:outline-none sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
