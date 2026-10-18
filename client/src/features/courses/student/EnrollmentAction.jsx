import { coursesApi, useCourseMutation } from '../api.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

export function EnrollmentBadge({ enrollment }) {
  if (enrollment?.status === 'active') return <Badge tone="success">Enrolled</Badge>;
  if (enrollment?.status === 'pending') return <Badge tone="warning">Request pending</Badge>;
  return null;
}

/** Enrollment call-to-action for a student on a course page. */
export function EnrollmentAction({ course }) {
  const toast = useToast();
  const request = useCourseMutation(() => coursesApi.requestEnrollment(course.id));
  const status = course.enrollment?.status;

  if (status === 'active') {
    return (
      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        You&apos;re enrolled in this course. Follow the roadmap below.
      </p>
    );
  }
  if (status === 'pending') {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-amber-700 dark:text-amber-400">Request sent.</span> Your trainer will review
        it soon.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        loading={request.isPending}
        onClick={async () => {
          try {
            await request.mutateAsync();
            toast.success('Enrollment requested. Your trainer will review it.');
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      >
        {status === 'removed' ? 'Request to re-join' : 'Request enrollment'}
      </Button>
      <p className="text-xs text-slate-500 dark:text-slate-400">Your trainer approves each enrollment.</p>
    </div>
  );
}
