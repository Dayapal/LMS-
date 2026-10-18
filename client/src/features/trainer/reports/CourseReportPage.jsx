import { Link, useParams } from 'react-router';
import { formatDateTime, formatMarks, relativeTime } from '../../assignments/format.js';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { StatTile } from '../../../components/ui/StatTile.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useCourseReport } from '../api.js';
import { assignmentAdminPath, formatPercent, studentPath } from '../format.js';
import { BarList, FilterPills, FilterSelect, linkClass } from '../components/TrainerParts.jsx';
import { useSearch, useUrlFilters } from '../hooks.jsx';

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap';
const td = 'px-3 py-2.5 text-sm text-slate-700 tabular-nums whitespace-nowrap';

function AssignmentsTable({ courseId, assignments }) {
  if (assignments.length === 0) {
    return (
      <CardBody>
        <p className="text-sm text-slate-500">This course has no assignments yet.</p>
      </CardBody>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <caption className="sr-only">Assignment statistics</caption>
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className={th}>
              Assignment
            </th>
            <th scope="col" className={th}>
              Due
            </th>
            <th scope="col" className={th}>
              Handed in
            </th>
            <th scope="col" className={th}>
              Overdue
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
              Average marks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.map((a) => (
            <tr key={a.id}>
              <th scope="row" className="px-3 py-2.5 text-left text-sm font-normal">
                <div className="flex items-center gap-2">
                  <Link to={assignmentAdminPath(courseId, a.id)} className={linkClass}>
                    {a.title}
                  </Link>
                  {a.status !== 'published' && <StatusBadge status={a.status} />}
                </div>
              </th>
              <td className={td}>{formatDateTime(a.dueAt)}</td>
              <td className={td}>
                {a.stats.openToStudents
                  ? `${a.stats.handedIn} of ${a.stats.expected}`
                  : a.stats.students}
              </td>
              <td className={`${td} ${a.stats.overdue ? 'font-medium text-red-700' : ''}`}>
                {a.stats.openToStudents ? a.stats.overdue : '—'}
              </td>
              <td className={td}>{a.stats.submitted}</td>
              <td className={td}>{a.stats.resubmit_requested}</td>
              <td className={td}>{a.stats.reviewed}</td>
              <td className={td}>{formatMarks(a.stats.averageMarks, a.maxMarks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ENROLLMENT_TABS = [
  { value: 'active', label: 'Enrolled' },
  { value: 'pending', label: 'Requests' },
  { value: 'removed', label: 'Removed' },
];

function StudentsTable({ report, filters, searchInput, isFetching }) {
  const enrollment = filters.get('enrollment');
  const sort = filters.get('sort');
  const { students, meta, course } = report;
  return (
    <Card aria-label="Students">
      <CardHeader title="Students" />
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <FilterPills
          label="Enrollment"
          options={ENROLLMENT_TABS}
          value={enrollment}
          counts={course.enrollments}
          onChange={(value) => filters.update({ enrollment: value })}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {searchInput}
          <FilterSelect
            label="Order"
            value={sort}
            onChange={(value) => filters.update({ sort: value })}
          >
            <option value="name">Name</option>
            <option value="progress_desc">Most progress</option>
            <option value="progress_asc">Least progress</option>
            <option value="recent">Recently studied</option>
          </FilterSelect>
        </div>
      </div>
      {students.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">No students here.</p>
        </CardBody>
      ) : (
        <ul className={`divide-y divide-slate-100 ${isFetching ? 'opacity-70' : ''}`}>
          {students.map((row) => (
            <li
              key={row.enrollmentId}
              className="grid gap-2 px-5 py-3 sm:px-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <Link to={studentPath(row.student.id)} className={`${linkClass} text-sm`}>
                  {row.student.name}
                </Link>
                <p className="truncate text-xs text-slate-500">{row.student.email}</p>
              </div>
              {row.progress ? (
                <div className="space-y-1">
                  <ProgressBar
                    value={row.progress.percent}
                    label={`${row.student.name} progress`}
                    size="sm"
                  />
                  <p className="text-xs text-slate-600">
                    {row.progress.percent}% · {row.progress.completedLessons} of{' '}
                    {row.progress.totalLessons} lessons
                    {row.lastAccessedAt && ` · studied ${relativeTime(row.lastAccessedAt)}`}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Requested {relativeTime(row.requestedAt)}</p>
              )}
              <div className="flex flex-wrap gap-2 md:justify-end">
                {row.reviews.submitted > 0 && (
                  <Badge tone="info">{row.reviews.submitted} to review</Badge>
                )}
                {row.overdue > 0 && <Badge tone="danger">{row.overdue} overdue</Badge>}
                {row.reviews.reviewed > 0 && (
                  <Badge tone="success">{row.reviews.reviewed} reviewed</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3 sm:px-6">
        <Pagination meta={meta} onPageChange={(p) => filters.update({ page: String(p) })} />
      </div>
    </Card>
  );
}

/** One course's report (GET /reports/courses/:id). */
export function CourseReportPage() {
  const { courseId } = useParams();
  const filters = useUrlFilters({ enrollment: 'active', sort: 'name' });
  const { q, input } = useSearch(filters, 'Search students');
  const params = {
    page: filters.page,
    limit: 20,
    enrollment: filters.get('enrollment'),
    sort: filters.get('sort'),
    ...(q && { q }),
  };
  const { data, isPending, isError, error, refetch, isFetching } = useCourseReport(
    courseId,
    params,
  );

  if (isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading report">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (isError) {
    const notFound = error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This course does not exist.' : getErrorMessage(error)}
          onRetry={notFound ? undefined : refetch}
        />
        <Link
          to="/admin/reports"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Reports
        </Link>
      </div>
    );
  }

  const { course, distribution, modules, assignments } = data;
  const { progress } = course;

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={`${course.lessons} published lesson${course.lessons === 1 ? '' : 's'} in ${course.modules} module${course.modules === 1 ? '' : 's'}`}
        actions={
          <Link
            to={`/admin/courses/${course.id}`}
            className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
          >
            Open course builder
          </Link>
        }
      >
        <div className="mb-2 flex items-center gap-3">
          <Link
            to="/admin/reports"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Reports
          </Link>
          {course.status !== 'published' && <StatusBadge status={course.status} />}
        </div>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Enrolled students"
          value={course.enrollments.active}
          hint={
            course.enrollments.pending
              ? `${course.enrollments.pending} requests pending`
              : undefined
          }
        />
        <StatTile
          label="Average progress"
          value={formatPercent(progress.averagePercent)}
          hint={`${progress.completedStudents} completed · ${progress.notStarted} not started`}
        />
        <StatTile
          label="Waiting for review"
          value={course.reviews.submitted}
          to={`/admin/reviews?course=${course.id}`}
          hint={`${course.reviews.reviewed} reviewed · ${course.reviews.resubmit_requested} sent back`}
        />
        <StatTile label="Overdue assignments" value={course.overdue} tone="danger" />
      </dl>

      {course.enrollments.active === 0 && course.lessons === 0 ? (
        <EmptyState title="Nothing to report yet">
          Publish lessons and enroll students to see their progress here.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card aria-label="Progress distribution">
            <CardHeader
              title="Progress distribution"
              description="Enrolled students by share of lessons completed"
            />
            <CardBody>
              <BarList
                label="Students per progress range"
                rows={distribution.map((band) => ({ label: band.label, value: band.students }))}
              />
            </CardBody>
          </Card>
          <Card aria-label="Completion by module">
            <CardHeader
              title="Completion by module"
              description="Lessons completed by enrolled students, as a share of all they could complete"
            />
            <CardBody>
              {modules.length === 0 ? (
                <p className="text-sm text-slate-500">No lessons are published yet.</p>
              ) : (
                <ul className="space-y-3">
                  {modules.map((module) => (
                    <li key={module.id} className="space-y-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate text-slate-700">{module.title}</span>
                        <span className="text-slate-900 tabular-nums">
                          {formatPercent(module.percent)}
                        </span>
                      </div>
                      <ProgressBar
                        value={module.percent ?? 0}
                        label={`${module.title} completion`}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <Card aria-label="Assignments">
        <CardHeader
          title="Assignments"
          description="Handed in and overdue count enrolled students; review figures are each student's latest attempt."
        />
        <AssignmentsTable courseId={course.id} assignments={assignments} />
      </Card>

      <StudentsTable report={data} filters={filters} searchInput={input} isFetching={isFetching} />
    </div>
  );
}
