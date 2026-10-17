import { Link } from 'react-router';
import { Welcome } from '../../dashboard/DashboardPages.jsx';
import { coursesApi, useCourseMutation } from '../../courses/api.js';
import { formatDateTime, relativeTime } from '../../assignments/format.js';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { StatTile } from '../../../components/ui/StatTile.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useTrainerDashboard } from '../api.js';
import {
  assignmentAdminPath,
  courseReportPath,
  formatPercent,
  plural,
  reviewPath,
  studentPath,
} from '../format.js';
import { ActivityList, linkClass } from '../components/TrainerParts.jsx';

const QUEUE_FROM = { pathname: '/admin', search: '', label: 'Dashboard' };

function Stats({ summary }) {
  const { students, enrollments, reviews, overdue } = summary;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Students"
        value={students.total}
        to="/admin/students"
        hint={`${students.enrolled} enrolled · ${students.activeThisWeek} active this week`}
      />
      <StatTile
        label="Active enrollments"
        value={enrollments.active}
        hint={
          enrollments.pending
            ? `${plural(enrollments.pending, 'request')} pending`
            : 'No pending requests'
        }
      />
      <StatTile
        label="Waiting for review"
        value={reviews.submitted}
        to="/admin/reviews"
        hint={
          reviews.resubmitted
            ? `${plural(reviews.resubmitted, 'resubmission')} · ${reviews.resubmit_requested} sent back`
            : `${reviews.resubmit_requested} sent back to students`
        }
      />
      <StatTile
        label="Overdue assignments"
        value={overdue.total}
        tone="danger"
        to="/admin/students?learning=overdue"
        hint={overdue.total ? `across ${plural(overdue.students, 'student')}` : 'Nothing overdue'}
      />
    </dl>
  );
}

function ReviewQueueCard({ rows, total }) {
  return (
    <Card aria-label="Waiting for review">
      <CardHeader
        title="Waiting for review"
        description="The longest-waiting first"
        actions={
          <Link to="/admin/reviews" className={`${linkClass} text-sm`}>
            Review queue{total > rows.length ? ` (${total})` : ''}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">You&apos;re all caught up.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {row.student.name ?? 'A deleted student'} · {row.assignment?.title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {row.course?.title} · {row.attempt > 1 ? `Attempt ${row.attempt} · ` : ''}
                  {relativeTime(row.submittedAt)}
                  {row.isLate ? ' · late' : ''}
                </p>
              </div>
              <Link
                to={reviewPath(row)}
                state={{ from: QUEUE_FROM }}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                aria-label={`Review ${row.student.name}'s ${row.assignment?.title}`}
              >
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PendingRequestsCard({ requests }) {
  const toast = useToast();
  const update = useCourseMutation(({ id, status }) => coursesApi.updateEnrollment(id, status));
  const decide = async (request, status) => {
    try {
      await update.mutateAsync({ id: request.id, status });
      toast.success(status === 'active' ? `${request.user.name} enrolled.` : 'Request declined.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  if (requests.total === 0) return null;
  return (
    <Card aria-label="Enrollment requests">
      <CardHeader
        title="Enrollment requests"
        description={`${plural(requests.total, 'request')} waiting`}
        actions={
          requests.total > requests.items.length && (
            <Link to="/admin/students?enrollment=pending" className={`${linkClass} text-sm`}>
              All requests
            </Link>
          )
        }
      />
      <ul className="divide-y divide-slate-100">
        {requests.items.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <Link to={studentPath(request.user.id)} className={`${linkClass} text-sm`}>
                {request.user.name}
              </Link>
              <p className="truncate text-xs text-slate-500">
                {request.course.title} · {relativeTime(request.updatedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => decide(request, 'active')}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={update.isPending}
                onClick={() => decide(request, 'removed')}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CoursesCard({ courses }) {
  return (
    <Card aria-label="Courses">
      <CardHeader
        title="Courses"
        description="Average progress of the students enrolled now"
        actions={
          <Link to="/admin/reports" className={`${linkClass} text-sm`}>
            Reports
          </Link>
        }
      />
      {courses.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">
            No courses yet.{' '}
            <Link to="/admin/courses" className={linkClass}>
              Create one
            </Link>
            .
          </p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {courses.map((course) => (
            <li key={course.id} className="space-y-2 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    to={courseReportPath(course.id)}
                    className={`${linkClass} truncate text-sm`}
                  >
                    {course.title}
                  </Link>
                  {course.status !== 'published' && <StatusBadge status={course.status} />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {course.reviews.submitted > 0 && (
                    <Badge tone="info">{course.reviews.submitted} to review</Badge>
                  )}
                  {course.overdue > 0 && <Badge tone="danger">{course.overdue} overdue</Badge>}
                </div>
              </div>
              <ProgressBar
                value={course.progress.averagePercent ?? 0}
                label={`${course.title} average progress`}
                size="sm"
              />
              <p className="flex flex-wrap gap-x-3 text-xs text-slate-600">
                <span>Average {formatPercent(course.progress.averagePercent)}</span>
                <span>{plural(course.enrollments.active, 'student')}</span>
                {course.progress.completedStudents > 0 && (
                  <span>{course.progress.completedStudents} completed</span>
                )}
                {course.enrollments.pending > 0 && (
                  <span>{course.enrollments.pending} pending</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeadlinesCard({ title, description, rows, empty, overdue = false }) {
  return (
    <Card aria-label={title}>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">{empty}</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="px-5 py-3 sm:px-6">
              <Link
                to={assignmentAdminPath(row.course.id, row.id)}
                className={`${linkClass} text-sm`}
              >
                {row.title}
              </Link>
              <p className="truncate text-xs text-slate-500">
                {row.course.title} · Due {formatDateTime(row.dueAt)} ({relativeTime(row.dueAt)})
              </p>
              <p className="text-xs text-slate-600">
                {row.stats.handedIn} of {row.stats.expected} handed in
                {overdue ? (
                  <span className="font-medium text-red-700"> · {row.stats.overdue} missing</span>
                ) : (
                  row.stats.pending > 0 && ` · ${row.stats.pending} still to hand in`
                )}
                {overdue && new Date(row.closesAt) > new Date() && ' · late work still accepted'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/** The trainer's home (GET /dashboard/admin): what needs attention, with links to act on it. */
export function TrainerDashboardPage() {
  const { data, isPending, isError, error, refetch } = useTrainerDashboard();

  let body;
  if (isPending) body = <DashboardSkeleton />;
  else if (isError) body = <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;
  else {
    body = (
      <div className="space-y-6">
        <Stats summary={data.summary} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ReviewQueueCard rows={data.reviewQueue} total={data.summary.reviews.submitted} />
            <PendingRequestsCard requests={data.pendingRequests} />
            <CoursesCard courses={data.courses} />
          </div>
          <div className="space-y-6">
            <DeadlinesCard
              title="Overdue"
              description="Recently due, with students who haven't handed in"
              rows={data.overdue}
              empty="Every student has handed in their past-due work."
              overdue
            />
            <DeadlinesCard
              title="Due this week"
              rows={data.upcoming}
              empty="No assignments are due in the next 7 days."
            />
            <Card aria-label="Recent activity">
              <CardHeader title="Recent activity" />
              <CardBody>
                <ActivityList items={data.recentActivity} />
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Welcome subtitle="Trainer workspace" />
      {body}
    </div>
  );
}
