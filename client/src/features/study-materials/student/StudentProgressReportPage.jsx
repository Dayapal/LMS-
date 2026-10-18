import { Link } from 'react-router';
import { useStudentStudyReport } from '../api.js';
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

export function StudentProgressReportPage() {
  const { data: report, isLoading, error } = useStudentStudyReport();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading report..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading your learning progress report...
        </p>
      </div>
    );
  }

  // Handle restricted visibility (403 Forbidden)
  if (error) {
    const isForbidden = error?.response?.status === 403;
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 shadow-xl backdrop-blur-xl dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            {isForbidden ? 'Report Visibility Restricted' : 'Unable to Load Report'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {isForbidden
              ? 'Your trainer has temporarily disabled study progress report visibility for your account. You still retain full access to read, explore, and complete all study modules in your library.'
              : 'Failed to load progress report. Please try again later.'}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/app/study-materials"
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-cyan-600"
            >
              Back to Study Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { books = [], totalCompletedModules, totalReleasedModules, totalReadingSeconds, overallPercent } =
    report || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/app/study-materials"
          className="text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
        >
          ← Back to Study Library
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              My Study Progress Report
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Detailed tracking of your study book completions, active reading engagement, and syllabus milestones.
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Completed Modules
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalCompletedModules}
            <span className="text-sm font-normal text-slate-400"> / {totalReleasedModules}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Syllabus Completion
          </span>
          <div className="mt-2 text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {overallPercent}%
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Engaged Time
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            ⏱️ {formatReadingTime(totalReadingSeconds)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Assigned Books
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {books.length} Active
          </div>
        </div>
      </div>

      {/* Book Breakdown */}
      <div className="space-y-6">
        {books.map((bookReport) => (
          <div
            key={bookReport.book.id}
            className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]"
          >
            {/* Book header */}
            <div className="flex flex-col gap-3 border-b border-slate-200/60 p-6 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {bookReport.book.category.toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {bookReport.book.title}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>⏱️ {formatReadingTime(bookReport.readingSeconds)} spent</span>
                </div>
                <Badge tone={bookReport.percent === 100 ? 'success' : 'info'}>
                  {bookReport.completedCount} / {bookReport.releasedCount} Modules ({bookReport.percent}%)
                </Badge>
              </div>
            </div>

            {/* Modules table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold text-slate-500 dark:border-white/5 dark:bg-white/[0.01] dark:text-slate-400">
                    <th className="px-6 py-3">Module</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Reading Duration</th>
                    <th className="px-6 py-3 text-right">Completed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-xs dark:divide-white/5">
                  {bookReport.modules.map((m) => (
                    <tr
                      key={m.id}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                        <Link
                          to={`/app/study-materials/${bookReport.book.slug}/modules/${m.slug}`}
                          className="hover:text-cyan-600 dark:hover:text-cyan-400"
                        >
                          {m.phaseLabel ? `${m.phaseLabel}: ` : ''}
                          {m.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge tone={m.isCompleted ? 'success' : m.readingSeconds > 0 ? 'warning' : 'neutral'}>
                          {m.isCompleted ? '✓ Completed' : m.readingSeconds > 0 ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-300">
                        {formatReadingTime(m.readingSeconds)}
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-500 dark:text-slate-400">
                        {m.completedAt ? new Date(m.completedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
