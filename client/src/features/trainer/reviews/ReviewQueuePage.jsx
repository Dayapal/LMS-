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
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.02] sm:flex-row sm:items-center sm:px-6">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {row.student.name ? (
            <Link to={studentPath(row.student.id)} className={linkClass}>
              {row.student.name}
            </Link>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">A deleted student</span>
          )}
          <span className="text-slate-400 opacity-60" aria-hidden="true">
            ·
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">{row.assignment?.title}</span>
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {row.course?.title} · Attempt {row.attempt}
          {row.assignment?.maxAttempts ? ` of ${row.assignment.maxAttempts}` : ''} · Due{' '}
          {formatDateTime(row.assignment?.dueAt)}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
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
        <span className="w-20 text-right text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
          {formatMarks(row.review?.finalMarks, row.assignment?.maxMarks)}
        </span>
        <Link
          to={reviewPath(row)}
          state={{ from }}
          aria-label={`${waiting ? 'Review' : 'Open'} ${row.student.name ?? 'the'}'s submission for ${row.assignment?.title}`}
          className={
            waiting
              ? 'inline-flex h-8 items-center justify-center rounded-xl bg-linear-to-r from-brand-500 to-[#029ab8] px-3.5 text-xs font-semibold text-white shadow-xs hover:shadow-[0_0_15px_rgba(3,174,210,0.35)] transition-all'
              : 'inline-flex h-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 px-3.5 text-xs font-semibold text-brand-600 shadow-2xs hover:bg-white hover:text-brand-700 dark:border-white/15 dark:bg-white/10 dark:text-cyan-400 dark:hover:bg-white/20 dark:hover:text-cyan-300 transition-all'
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
            className={`divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${isFetching ? 'opacity-70' : ''}`}
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
