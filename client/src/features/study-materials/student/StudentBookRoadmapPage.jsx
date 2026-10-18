import { Link, useParams } from 'react-router';
import { useStudentStudyBookDetail } from '../api.js';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

function formatReadingTime(seconds = 0) {
  if (!seconds) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

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
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {book.description}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Badge tone="info">
              {book.completedCount} of {book.releasedCount} Completed ({book.overallPercent}%)
            </Badge>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 mt-1">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                style={{ width: `${book.overallPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
        <div className="divide-y divide-slate-200/60 dark:divide-white/5">
          {book.modules.map((m) => {
            const isCompleted = m.readingProgress?.isCompleted;
            const inProgress = !isCompleted && (m.readingProgress?.totalReadingSeconds > 0);

            return (
              <div
                key={m.id}
                className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  m.isReleased
                    ? isCompleted
                      ? 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] dark:bg-emerald-500/[0.02]'
                      : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
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
                    {isCompleted && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Completed
                      </span>
                    )}
                    {inProgress && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        In Progress
                      </span>
                    )}
                    {!m.isReleased && <Badge tone="warning">Locked</Badge>}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>~{m.estimatedMinutes} mins reading</span>
                    {m.readingProgress?.totalReadingSeconds > 0 && (
                      <span>• ⏱️ {formatReadingTime(m.readingProgress.totalReadingSeconds)} read</span>
                    )}
                    {m.linkedAssignment && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-cyan-600 dark:text-cyan-400">
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
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs transition-all ${
                        isCompleted
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-cyan-500 text-white hover:bg-cyan-600 hover:shadow-md'
                      }`}
                    >
                      <span>{isCompleted ? 'Review Module' : inProgress ? 'Continue Reading' : 'Read Module'}</span>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}

