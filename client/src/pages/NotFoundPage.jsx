import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export function NotFoundPage() {
  useDocumentTitle();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="aurora-bg" aria-hidden="true" />
      <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-w-md w-full">
        <span className="inline-flex items-center rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold text-brand-600 dark:text-cyan-400">
          404
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This page does not exist or has moved.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-linear-to-r from-brand-500 to-[#029ab8] px-5 text-sm font-medium text-white shadow-xs hover:shadow-[0_0_20px_rgba(3,174,210,0.35)] transition-all"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
