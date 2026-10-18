import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  attemptsText,
  formatDateTime,
  latePolicyText,
  relativeTime,
  SUBMISSION_STATE,
  submissionTypeLabel,
} from '../format.js';

/** A student's derived state (pending, overdue, …) or a submission's status. */
export function SubmissionStateBadge({ status }) {
  const { tone, label } = SUBMISSION_STATE[status] ?? { tone: 'neutral', label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

export function LateBadge({ show }) {
  return show ? <Badge tone="warning">Late</Badge> : null;
}

/** Due date (local time, with zone), late policy, marks, attempts and accepted types. */
export function AssignmentFacts({ assignment }) {
  const rows = [
    [
      'Due',
      <>
        {formatDateTime(assignment.dueAt)}{' '}
        <span className="text-slate-500 dark:text-slate-400">({relativeTime(assignment.dueAt)})</span>
      </>,
    ],
    ['Late work', latePolicyText(assignment.latePolicy)],
    ['Marks', `${assignment.maxMarks}`],
    ['Attempts', attemptsText(assignment.maxAttempts)],
    ['Submit as', assignment.allowedSubmissionTypes.map(submissionTypeLabel).join(', ')],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="font-semibold text-slate-500 dark:text-slate-400">{term}</dt>
          <dd className="text-slate-800 dark:text-slate-200">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A compact list of assignments with due dates, for the course page and the
 * lesson reader. Students also see their own state of each one.
 */
export function AssignmentList({ assignments, pathFor, showState = true }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-xs backdrop-blur-xl dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.04]">
      {assignments.map((assignment) => (
        <li key={assignment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.02]">
          <div className="min-w-0 flex-1">
            <Link
              to={pathFor(assignment)}
              className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              {assignment.title}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Due {formatDateTime(assignment.dueAt)} · {assignment.maxMarks} marks
            </p>
          </div>
          {assignment.status === 'archived' && <Badge tone="muted">Archived</Badge>}
          {showState && assignment.mySubmission && (
            <SubmissionStateBadge status={assignment.mySubmission.status} />
          )}
        </li>
      ))}
    </ul>
  );
}
