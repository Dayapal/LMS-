import { Link } from 'react-router';
import { useStudentStudyBooks } from '../api.js';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

export function StudyLibraryPage() {
  const { data: books, isLoading, error } = useStudentStudyBooks();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading books..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading your study library...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-[#D12052] dark:text-rose-300">
        Failed to load study library. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Study Materials & Books
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Access your interactive study handbooks, deep-dive modules, and code references.
        </p>
      </div>

      {/* 3 Categories Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {books?.map((book) => (
          <div
            key={book.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]"
          >
            {/* Top decorative gradient bar */}
            <div
              className="absolute inset-x-0 top-0 h-2 opacity-90 transition-opacity"
              style={{ background: book.gradient }}
            />

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {book.category.toUpperCase()}
                </span>
                <Badge tone={book.isAssigned ? 'info' : 'neutral'}>
                  {book.isAssigned ? `${book.releasedModulesCount} Unlocked` : 'Not Assigned'}
                </Badge>
              </div>

              <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {book.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {book.description}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-200/60 pt-4 dark:border-white/10">
              <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Available Content</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {book.releasedModulesCount} of {book.totalModules} modules
                </span>
              </div>

              {book.isAssigned && book.releasedModulesCount > 0 ? (
                <Link
                  to={`/app/study-materials/${book.slug}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 py-3 text-xs font-semibold text-white shadow-md transition-all hover:opacity-95"
                >
                  <span>Open Book & Roadmap</span>
                  <span>→</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-semibold text-slate-400 dark:border-white/5 dark:bg-white/5"
                >
                  🔒 Locked by Trainer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
