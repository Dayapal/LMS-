import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { coursesApi, useCourseMutation, useCourses } from '../../courses/api.js';
import { formatDateTime, formatMarks, relativeTime } from '../../assignments/format.js';
import { LateBadge, SubmissionStateBadge } from '../../assignments/components/AssignmentParts.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { ErrorState, PageHeader, Skeleton } from '../../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { StatTile } from '../../../components/ui/StatTile.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useStudentDetail, useStudentReport } from '../api.js';
import { assignmentAdminPath, courseReportPath, formatDate } from '../format.js';
import {
  ActivityList,
  EnrollmentBadge,
  linkClass,
  selectClass,
} from '../components/TrainerParts.jsx';

function EnrollmentActions({ enrollment, studentName, onRemove, decide, busy }) {
  if (enrollment.status === 'pending') {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => decide(enrollment, 'active', `${studentName} enrolled.`)}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => decide(enrollment, 'removed', 'Request declined.')}
        >
          Decline
        </Button>
      </div>
    );
  }
  if (enrollment.status === 'removed') {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => decide(enrollment, 'active', `${studentName} re-enrolled.`)}
      >
        Re-enroll
      </Button>
    );
  }
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRemove(enrollment)}>
      Remove
    </Button>
  );
}

function EnrollInCourse({ student, enrollments }) {
  const toast = useToast();
  const [courseId, setCourseId] = useState('');
  const courses = useCourses({ limit: 100 });
  const enroll = useCourseMutation(coursesApi.enrollStudent);
  const taken = new Set(enrollments.filter((e) => e.status !== 'removed').map((e) => e.course.id));
  const options = (courses.data?.items ?? []).filter(
    (c) => !taken.has(c.id) && c.status !== 'archived',
  );
  if (courses.isSuccess && options.length === 0) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!courseId) return;
    try {
      await enroll.mutateAsync({ courseId, email: student.email });
      toast.success(`${student.name} is now enrolled.`);
      setCourseId('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:px-6"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
        Enroll in another course
        <select
          className={`${selectClass} sm:w-full`}
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
        >
          <option value="">Choose a course</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.status === 'draft' ? ' (draft)' : ''}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={!courseId} loading={enroll.isPending}>
        Enroll
      </Button>
    </form>
  );
}

