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
    <li className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          to={`/app/courses/${row.course.id}/assignments/${row.id}`}
          className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          {row.title}
        </Link>
        <p className="truncate text-xs text-slate-500">{placement(row)}</p>
        <p className="text-sm text-slate-600">
          Due {formatDateTime(row.dueAt)}{' '}
          <span className="text-slate-500">({relativeTime(row.dueAt)})</span>
        </p>
        {state.status === 'reviewed' && (
          <p className="text-sm text-slate-700">
            Marks: {formatMarks(latest?.finalMarks, row.maxMarks)}
          </p>
        )}
        {state.status === 'overdue' && state.canSubmit && (
          <p className="text-sm text-amber-800">Late work is still accepted.</p>
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
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                  selected
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {filter.label}
                {count != null && <span className="ml-1.5 opacity-80">{count}</span>}
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none lg:w-64"
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
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
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
