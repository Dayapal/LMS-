import { Link } from 'react-router';
import { useAssignments } from '../api.js';
import { formatDateTime } from '../format.js';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

const linkButton =
  'inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-cyan-500 active:scale-[0.98] transition-all';

/** Where an assignment sits in the course, from the roadmap's modules. */
function placementLabel(assignment, modules) {
  const module = modules.find((m) => m.id === assignment.moduleId);
  if (!module) return 'Whole course';
  const lesson = module.lessons.find((l) => l.id === assignment.lessonId);
  return lesson ? `${module.title} › ${lesson.title}` : module.title;
}

/** The Assignments tab of the course builder. */
export function CourseAssignmentsPanel({ courseId, modules }) {
  const { data, isPending, isError, error, refetch } = useAssignments({
    course: courseId,
    limit: 100,
  });
  const base = `/admin/courses/${courseId}/assignments`;

  return (
    <section aria-labelledby="assignments-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="assignments-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Assignments
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Students see published assignments once they are enrolled, in order of due date.
          </p>
        </div>
        <Link to={`${base}/new`} className={linkButton}>
          New assignment
        </Link>
      </div>

      {isPending ? (
        <Skeleton className="h-32" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No assignments yet">
          Create an assignment for the whole course, a module or a single lesson.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs">
          {data.items.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`${base}/${assignment.id}`}
                  className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline transition-colors"
                >
                  {assignment.title}
                </Link>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {placementLabel(assignment, modules)} · Due {formatDateTime(assignment.dueAt)}
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-600 dark:text-slate-400">
                {assignment.stats.students} submitted
                {assignment.stats.awaitingReview > 0 && (
                  <span className="font-semibold text-brand-700 dark:text-cyan-400">
                    {' '}
                    · {assignment.stats.awaitingReview} to review
                  </span>
                )}
              </p>
              <StatusBadge status={assignment.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
