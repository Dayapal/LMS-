import { Link } from 'react-router';
import { useStudentDashboard } from '../progress/api.js';
import { lessonPath, lessonsDoneText, nextLessonLabel } from '../progress/format.js';
import { CourseCover } from '../courses/components/CourseCover.jsx';
import { SubmissionStateBadge } from '../assignments/components/AssignmentParts.jsx';
import { formatDateTime, formatMarks, relativeTime } from '../assignments/format.js';
import { Welcome } from './DashboardPages.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { StatTile } from '../../components/ui/StatTile.jsx';
import { getErrorMessage } from '../../utils/apiErrors.js';

const linkClass = 'font-medium text-brand-700 hover:text-brand-800 hover:underline';
const buttonLinkClass =
  'inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700';

const assignmentPath = (row) => `/app/courses/${row.course.id}/assignments/${row.id}`;

function Stats({ summary }) {
  const { assignments } = summary;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Active courses" value={summary.activeCourses} />
      <StatTile label="Lessons completed" value={summary.lessonsCompleted} />
      <StatTile label="Overdue assignments" value={assignments.overdue} tone="danger" />
      <StatTile label="Awaiting review" value={assignments.submitted} />
    </dl>
  );
}

function ContinueLearning({ item }) {
  const { course, progress } = item;
  return (
    <section
      aria-labelledby="continue-heading"
      className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-xs sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <CourseCover course={course} className="h-32 sm:h-full" />
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <p
            id="continue-heading"
            className="text-xs font-semibold tracking-wide text-brand-700 uppercase"
          >
            Continue learning
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h2>
          <p className="text-sm text-slate-500">{progress.nextLesson.moduleTitle}</p>
        </div>
        <div className="space-y-1.5">
          <ProgressBar value={progress.percent} label={`${course.title} progress`} />
          <p className="text-sm text-slate-600">
            {progress.percent}% · {lessonsDoneText(progress)}
          </p>
        </div>
        <Link to={lessonPath(course.id, progress.nextLesson.id)} className={buttonLinkClass}>
          {nextLessonLabel(progress.nextLesson)}
        </Link>
      </div>
    </section>
  );
}

function CourseRow({ item }) {
  const { course, enrollment, progress } = item;
  return (
    <li className="space-y-2 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/app/courses/${course.id}`} className={linkClass}>
          {course.title}
        </Link>
        {enrollment.status === 'pending' ? (
          <Badge tone="warning">Request pending</Badge>
        ) : progress.completed ? (
          <Badge tone="success">Completed</Badge>
        ) : null}
      </div>
      {progress?.totalLessons === 0 ? (
        <p className="text-sm text-slate-500">No lessons have been published in this course yet.</p>
      ) : progress ? (
        <>
          <ProgressBar value={progress.percent} label={`${course.title} progress`} size="sm" />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-600">
              {progress.percent}% · {lessonsDoneText(progress)}
            </span>
            {progress.nextLesson && (
              <Link
                to={lessonPath(course.id, progress.nextLesson.id)}
                className={`${linkClass} min-w-0 truncate`}
              >
                {nextLessonLabel(progress.nextLesson)} →
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Your trainer will review your request. The lessons open once it is approved.
        </p>
      )}
    </li>
  );
}

function AssignmentRow({ row, children }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <Link to={assignmentPath(row)} className={`${linkClass} text-sm`}>
          {row.title}
        </Link>
        <p className="truncate text-xs text-slate-500">{row.course.title}</p>
        {children}
      </div>
      <SubmissionStateBadge status={row.mySubmission.status} />
    </li>
  );
}

function ToDo({ rows }) {
  return (
    <Card aria-label="To do">
      <CardHeader
        title="To do"
        description="Assignments you can hand in now"
        actions={
          <Link to="/app/assignments" className={`${linkClass} text-sm`}>
            All assignments
          </Link>
        }
      />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Nothing to hand in right now.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <AssignmentRow key={row.id} row={row}>
              <p className="text-xs text-slate-600">
                Due {formatDateTime(row.dueAt)} ({relativeTime(row.dueAt)})
              </p>
            </AssignmentRow>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentFeedback({ rows }) {
  if (rows.length === 0) return null;
  return (
    <Card aria-label="Recent feedback">
      <CardHeader title="Recent feedback" />
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <AssignmentRow key={row.id} row={row}>
            <p className="text-xs text-slate-600">
              {row.mySubmission.status === 'reviewed'
                ? `Marks: ${formatMarks(row.mySubmission.latest.finalMarks, row.maxMarks)}`
                : 'Your trainer asked for a new attempt'}{' '}
              · {relativeTime(row.mySubmission.latest.reviewedAt)}
            </p>
          </AssignmentRow>
        ))}
      </ul>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

const catalogueLink = (
  <Link to="/app/courses" className="font-medium text-brand-700 hover:text-brand-800">
    course catalogue
  </Link>
);

export function StudentDashboardPage() {
  const { data, isPending, isError, error, refetch } = useStudentDashboard();

  let body;
  if (isPending) {
    body = <DashboardSkeleton />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;
  } else if (data.courses.length === 0) {
    body = (
      <EmptyState title="Find your next course">
        Browse the {catalogueLink} and request to join a course. Once your trainer approves it, your
        progress will show up here.
      </EmptyState>
    );
  } else {
    const { activeCourses, completedCourses } = data.summary;
    const allDone = activeCourses > 0 && completedCourses === activeCourses;
    body = (
      <div className="space-y-6">
        <Stats summary={data.summary} />
        {data.continueLearning ? (
          <ContinueLearning item={data.continueLearning} />
        ) : allDone ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"
          >
            You&apos;ve completed every published lesson in your courses. Browse the {catalogueLink}{' '}
            for what to learn next.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card aria-label="My courses">
            <CardHeader title="My courses" />
            <ul className="divide-y divide-slate-100">
              {data.courses.map((item) => (
                <CourseRow key={item.course.id} item={item} />
              ))}
            </ul>
          </Card>
          <div className="space-y-6">
            <ToDo rows={data.upcoming} />
            <RecentFeedback rows={data.recentFeedback} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Welcome subtitle="Your learning dashboard" />
      {body}
    </div>
  );
}
