import { useState } from 'react';
import { Link } from 'react-router';
import { useMyAssignments, useMyCourses } from '../../progress/api.js';
import { LateBadge, SubmissionStateBadge } from '../components/AssignmentParts.jsx';
import { formatDateTime, formatMarks, relativeTime, SUBMISSION_STATE } from '../format.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

const FILTERS = [
  { value: '', label: 'All', count: 'all' },
  { value: 'pending', label: SUBMISSION_STATE.pending.label },
  { value: 'overdue', label: SUBMISSION_STATE.overdue.label },
  { value: 'resubmit_requested', label: SUBMISSION_STATE.resubmit_requested.label },
  { value: 'submitted', label: SUBMISSION_STATE.submitted.label },
  { value: 'reviewed', label: SUBMISSION_STATE.reviewed.label },
];

const EMPTY_TEXT = {
  '': 'Assignments from your courses will appear here once your trainer publishes them.',
  pending: 'You have nothing left to hand in.',
  overdue: 'Nothing is overdue. Well done.',
  resubmit_requested: 'Your trainer has not asked for any new attempts.',
  submitted: 'No submissions are waiting for review.',
  reviewed: 'None of your work has been reviewed yet.',
};

/** Where an assignment sits in its course: "MERN · HTML Fundamentals · Forms". */
const placement = (row) =>
  [row.course?.title, row.module?.title, row.lesson?.title].filter(Boolean).join(' · ');

function AssignmentRow({ row }) {
  const state = row.mySubmission;
  const latest = state.latest;
  return (
    <li className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-4 sm:px-6">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          to={`/app/courses/${row.course.id}/assignments/${row.id}`}
          className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          {row.title}
        </Link>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{placement(row)}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Due {formatDateTime(row.dueAt)}{' '}
          <span className="text-slate-500 dark:text-slate-400">({relativeTime(row.dueAt)})</span>
        </p>
        {state.status === 'reviewed' && (
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Marks: {formatMarks(latest?.finalMarks, row.maxMarks)}
          </p>
        )}
        {state.status === 'overdue' && state.canSubmit && (
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Late work is still accepted.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {row.status === 'archived' && <Badge tone="muted">Archived</Badge>}
        <LateBadge show={latest?.isLate} />
        {state.attempts > 1 && <Badge>Attempt {state.attempts}</Badge>}
        <SubmissionStateBadge status={state.status} />
      </div>
    </li>
  );
}

export function MyAssignmentsPage() {
  const [status, setStatus] = useState('');
  const [course, setCourse] = useState('');
  const [page, setPage] = useState(1);
  const courses = useMyCourses();
  const params = { page, limit: 20, ...(status && { status }), ...(course && { course }) };
  const { data, isPending, isError, error, refetch } = useMyAssignments(params);
  const counts = data?.meta.counts;
  const activeCourses = (courses.data ?? []).filter((item) => item.enrollment.status === 'active');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My assignments"
        description="Everything your trainer has set in your courses, with where each one stands. Dates are in your time zone."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by state" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const count = counts?.[filter.count ?? filter.value];
            const selected = status === filter.value;
            return (
              <button
                key={filter.value || 'all'}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
                className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  selected
                    ? 'bg-linear-to-r from-brand-500 to-[#029ab8] text-white shadow-xs dark:shadow-[0_0_15px_rgba(3,174,210,0.35)]'
                    : 'bg-white/75 text-slate-600 ring-1 ring-slate-200/80 backdrop-blur-md hover:bg-white hover:text-slate-900 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15 dark:hover:bg-white/[0.18] dark:hover:text-white'
                }`}
              >
                {filter.label}
                {count != null && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.2 text-xs font-semibold tabular-nums ${
                      selected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/15 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {activeCourses.length > 1 && (
          <select
            value={course}
            onChange={(event) => {
              setCourse(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by course"
            className="rounded-xl border border-slate-300/80 bg-white/80 px-3.5 py-2 text-sm text-slate-900 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-slate-900/90 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 lg:w-64 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white"
          >
            <option value="">All courses</option>
            {activeCourses.map((item) => (
              <option key={item.course.id} value={item.course.id}>
                {item.course.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading assignments">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={status ? 'Nothing here' : 'No assignments yet'}>
          {EMPTY_TEXT[status]}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            {data.items.map((row) => (
              <AssignmentRow key={row.id} row={row} />
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
