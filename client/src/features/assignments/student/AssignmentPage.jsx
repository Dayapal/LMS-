import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { assignmentKeys, useAssignment, useMySubmissions } from '../api.js';
import { formatDateTime, formatMarks } from '../format.js';
import {
  AssignmentFacts,
  LateBadge,
  SubmissionStateBadge,
} from '../components/AssignmentParts.jsx';
import { SubmissionItems } from '../components/SubmissionItems.jsx';
import { SubmissionForm } from './SubmissionForm.jsx';
import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { FileMaterial } from '../../lessons/components/FileMaterial.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

function TrainerFeedback({ submission, maxMarks }) {
  const { review } = submission;
  if (!review) return null;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">
        Trainer feedback
        {review.finalMarks != null && (
          <span className="ml-2 font-normal text-slate-700">
            Marks: {formatMarks(review.finalMarks, maxMarks)}
            {submission.isLate && review.marks !== review.finalMarks && (
              <span className="text-slate-500"> ({review.marks} before the late penalty)</span>
            )}
          </span>
        )}
      </p>
      {review.feedback ? (
        <MarkdownView className="text-sm">{review.feedback}</MarkdownView>
      ) : (
        <p className="text-sm text-slate-500">No written feedback.</p>
      )}
    </div>
  );
}

function AttemptCard({ submission, maxMarks }) {
  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">Attempt {submission.attempt}</h3>
        <SubmissionStateBadge status={submission.status} />
        <LateBadge show={submission.isLate} />
        <span className="text-xs text-slate-500">
          Submitted {formatDateTime(submission.submittedAt)}
          {submission.editedAt && ` · edited ${formatDateTime(submission.editedAt)}`}
        </span>
      </div>
      <SubmissionItems items={submission.items} />
      {submission.note && (
        <p className="text-sm whitespace-pre-wrap text-slate-600">
          <span className="font-medium text-slate-700">Your note: </span>
          {submission.note}
        </p>
      )}
      <TrainerFeedback submission={submission} maxMarks={maxMarks} />
    </article>
  );
}

/** What the student can do next: submit, edit, resubmit, or why not. */
function SubmissionPanel({ assignment, history }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const state = assignment.mySubmission;
  const latest = history[0];

  const done = (message) => async () => {
    toast.success(message);
    setEditing(false);
    // The assignment's state, the history and the course lists all change.
    await queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
  };

  if (state.canSubmit) {
    const resubmitting = state.status === 'resubmit_requested';
    return (
      <Card>
        <CardHeader
          title={resubmitting ? `Resubmit (attempt ${state.attempts + 1})` : 'Submit your work'}
          description={
            resubmitting
              ? 'Your trainer asked for changes. Read their feedback below, then hand in a new attempt.'
              : state.status === 'overdue'
                ? 'The due date has passed. This will be marked late.'
                : undefined
          }
        />
        <CardBody>
          {resubmitting && latest && (
            <div className="mb-5">
              <TrainerFeedback submission={latest} maxMarks={assignment.maxMarks} />
            </div>
          )}
          <SubmissionForm
            assignment={assignment}
            onDone={done(resubmitting ? 'New attempt submitted.' : 'Your work was submitted.')}
          />
        </CardBody>
      </Card>
    );
  }

  if (state.canEdit && latest) {
    return (
      <Card>
        <CardHeader
          title="Your submission"
          description="You can change it until your trainer reviews it."
          actions={
            !editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit submission
              </Button>
            )
          }
        />
        <CardBody>
          {editing ? (
            <SubmissionForm
              assignment={assignment}
              submission={latest}
              onDone={done('Your changes were saved.')}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <AttemptCard submission={latest} maxMarks={assignment.maxMarks} />
          )}
        </CardBody>
      </Card>
    );
  }

  if (assignment.status === 'archived') {
    return (
      <Alert tone="info" title="This assignment is archived">
        It no longer accepts work, but your submissions, marks and feedback stay here.
      </Alert>
    );
  }
  return (
    state.blockedReason &&
    state.status !== 'reviewed' && <Alert tone="info">{state.blockedReason}</Alert>
  );
}

/** A student's assignment page: instructions, deadline, submitting and the history of attempts. */
export function AssignmentPage() {
  const { courseId, assignmentId } = useParams();
  const assignment = useAssignment(assignmentId);
  const history = useMySubmissions(assignmentId);
  const backLink = (
    <Link
      to={`/app/courses/${courseId}`}
      className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
    >
      ← Back to the course
    </Link>
  );

  if (assignment.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6" aria-label="Loading assignment">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (assignment.isError) {
    const notFound = assignment.error.response?.status === 404;
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <ErrorState
          message={
            notFound
              ? 'This assignment is not available. It may be unpublished, or you may not be enrolled in this course.'
              : getErrorMessage(assignment.error)
          }
          onRetry={notFound ? undefined : assignment.refetch}
        />
        {backLink}
      </div>
    );
  }

  const data = assignment.data;
  const state = data.mySubmission;
  const attempts = history.data ?? [];
  // The panel shows the editable attempt; the history lists the rest.
  const shownInPanel = state.canEdit && !state.canSubmit ? attempts[0]?.id : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-3">
        {backLink}
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>{data.course?.title}</li>
            {data.module && (
              <>
                <li aria-hidden="true">/</li>
                <li>{data.module.title}</li>
              </>
            )}
            {data.lesson && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    to={`/app/courses/${courseId}/lessons/${data.lesson.id}`}
                    className="hover:text-slate-800"
                  >
                    {data.lesson.title}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {data.title}
          </h1>
          <SubmissionStateBadge status={state.status} />
          {data.status === 'archived' && <Badge tone="muted">Archived</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Instructions" />
          <CardBody className="space-y-5">
            {data.objectives.length > 0 && (
              <section aria-labelledby="objectives-heading">
                <h2 id="objectives-heading" className="text-sm font-semibold text-slate-900">
                  You will
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {data.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </section>
            )}
            {data.instructions ? (
              <MarkdownView>{data.instructions}</MarkdownView>
            ) : (
              <p className="text-sm text-slate-500">Your trainer hasn&apos;t added instructions.</p>
            )}
            {data.attachments.length > 0 && (
              <section aria-labelledby="handouts-heading" className="space-y-3">
                <h2 id="handouts-heading" className="text-sm font-semibold text-slate-900">
                  Handouts
                </h2>
                {data.attachments.map((file) => (
                  <FileMaterial key={file.id} material={{ file, downloadable: true }} />
                ))}
              </section>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <AssignmentFacts assignment={data} />
          </CardBody>
        </Card>
      </div>

      <SubmissionPanel assignment={data} history={attempts} />

      {history.isError ? (
        <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} />
      ) : (
        attempts.some((s) => s.id !== shownInPanel) && (
          <section aria-labelledby="history-heading" className="space-y-4">
            <h2 id="history-heading" className="text-lg font-semibold text-slate-900">
              {attempts.length > 1 ? 'Your attempts' : 'Your submission'}
            </h2>
            {attempts
              .filter((s) => s.id !== shownInPanel)
              .map((submission) => (
                <AttemptCard key={submission.id} submission={submission} maxMarks={data.maxMarks} />
              ))}
          </section>
        )
      )}
    </div>
  );
}
