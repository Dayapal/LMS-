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
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useNotificationPolling } from '../features/notifications/api.js';
import { NotificationBell } from '../features/notifications/components/NotificationBell.jsx';
import { NAVIGATION, ROLE_LABEL } from './navigation.js';
import { ROLE_HOME } from '../routes/paths.js';

function SidebarNav({ items, onNavigate }) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-1.5 px-3.5 py-4">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-linear-to-r from-brand-500/15 to-[#D12052]/15 text-brand-600 border border-brand-500/30 shadow-[0_0_15px_rgba(3,174,210,0.15)] font-semibold dark:border-cyan-500/30 dark:text-cyan-400 dark:shadow-[0_0_18px_rgba(3,174,210,0.22)]'
                : 'text-slate-600 border border-transparent hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
            }`
          }
        >
          <Icon name={item.icon} className="size-5 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function UserPanel({ user, onLogout, loggingOut }) {
  return (
    <div className="border-t border-slate-200/70 p-3.5 dark:border-white/10">
      <div className="flex items-center gap-3 rounded-xl bg-white/50 p-2 backdrop-blur-xs transition-colors dark:bg-white/[0.04]">
        <Avatar name={user.name} src={user.avatarUrl} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{ROLE_LABEL[user.role]}</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle className="h-8 w-8" />
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-[#D12052] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            aria-label="Log out"
            title="Log out"
          >
            <Icon name="logout" className="size-4.5" />
          </button>
        </div>
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
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200/70 px-5 dark:border-white/10">
        <Logo />
        {bell}
      </div>
      <SidebarNav items={items} onNavigate={() => setDrawerOpen(false)} />
      <UserPanel user={user} onLogout={handleLogout} loggingOut={loggingOut} />
    </>
  );

  return (
    <div className="relative min-h-screen selection:bg-brand-500/20 selection:text-brand-600">
      <ScrollRestoration />
      {/* Decorative ambient aurora background for glassmorphic depth */}
      <div className="aurora-bg" aria-hidden="true" />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-70 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2.5 focus:shadow-xl dark:focus:bg-slate-900 dark:focus:text-white"
      >
        Skip to content
      </a>

      {loadingPage && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-70 h-1 animate-pulse bg-linear-to-r from-brand-500 via-[#F8DE22] to-[#D12052]"
        />
      )}
      <p className="sr-only" aria-live="polite">
        {loadingPage ? 'Loading page' : ''}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col border-r border-slate-200/80 bg-white/70 shadow-[4px_0_24px_rgba(0,0,0,0.02)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0f1e]/85 dark:shadow-[4px_0_30px_rgba(0,0,0,0.4)] lg:flex">
        {sidebar(
          <NotificationBell
            count={unreadCount}
            notificationsPath={notificationsPath}
            align="left"
          />,
        )}
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div
          ref={drawerRef}
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-[#0a0f1e]/95">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close navigation"
            >
              <Icon name="close" />
            </button>
            {sidebar(null)}
          </aside>
        </div>
      )}

      {/* Main page content area */}
      <div className="lg:pl-68">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0f1e]/85 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Icon name="menu" />
          </button>
          <Logo />
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle className="h-8 w-8" />
            <NotificationBell count={unreadCount} notificationsPath={notificationsPath} />
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          aria-busy={loadingPage || undefined}
          className="mx-auto w-full max-w-7xl px-4 py-8 focus:outline-none sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
