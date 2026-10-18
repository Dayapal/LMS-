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
    <div
      role="alert"
      className="mx-auto max-w-md rounded-3xl border border-slate-200/80 bg-white/75 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
    >
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
        {!notFound && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-linear-to-r from-brand-500 to-[#029ab8] px-4 text-sm font-medium text-white shadow-xs hover:shadow-[0_0_20px_rgba(3,174,210,0.35)] transition-all"
          >
            Reload the page
          </button>
        )}
        <Link
          to="/"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-white hover:text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20 dark:hover:text-white transition-all"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );

  if (inLayout) return <div className="py-12">{content}</div>;
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="aurora-bg" aria-hidden="true" />
      {content}
    </main>
  );
}
