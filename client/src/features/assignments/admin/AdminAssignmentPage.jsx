import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  assignmentsApi,
  useAssignment,
  useAssignmentMutation,
  useAssignmentSubmissions,
} from '../api.js';
import { formatDateTime, formatMarks } from '../format.js';
import {
  AssignmentFacts,
  LateBadge,
  SubmissionStateBadge,
} from '../components/AssignmentParts.jsx';
import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { FileMaterial } from '../../lessons/components/FileMaterial.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

const STATUS_ACTIONS = {
  draft: [
    { to: 'published', label: 'Publish', variant: 'primary' },
    { to: 'archived', label: 'Archive' },
  ],
  published: [
    { to: 'draft', label: 'Unpublish' },
    { to: 'archived', label: 'Archive' },
  ],
  archived: [{ to: 'draft', label: 'Restore as draft' }],
};

const STATUS_MESSAGE = {
  published: 'Assignment published. Enrolled students can now see it.',
  draft: 'Assignment moved to draft. Students can no longer see it.',
  archived: 'Assignment archived. It is hidden from students.',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'To review' },
  { value: 'resubmit_requested', label: 'Resubmission requested' },
  { value: 'reviewed', label: 'Reviewed' },
];

function SubmissionsList({ assignment, courseId }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = { page, limit: 20, ...(status && { status }) };
  const { data, isPending, isError, error, refetch } = useAssignmentSubmissions(
    assignment.id,
    params,
  );

  return (
    <section aria-labelledby="submissions-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="submissions-heading" className="text-lg font-semibold text-slate-900">
            Submissions
          </h2>
          <p className="text-sm text-slate-500">The latest attempt of each student.</p>
        </div>
        <div role="group" aria-label="Filter submissions" className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={status === filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                status === filter.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      {isPending ? (
        <Skeleton className="h-32" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={status ? 'Nothing here' : 'No submissions yet'}>
          {status
            ? 'No student’s latest attempt has this status.'
            : 'Submissions appear here as students hand in their work.'}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {data.items.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {submission.student.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {submission.student.email} · Attempt {submission.attempt}
                    {submission.attempts > 1 ? ` of ${submission.attempts}` : ''} ·{' '}
                    {formatDateTime(submission.submittedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LateBadge show={submission.isLate} />
                  <SubmissionStateBadge status={submission.status} />
                  <span className="w-20 text-right text-sm text-slate-700">
                    {formatMarks(submission.review?.finalMarks, assignment.maxMarks)}
                  </span>
                  <Link
                    to={`/admin/courses/${courseId}/assignments/${assignment.id}/submissions/${submission.id}`}
                    aria-label={`${submission.status === 'submitted' ? 'Review' : 'Open'} ${submission.student.name}'s submission`}
                    className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    {submission.status === 'submitted' ? 'Review' : 'Open'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

/** The trainer's page for one assignment: details, status, and its submissions. */
export function AdminAssignmentPage() {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: assignment, isPending, isError, error, refetch } = useAssignment(assignmentId);
  const setStatus = useAssignmentMutation((status) =>
    assignmentsApi.update(assignmentId, { status }),
  );
  const remove = useAssignmentMutation(() => assignmentsApi.remove(assignmentId), {
    onSuccess: () => {
      toast.success('Assignment deleted.');
      navigate(`/admin/courses/${courseId}`, { replace: true, state: { tab: 'assignments' } });
    },
  });

  if (isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading assignment">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (isError) {
    const notFound = error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This assignment does not exist.' : getErrorMessage(error)}
          onRetry={notFound ? undefined : refetch}
        />
        <Link
          to={`/admin/courses/${courseId}`}
          state={{ tab: 'assignments' }}
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Back to the course
        </Link>
      </div>
    );
  }

  const changeStatus = async (status) => {
    try {
      await setStatus.mutateAsync(status);
      toast.success(STATUS_MESSAGE[status]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfirmDelete(false);
    }
  };

  const placement = [assignment.module?.title, assignment.lesson?.title].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title={assignment.title}
        description={`${assignment.course?.title ?? ''}${
          placement.length ? ` · ${placement.join(' › ')}` : ' · Whole course'
        }`}
        actions={
          <>
            <Link
              to={`/admin/courses/${courseId}/assignments/${assignment.id}/edit`}
              className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
            >
              Edit
            </Link>
            {STATUS_ACTIONS[assignment.status].map((action) => (
              <Button
                key={action.to}
                variant={action.variant ?? 'secondary'}
                loading={setStatus.isPending && setStatus.variables === action.to}
                disabled={setStatus.isPending}
                onClick={() => changeStatus(action.to)}
              >
                {action.label}
              </Button>
            ))}
            {assignment.status !== 'published' && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      >
        <Link
          to={`/admin/courses/${courseId}`}
          state={{ tab: 'assignments' }}
          className="mb-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Course assignments
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <StatusBadge status={assignment.status} />
        <span>
          {assignment.stats.students} student{assignment.stats.students === 1 ? '' : 's'} submitted
          · {assignment.stats.awaitingReview} waiting for review
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Instructions" />
          <CardBody className="space-y-5">
            {assignment.objectives.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {assignment.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            )}
            {assignment.instructions ? (
              <MarkdownView>{assignment.instructions}</MarkdownView>
            ) : (
              <p className="text-sm text-slate-500">No instructions yet.</p>
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <AssignmentFacts assignment={assignment} />
            </CardBody>
          </Card>
          {assignment.attachments.length > 0 && (
            <Card>
              <CardHeader title="Handouts" />
              <CardBody className="space-y-3">
                {assignment.attachments.map((file) => (
                  <FileMaterial key={file.id} material={{ file, downloadable: true }} />
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <SubmissionsList assignment={assignment} courseId={courseId} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this assignment?"
        message={`“${assignment.title}” and its unused handouts will be permanently deleted. Assignments with submissions must be archived instead.`}
        confirmLabel="Delete assignment"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
