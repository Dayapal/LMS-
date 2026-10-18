import { Link } from 'react-router';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useCourseReports } from '../api.js';
import { courseReportPath, formatPercent } from '../format.js';
import { FilterPills, linkClass } from '../components/TrainerParts.jsx';
import { useSearch, useUrlFilters } from '../hooks.jsx';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap';
const td = 'px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap';

/** Course-wise enrollment, progress and assignment review statistics (GET /reports/courses). */
export function ReportsPage() {
  const filters = useUrlFilters({ status: 'all' });
  const { q, input } = useSearch(filters, 'Search courses');
  const status = filters.get('status');
  const params = {
    page: filters.page,
    limit: 50,
    ...(status !== 'all' && { status }),
    ...(q && { q }),
  };
  const { data, isPending, isError, error, refetch, isFetching } = useCourseReports(params);
  const totals = data?.meta.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Enrollments, class progress and assignment review statistics for each course. Open a course for its students and assignments."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          label="Course status"
          options={STATUS_TABS}
          value={status}
          onChange={(value) => filters.update({ status: value })}
        />
        {input}
      </div>

      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={q || status !== 'all' ? 'No courses match' : 'No courses yet'}>
          {q || status !== 'all'
            ? 'Try a different search or status.'
            : 'Reports appear once you create a course.'}
        </EmptyState>
      ) : (
        <>
          <div
            className={`overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs ${isFetching ? 'opacity-70' : ''}`}
          >
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <caption className="sr-only">Course reports</caption>
              <thead className="bg-slate-50/70 dark:bg-slate-800/50">
                <tr>
                  <th scope="col" className={th}>
                    Course
                  </th>
                  <th scope="col" className={th}>
                    Enrolled
                  </th>
                  <th scope="col" className={th}>
                    Requests
                  </th>
                  <th scope="col" className={th}>
                    Average progress
                  </th>
                  <th scope="col" className={th}>
                    Completed
                  </th>
                  <th scope="col" className={th}>
                    Assignments
                  </th>
                  <th scope="col" className={th}>
                    To review
                  </th>
                  <th scope="col" className={th}>
                    Sent back
                  </th>
                  <th scope="col" className={th}>
                    Reviewed
                  </th>
                  <th scope="col" className={th}>
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data.items.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <th scope="row" className="px-3 py-2.5 text-left text-sm font-normal">
                      <div className="flex items-center gap-2">
                        <Link to={courseReportPath(course.id)} className={linkClass}>
                          {course.title}
                        </Link>
                        {course.status !== 'published' && <StatusBadge status={course.status} />}
                      </div>
                    </th>
                    <td className={td}>{course.enrollments.active}</td>
                    <td className={td}>{course.enrollments.pending}</td>
                    <td className={td}>{formatPercent(course.progress.averagePercent)}</td>
                    <td className={td}>{course.progress.completedStudents}</td>
                    <td className={td}>{course.assignments.published}</td>
                    <td className={td}>{course.reviews.submitted}</td>
                    <td className={td}>{course.reviews.resubmit_requested}</td>
                    <td className={td}>{course.reviews.reviewed}</td>
                    <td className={`${td} ${course.overdue ? 'font-medium text-red-700 dark:text-red-400' : ''}`}>
                      {course.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-white/10">
                <tr>
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Totals ({totals.courses} course{totals.courses === 1 ? '' : 's'} shown)
                  </th>
                  <td className={`${td} font-semibold`}>{totals.enrollments.active}</td>
                  <td className={`${td} font-semibold`}>{totals.enrollments.pending}</td>
                  <td className={td}>—</td>
                  <td className={`${td} font-semibold`}>{totals.completedEnrollments}</td>
                  <td className={`${td} font-semibold`}>{totals.publishedAssignments}</td>
                  <td className={`${td} font-semibold`}>{totals.reviews.submitted}</td>
                  <td className={`${td} font-semibold`}>{totals.reviews.resubmit_requested}</td>
                  <td className={`${td} font-semibold`}>{totals.reviews.reviewed}</td>
                  <td className={`${td} font-semibold`}>{totals.overdue}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enrolled and progress count active enrollments; a student in two courses is counted in
            each. Review figures are each student&apos;s latest attempt at each assignment. Overdue
            counts assignments past their due date that an enrolled student hasn&apos;t handed in.
          </p>
          <Pagination meta={data.meta} onPageChange={(p) => filters.update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
