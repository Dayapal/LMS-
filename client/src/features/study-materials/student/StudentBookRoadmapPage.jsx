import { Link, useParams } from 'react-router';
import { useStudentStudyBookDetail } from '../api.js';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

export function StudentBookRoadmapPage() {
  const { bookSlug } = useParams();
  const { data: book, isLoading, error } = useStudentStudyBookDetail(bookSlug);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading book roadmap..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading module syllabus...
        </p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-[#D12052] dark:text-rose-300">
        Book not found or access not granted.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          to="/app/study-materials"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-700 dark:text-cyan-400"
        >
          <span>← Back to Study Library</span>
        </Link>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {book.description}
            </p>
          </div>
          <Badge tone="info" className="self-start sm:self-auto">
            {book.releasedCount} of {book.totalCount} Unlocked
          </Badge>
        </div>
      </div>

      {/* Modules List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
        <div className="divide-y divide-slate-200/60 dark:divide-white/5">
          {book.modules.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                m.isReleased
                  ? 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
                  : 'bg-slate-50/40 opacity-70 dark:bg-white/[0.01]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {m.phaseLabel && (
                    <span className="rounded-lg bg-cyan-500/15 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                      {m.phaseLabel}
                    </span>
                  )}
                  <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                    {m.title}
                  </h3>
                  {!m.isReleased && <Badge tone="warning">Locked</Badge>}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>~{m.estimatedMinutes} mins reading</span>
                  {m.linkedAssignment && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-600 dark:text-cyan-400">
                        Linked Assignment: {m.linkedAssignment.title}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                {m.isReleased ? (
                  <Link
                    to={`/app/study-materials/${book.slug}/modules/${m.slug}`}
                    className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-cyan-600 hover:shadow-md"
                  >
                    <span>Read Module</span>
                    <span>→</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <span>🔒</span>
                    <span>{m.lockReason || 'Locked'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
