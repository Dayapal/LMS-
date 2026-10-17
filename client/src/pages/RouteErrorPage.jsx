import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

// What browsers say when a lazily loaded page's file can't be fetched (offline,
// or a new release replaced it).
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i;

/**
 * Shown instead of a page that failed to load or crashed. Inside the
 * dashboard (`inLayout`) the sidebar stays usable around it.
 */
export function RouteErrorPage({ inLayout = false }) {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const offline = error instanceof Error && CHUNK_ERROR.test(error.message);

  const title = notFound
    ? 'Page not found'
    : offline
      ? 'This page couldn’t be loaded'
      : 'Something went wrong';
  const message = notFound
    ? 'This page does not exist or has moved.'
    : offline
      ? 'Check your connection and reload. If the app was just updated, reloading fetches the new version.'
      : 'An unexpected error stopped this page. Reloading usually fixes it; your saved work is not affected.';

  const content = (
    <div role="alert" className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {!notFound && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Reload the page
          </button>
        )}
        <Link
          to="/"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );

  if (inLayout) return <div className="py-12">{content}</div>;
  return <main className="flex min-h-screen items-center justify-center px-4">{content}</main>;
}