function EnrollmentsCard({ detail }) {
  const toast = useToast();
  const [confirmRemove, setConfirmRemove] = useState(null);
  const update = useCourseMutation(({ id, status }) => coursesApi.updateEnrollment(id, status));
  const { student, enrollments } = detail;

  const decide = async (enrollment, status, message) => {
    try {
      await update.mutateAsync({ id: enrollment.id, status });
      toast.success(message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card aria-label="Courses">
      <CardHeader
        title="Courses"
        description="Removed enrollments and archived courses keep their progress and submissions."
      />
      {enrollments.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Not enrolled in any course yet.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="space-y-2 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    to={courseReportPath(enrollment.course.id)}
                    className={`${linkClass} text-sm`}
                  >
                    {enrollment.course.title}
                  </Link>
                  <EnrollmentBadge status={enrollment.status} />
                  {enrollment.course.status !== 'published' && (
                    <Badge tone="muted">Course {enrollment.course.status}</Badge>
                  )}
                </div>
                <EnrollmentActions
                  enrollment={enrollment}
                  studentName={student.name}
                  decide={decide}
                  onRemove={setConfirmRemove}
                  busy={update.isPending}
                />
              </div>
              {enrollment.progress ? (
                <>
                  <ProgressBar
                    value={enrollment.progress.percent}
                    label={`${enrollment.course.title} progress`}
                    size="sm"
                  />
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>
                      {enrollment.progress.percent}% · {enrollment.progress.completedLessons} of{' '}
                      {enrollment.progress.totalLessons} lessons
                    </span>
                    {enrollment.awaitingReview > 0 && (
                      <span>{enrollment.awaitingReview} to review</span>
                    )}
                    {enrollment.overdue > 0 && (
                      <span className="font-medium text-red-700">{enrollment.overdue} overdue</span>
                    )}
                    {enrollment.lastAccessedAt && (
                      <span>Studied {relativeTime(enrollment.lastAccessedAt)}</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Requested {formatDate(enrollment.requestedAt)}. The lessons open once you approve
                  it.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <EnrollInCourse student={student} enrollments={enrollments} />
      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove from this course?"
        message={`${student.name} will lose access to ${confirmRemove?.course.title}. Their progress and submissions are kept, and you can re-enroll them later.`}
        confirmLabel="Remove"
        loading={update.isPending}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          await decide(confirmRemove, 'removed', `${student.name} removed.`);
          setConfirmRemove(null);
        }}
      />
    </Card>
  );
}

function ModuleProgress({ courses }) {
  if (courses.length === 0) return null;
  return (
    <Card aria-label="Progress by module">
      <CardHeader
        title="Progress by module"
        description="Published lessons only, as the student sees them."
      />
      <CardBody className="space-y-6">
        {courses.map(({ course, enrollmentStatus, progress, modules }) => (
          <section key={course.id} aria-label={course.title} className="space-y-3">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {course.title}
              {enrollmentStatus === 'removed' && <EnrollmentBadge status="removed" />}
              <span className="font-normal text-slate-500">{progress.percent}%</span>
            </h3>
            {modules.length === 0 ? (
              <p className="text-xs text-slate-500">No lessons are published in this course.</p>
            ) : (
              <ul className="space-y-2">
                {modules.map((module) => (
                  <li
                    key={module.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs"
                  >
                    <span className="truncate text-slate-700">{module.title}</span>
                    <span className="text-slate-500 tabular-nums">
                      {module.completedLessons}/{module.totalLessons}
                    </span>
                    <ProgressBar
                      value={module.percent}
                      label={`${module.title} progress`}
                      size="sm"
                      className="col-span-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

function AssignmentsCard({ assignments }) {
  return (
    <Card aria-label="Assignments">
      <CardHeader title="Assignments" description="What the student sees in their courses now." />
      {assignments.items.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">No assignments in their active courses.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {assignments.items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={assignmentAdminPath(row.course.id, row.id)}
                  className={`${linkClass} text-sm`}
                >
                  {row.title}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {row.course.title} · Due {formatDateTime(row.dueAt)}
                </p>
              </div>
              <SubmissionStateBadge status={row.state} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SubmissionsCard({ submissions, marks, from }) {
  return (
    <Card aria-label="Submissions">
      <CardHeader
        title="Submissions"
        description={
          marks.averagePercent == null
            ? 'The latest attempt at each assignment.'
            : `Average of ${marks.reviewed} reviewed: ${marks.averagePercent}% of the marks.`
        }
      />
      {submissions.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Nothing handed in yet.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {submissions.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                {row.assignment && row.course ? (
                  <Link
                    to={`${assignmentAdminPath(row.course.id, row.assignment.id)}/submissions/${row.id}`}
                    state={{ from }}
                    className={`${linkClass} text-sm`}
                  >
                    {row.assignment.title}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">A deleted assignment</span>
                )}
                <p className="truncate text-xs text-slate-500">
                  {row.course?.title} · Attempt {row.attempt} · {formatDateTime(row.submittedAt)}
                </p>
              </div>
              <LateBadge show={row.isLate} />
              <SubmissionStateBadge status={row.status} />
              <span className="w-20 text-right text-sm text-slate-700 tabular-nums">
                {formatMarks(row.review?.finalMarks, row.assignment?.maxMarks)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** One student: profile, enrollments (with actions), progress, assignments, submissions and activity. */
export function StudentDetailPage() {
  const { studentId } = useParams();
  const location = useLocation();
  const detail = useStudentDetail(studentId);
  const report = useStudentReport(studentId);

  if (detail.isPending) {
    return (
      <div className="space-y-6" aria-label="Loading student">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (detail.isError) {
    const notFound = detail.error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This student does not exist.' : getErrorMessage(detail.error)}
          onRetry={notFound ? undefined : detail.refetch}
        />
        <Link
          to="/admin/students"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← All students
        </Link>
      </div>
    );
  }

  const { student, summary } = detail.data;
  const from = { pathname: location.pathname, search: location.search, label: student.name };

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.name}
        description={`${student.email} · Joined ${formatDate(student.createdAt)} · ${
          student.lastLoginAt ? `Signed in ${relativeTime(student.lastLoginAt)}` : 'Never signed in'
        }`}
      >
        <Link
          to="/admin/students"
          className="mb-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← All students
        </Link>
      </PageHeader>
      {student.bio && <p className="max-w-2xl text-sm text-slate-600">{student.bio}</p>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active courses"
          value={summary.activeCourses}
          hint={summary.pendingRequests ? `${summary.pendingRequests} pending` : undefined}
        />
        <StatTile label="Lessons completed" value={summary.lessonsCompleted} />
        <StatTile label="Waiting for review" value={summary.awaitingReview} />
        <StatTile label="Overdue assignments" value={summary.assignments.overdue} tone="danger" />
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <EnrollmentsCard detail={detail.data} />
          {report.data && <ModuleProgress courses={report.data.courses} />}
        </div>
        <div className="space-y-6">
          {report.isPending ? (
            <Skeleton className="h-64" />
          ) : report.isError ? (
            <ErrorState message={getErrorMessage(report.error)} onRetry={report.refetch} />
          ) : (
            <>
              <AssignmentsCard assignments={report.data.assignments} />
              <SubmissionsCard
                submissions={report.data.submissions}
                marks={report.data.marks}
                from={from}
              />
              <Card aria-label="Recent activity">
                <CardHeader title="Recent activity" />
                <CardBody>
                  <ActivityList items={report.data.activity} showStudent={false} />
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
