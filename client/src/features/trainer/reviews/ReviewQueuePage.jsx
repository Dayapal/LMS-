import { Link, useLocation } from 'react-router';
import { useAssignments } from '../../assignments/api.js';
import { formatDateTime, formatMarks, relativeTime } from '../../assignments/format.js';
import { LateBadge, SubmissionStateBadge } from '../../assignments/components/AssignmentParts.jsx';
import { useCourses } from '../../courses/api.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useReviewQueue } from '../api.js';
import { REVIEW_TABS, reviewPath, studentPath } from '../format.js';
import {
  EnrollmentBadge,
  FilterPills,
  FilterSelect,
  linkClass,
} from '../components/TrainerParts.jsx';
import { useSearch, useUrlFilters } from '../hooks.jsx';

const EMPTY = {
  submitted: ['Nothing to review', 'New submissions will appear here, the longest-waiting first.'],
  resubmitted: [
    'No resubmissions waiting',
    'New attempts after a resubmission request appear here.',
  ],
  resubmit_requested: [
    'Nobody owes a new attempt',
    'Work you sent back for another attempt appears here.',
  ],
  reviewed: ['Nothing reviewed yet', 'Reviewed work appears here.'],
  all: ['No submissions yet', 'Submissions appear here as students hand in their work.'],
};

function QueueRow({ row, from }) {
  const waiting = row.status === 'submitted';
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {row.student.name ? (
            <Link to={studentPath(row.student.id)} className={linkClass}>
              {row.student.name}
            </Link>
          ) : (
            <span className="text-slate-500">A deleted student</span>
          )}
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="font-medium text-slate-900">{row.assignment?.title}</span>
        </p>
        <p className="truncate text-xs text-slate-500">
          {row.course?.title} · Attempt {row.attempt}
          {row.assignment?.maxAttempts ? ` of ${row.assignment.maxAttempts}` : ''} · Due{' '}
          {formatDateTime(row.assignment?.dueAt)}
        </p>
        <p className="text-xs text-slate-600">
          {waiting ? 'Waiting since' : 'Submitted'}{' '}
          <time dateTime={row.submittedAt} title={formatDateTime(row.submittedAt)}>
            {relativeTime(row.submittedAt)}
          </time>
          {row.editedAt && ' · edited'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {row.attempt > 1 && waiting && <Badge tone="info">Resubmission</Badge>}
        <LateBadge show={row.isLate} />
        {row.enrollmentStatus !== 'active' && <EnrollmentBadge status={row.enrollmentStatus} />}
        {row.assignment?.status === 'archived' && <Badge tone="muted">Archived</Badge>}
        <SubmissionStateBadge status={row.status} />
        <span className="w-20 text-right text-sm text-slate-700 tabular-nums">
          {formatMarks(row.review?.finalMarks, row.assignment?.maxMarks)}
        </span>
        <Link
          to={reviewPath(row)}
          state={{ from }}
          aria-label={`${waiting ? 'Review' : 'Open'} ${row.student.name ?? 'the'}'s submission for ${row.assignment?.title}`}
          className={
            waiting
              ? 'inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700'
              : 'inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50'
          }
        >
          {waiting ? 'Review' : 'Open'}
        </Link>
      </div>
    </li>
  );
}

/**
 * Every student's latest attempt across courses (GET /admin/submissions).
 * Reviewing opens the Phase 4 review page, which brings the trainer back here.
 */
export function ReviewQueuePage() {
  const location = useLocation();
  const filters = useUrlFilters({ status: 'submitted', sort: 'priority' });
  const { q, input } = useSearch(filters, 'Search students or assignments');
  const status = filters.get('status');
  const course = filters.get('course');
  const assignment = filters.get('assignment');
  const late = filters.get('late');
  const sort = filters.get('sort');

  const params = {
    page: filters.page,
    limit: 20,
    sort,
    ...(status !== 'all' && { status }),
    ...(course && { course }),
    ...(assignment && { assignment }),
    ...(late && { late }),
    ...(q && { q }),
  };
  const { data, isPending, isError, error, refetch, isFetching } = useReviewQueue(params);
  const courses = useCourses({ limit: 100 });
  const assignments = useAssignments({ course, limit: 100 }, { enabled: Boolean(course) });
  const from = { pathname: location.pathname, search: location.search, label: 'Review queue' };
  const [emptyTitle, emptyText] = EMPTY[status] ?? EMPTY.all;
  const filtered = Boolean(q || course || late);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review queue"
        description="Each student's latest attempt at every assignment, across all courses."
      />

      <FilterPills
        label="Review state"
        options={REVIEW_TABS}
        value={status}
        counts={data?.meta.counts}
        onChange={(value) => filters.update({ status: value })}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {input}
        <FilterSelect
          label="Course"
          value={course}
          onChange={(value) => filters.update({ course: value, assignment: '' })}
        >
          <option value="">All courses</option>
          {courses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </FilterSelect>
        {course && (
          <FilterSelect
            label="Assignment"
            value={assignment}
            onChange={(value) => filters.update({ assignment: value })}
          >
            <option value="">All assignments</option>
            {assignments.data?.items.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect
          label="Timing"
          value={late}
          onChange={(value) => filters.update({ late: value })}
        >
          <option value="">Late or on time</option>
          <option value="true">Late only</option>
          <option value="false">On time only</option>
        </FilterSelect>
        <FilterSelect
          label="Order"
          value={sort}
          onChange={(value) => filters.update({ sort: value })}
        >
          <option value="priority">Waiting longest first</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </FilterSelect>
      </div>

      {isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading submissions">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={filtered ? 'No submissions match' : emptyTitle}>
          {filtered ? 'Try a different search or filter.' : emptyText}
        </EmptyState>
      ) : (
        <>
          <ul
            aria-label="Submissions"
            aria-busy={isFetching || undefined}
            className={`divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs ${isFetching ? 'opacity-70' : ''}`}
          >
            {data.items.map((row) => (
              <QueueRow key={row.id} row={row} from={from} />
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={(p) => filters.update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
