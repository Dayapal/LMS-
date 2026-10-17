import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { coursesApi, useCourseMutation, useEnrollments } from '../api.js';
import { enrollFormSchema } from '../schemas.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { TextField } from '../../../components/ui/FormField.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../../components/ui/Feedback.jsx';
import { FilterPills } from '../../../components/ui/FilterPills.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { applyFieldErrors, getErrorMessage } from '../../../utils/apiErrors.js';

const FILTERS = [
  { value: 'pending', label: 'Requests' },
  { value: 'active', label: 'Enrolled' },
  { value: 'removed', label: 'Removed' },
];

const STATUS_BADGE = {
  pending: <Badge tone="warning">Requested</Badge>,
  active: <Badge tone="success">Enrolled</Badge>,
  removed: <Badge tone="muted">Removed</Badge>,
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';

function EnrollByEmail({ courseId }) {
  const toast = useToast();
  const enroll = useCourseMutation(coursesApi.enrollStudent);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(enrollFormSchema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    try {
      const enrollment = await enroll.mutateAsync({ courseId, email });
      toast.success(`${enrollment.user.name} is now enrolled.`);
      reset();
    } catch (error) {
      if (!applyFieldErrors(error, setError))
        setError('email', { message: getErrorMessage(error) });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <TextField
          label="Enroll a student by email"
          type="email"
          placeholder="student@example.com"
          hint="The student must already have an account."
          error={errors.email?.message}
          {...register('email')}
        />
      </div>
      <Button type="submit" loading={isSubmitting} className="sm:mt-7">
        Enroll
      </Button>
    </form>
  );
}

export function EnrollmentsPanel({ courseId }) {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const { data, isPending, isError, error, refetch } = useEnrollments({
    course: courseId,
    status,
    page,
    limit: 20,
  });
  const update = useCourseMutation(({ id, status: next }) => coursesApi.updateEnrollment(id, next));

  const decide = async (enrollment, next, message) => {
    try {
      await update.mutateAsync({ id: enrollment.id, status: next });
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <EnrollByEmail courseId={courseId} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Students"
          description="Approve enrollment requests and manage who can study this course."
        />
        <div className="border-b border-slate-200 px-5 py-3 sm:px-6">
          <FilterPills
            label="Show students"
            options={FILTERS}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </div>
        <CardBody className="space-y-4">
          {isPending ? (
            <div className="space-y-3" aria-label="Loading students">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
          ) : data.items.length === 0 ? (
            <EmptyState title={status === 'pending' ? 'No pending requests' : 'No students here'}>
              {status === 'pending'
                ? 'Requests from students who want to join this course will appear here.'
                : 'Students will appear here once they are enrolled or removed.'}
            </EmptyState>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {data.items.map((enrollment) => (
                  <li
                    key={enrollment.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {enrollment.user.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">{enrollment.user.email}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {STATUS_BADGE[enrollment.status]}
                      <span>
                        {enrollment.status === 'active'
                          ? `Since ${formatDate(enrollment.enrolledAt)}`
                          : `Updated ${formatDate(enrollment.updatedAt)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {enrollment.status !== 'active' && (
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() =>
                            decide(enrollment, 'active', `${enrollment.user.name} enrolled.`)
                          }
                        >
                          {enrollment.status === 'pending' ? 'Approve' : 'Re-enroll'}
                        </Button>
                      )}
                      {enrollment.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={update.isPending}
                          onClick={() => decide(enrollment, 'removed', 'Request declined.')}
                        >
                          Decline
                        </Button>
                      )}
                      {enrollment.status === 'active' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmRemove(enrollment)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove student from course?"
        message={`${confirmRemove?.user.name} will lose access to this course's lessons. You can re-enroll them later.`}
        confirmLabel="Remove"
        loading={update.isPending}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          await decide(confirmRemove, 'removed', `${confirmRemove.user.name} removed.`);
          setConfirmRemove(null);
        }}
      />
    </div>
  );
}
