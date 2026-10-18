import { useForm } from 'react-hook-form';
import { Link, useLocation, useParams } from 'react-router';
import { assignmentsApi, useAssignmentMutation, useSubmission } from '../api.js';
import { resubmitFormSchema, reviewFormSchema } from '../schemas.js';
import { formatDateTime, formatMarks } from '../format.js';
import { LateBadge, SubmissionStateBadge } from '../components/AssignmentParts.jsx';
import { SubmissionItems } from '../components/SubmissionItems.jsx';
import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ErrorState, PageHeader, Skeleton } from '../../../components/ui/Feedback.jsx';
import { TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { applyFieldErrors, getErrorMessage } from '../../../utils/apiErrors.js';

function ReviewForm({ submission, assignment, canResubmit }) {
  const toast = useToast();
  const { review: existing } = submission;
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      marks: existing?.marks == null ? '' : String(existing.marks),
      feedback: existing?.feedback ?? '',
    },
  });
  const save = useAssignmentMutation(({ action, body }) =>
    action === 'review'
      ? assignmentsApi.review(submission.id, body)
      : assignmentsApi.requestResubmission(submission.id, body),
  );

  const penalty = submission.isLate ? assignment.latePolicy.penaltyPercent : 0;
  const typedMarks = Number(watch('marks'));
  const showPenalty = penalty > 0 && watch('marks') !== '' && Number.isFinite(typedMarks);

  const run = (action) =>
    handleSubmit(async (values) => {
      clearErrors();
      const schema = (action === 'review' ? reviewFormSchema : resubmitFormSchema)(
        assignment.maxMarks,
      );
      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          setError(issue.path[0], { type: 'validate', message: issue.message });
        }
        return;
      }
      try {
        await save.mutateAsync({ action, body: parsed.data });
        toast.success(
          action === 'review' ? 'Review saved.' : 'Resubmission requested from the student.',
        );
      } catch (error) {
        if (!applyFieldErrors(error, setError)) toast.error(getErrorMessage(error));
      }
    });

  return (
    <form noValidate className="space-y-5" onSubmit={run('review')}>
      <TextField
        label={`Marks (out of ${assignment.maxMarks})`}
        type="number"
        inputMode="decimal"
        min={0}
        max={assignment.maxMarks}
        step="0.01"
        error={errors.marks?.message}
        hint={
          showPenalty
            ? `Late: the student gets ${Math.round(typedMarks * (100 - penalty)) / 100} after the ${penalty}% penalty.`
            : submission.isLate
              ? 'This attempt is late, but this assignment has no late penalty.'
              : undefined
        }
        {...register('marks')}
      />
      <TextAreaField
        label="Feedback"
        rows={8}
        hint="Markdown. The student sees it with their submission."
        error={errors.feedback?.message}
        {...register('feedback')}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          disabled={!canResubmit || isSubmitting}
          onClick={run('resubmit')}
        >
          Request resubmission
        </Button>
        <Button type="submit" loading={isSubmitting && save.variables?.action === 'review'}>
          {existing && submission.status === 'reviewed' ? 'Update review' : 'Save review'}
        </Button>
      </div>
      {!canResubmit && (
        <p className="text-right text-xs text-slate-500 dark:text-slate-400">
          The student has used all {assignment.maxAttempts} attempts, so only a final review is
          possible.
        </p>
      )}
    </form>
  );
}

/**
 * Where the page was opened from, when that was another trainer page such as
 * the review queue (`state.from` from the link), so "back" returns there with
 * its filters. Anything else falls back to the assignment page.
 */
function useReturnTo() {
  const from = useLocation().state?.from;
  if (typeof from?.pathname !== 'string' || !from.pathname.startsWith('/admin/')) return null;
  return {
    to: `${from.pathname}${from.search ?? ''}`,
    label: from.label ?? 'Back',
    state: { from },
  };
}

/** The trainer reviews one attempt: what was handed in, the history, marks and feedback. */
export function SubmissionReviewPage() {
  const { courseId, assignmentId, submissionId } = useParams();
  const { data: submission, isPending, isError, error, refetch } = useSubmission(submissionId);
  const back = `/admin/courses/${courseId}/assignments/${assignmentId}`;
  const returnTo = useReturnTo();

  if (isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading submission">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (isError) {
    const notFound = error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This submission does not exist.' : getErrorMessage(error)}
          onRetry={notFound ? undefined : refetch}
        />
        <Link
          to={returnTo?.to ?? back}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
        >
          ← {returnTo ? returnTo.label : 'Back to the assignment'}
        </Link>
      </div>
    );
  }

  const { assignment, history } = submission;
  const isLatest = history[0]?.id === submission.id;
  const canResubmit = assignment.maxAttempts == null || submission.attempt < assignment.maxAttempts;

  return (
    <div className="space-y-6">
      <PageHeader
        title={submission.student.name}
        description={`${assignment.title} · Attempt ${submission.attempt}`}
      >
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          {returnTo && (
            <Link to={returnTo.to} className="text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors">
              ← {returnTo.label}
            </Link>
          )}
          <Link to={back} className="text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors">
            {returnTo ? '' : '← '}
            {assignment.title}
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <SubmissionStateBadge status={submission.status} />
        <LateBadge show={submission.isLate} />
        <span>
          Submitted {formatDateTime(submission.submittedAt)}
          {submission.editedAt && ` · edited ${formatDateTime(submission.editedAt)}`}
        </span>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
          ·
        </span>
        <Link
          to={`/admin/students/${submission.student.id}`}
          className="font-medium text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline transition-colors"
        >
          {submission.student.email}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Submitted work" />
            <CardBody className="space-y-5">
              <SubmissionItems items={submission.items} forReviewer />
              {submission.note && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                    Note from the student
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                    {submission.note}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={isLatest ? 'Review' : 'Review of this attempt'} />
            <CardBody className="space-y-4">
              {isLatest ? (
                <ReviewForm
                  key={submission.review?.reviewedAt ?? 'new'}
                  submission={submission}
                  assignment={assignment}
                  canResubmit={canResubmit}
                />
              ) : (
                <>
                  <Alert tone="info">
                    This is an earlier attempt. Only the latest attempt can be reviewed.
                  </Alert>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Marks: {formatMarks(submission.review?.finalMarks, assignment.maxMarks)}
                  </p>
                  {submission.review?.feedback && (
                    <MarkdownView className="text-sm">{submission.review.feedback}</MarkdownView>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Attempts" />
            <CardBody>
              <ol className="space-y-2">
                {history.map((attempt) => (
                  <li key={attempt.id} className="flex flex-wrap items-center gap-2 text-sm">
                    {attempt.id === submission.id ? (
                      <span className="font-semibold text-slate-900 dark:text-white" aria-current="page">
                        Attempt {attempt.attempt}
                      </span>
                    ) : (
                      <Link
                        to={`${back}/submissions/${attempt.id}`}
                        state={returnTo?.state}
                        className="font-medium text-brand-700 hover:text-brand-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline transition-colors"
                      >
                        Attempt {attempt.attempt}
                      </Link>
                    )}
                    <SubmissionStateBadge status={attempt.status} />
                    <LateBadge show={attempt.isLate} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(attempt.submittedAt)} ·{' '}
                      {formatMarks(attempt.review?.finalMarks, assignment.maxMarks)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
