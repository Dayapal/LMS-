import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { FullPageSpinner } from '../components/ui/Spinner.jsx';
import { homeFor, safeRedirect } from './paths.js';

/**
 * Shows its child routes only to signed-in users with one of `roles`.
 * This is a UX guard; the API enforces every permission itself.
 */
export function RequireAuth({ roles }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** Login and register pages: signed-in users go straight to their dashboard. */
export function GuestOnly() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') {
    return <Navigate to={safeRedirect(user, location.state?.from)} replace />;
  }
  return <Outlet />;
}

export function HomeRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  return <Navigate to={homeFor(user)} replace />;
}
