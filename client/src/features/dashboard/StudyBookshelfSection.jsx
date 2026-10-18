import { Link } from 'react-router';
import { useStudentStudySummary } from '../study-materials/api.js';
import { Badge } from '../../components/ui/Badge.jsx';

function formatReadingTime(seconds = 0) {
  if (!seconds) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function StudyBookshelfSection() {
  const { data: summary, isLoading, isError } = useStudentStudySummary();

  if (isLoading || isError || !summary || summary.totalAssignedBooks === 0) {
    return null;
  }

  const {
    continueModule,
    books,
    totalCompletedModules,
    totalReleasedModules,
    overallPercent,
    totalReadingSeconds,
  } = summary;

  return (
    <section aria-labelledby="study-bookshelf-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="study-bookshelf-heading"
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Study Books & Bookshelf
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totalCompletedModules} of {totalReleasedModules} modules completed ({overallPercent}%)
            · ⏱️ {formatReadingTime(totalReadingSeconds)} total read
          </p>
        </div>
        <Link
          to="/app/study-materials"
          className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          View Library →
        </Link>
      </div>

      {continueModule && (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 backdrop-blur-xl dark:border-cyan-500/20 dark:bg-cyan-500/[0.04] sm:flex-row sm:items-center">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Resume Study
            </span>
            <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
              {continueModule.phaseLabel ? `${continueModule.phaseLabel}: ` : ''}
              {continueModule.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              in {continueModule.bookTitle}
            </p>
          </div>
          <Link
            to={`/app/study-materials/${continueModule.bookSlug}/modules/${continueModule.slug}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-cyan-600"
          >
            <span>Resume Reading</span>
            <span>→</span>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {books.map((b) => (
          <div
            key={b.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {b.category.toUpperCase()}
                </span>
                <Badge tone={b.isAssigned ? 'info' : 'neutral'} className="text-[10px]">
                  {b.isAssigned ? `${b.releasedModulesCount} Unlocked` : 'Locked'}
                </Badge>
              </div>
              <h4 className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
                {b.title}
              </h4>
              {b.isAssigned && b.releasedModulesCount > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {b.completedModulesCount}/{b.releasedModulesCount} completed
                    </span>
                    <span>{b.overallProgressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${b.overallProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-2 dark:border-white/5">
              {b.isAssigned && b.releasedModulesCount > 0 ? (
                <Link
                  to={`/app/study-materials/${b.slug}`}
                  className="flex items-center justify-between text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
                >
                  <span>Open Book</span>
                  <span>→</span>
                </Link>
              ) : (
                <span className="text-xs text-slate-400">Not assigned yet</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

