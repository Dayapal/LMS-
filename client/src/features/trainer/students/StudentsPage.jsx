import { Link } from 'react-router';
import { useCourses } from '../../courses/api.js';
import { relativeTime } from '../../assignments/format.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { useStudents } from '../api.js';
import { ENROLLMENT_FILTERS, formatDate, LEARNING_FILTERS, studentPath } from '../format.js';
import { EnrollmentBadge, FilterSelect, linkClass } from '../components/TrainerParts.jsx';
import { useSearch, useUrlFilters } from '../hooks.jsx';

function CourseLine({ course }) {
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{course.title}</span>
        {course.enrollmentStatus !== 'active' && (
          <EnrollmentBadge status={course.enrollmentStatus} />
        )}
        {course.status === 'archived' && <Badge tone="muted">Course archived</Badge>}
        {course.progress && (
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            {course.progress.percent}% · {course.progress.completedLessons}/
            {course.progress.totalLessons}
          </span>
        )}
      </div>
      {course.progress && course.enrollmentStatus === 'active' && (
        <ProgressBar value={course.progress.percent} label={`${course.title} progress`} size="sm" />
      )}
    </li>
  );
}

function StudentRow({ student }) {
  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-start hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
      <div className="min-w-0">
        <Link to={studentPath(student.id)} className={`${linkClass} text-sm`}>
          {student.name}
        </Link>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{student.email}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {student.lastLoginAt
            ? `Signed in ${relativeTime(student.lastLoginAt)}`
            : `Joined ${formatDate(student.createdAt)}`}
        </p>
      </div>
      {student.courses.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Not enrolled in any course.</p>
      ) : (
        <ul className="min-w-0 space-y-2">
          {student.courses.slice(0, 3).map((course) => (
            <CourseLine key={course.id} course={course} />
          ))}
          {student.courses.length > 3 && (
            <li className="text-xs text-slate-500 dark:text-slate-400">and {student.courses.length - 3} more</li>
          )}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 md:justify-end">
        {student.awaitingReview > 0 && (
          <Badge tone="info">{student.awaitingReview} to review</Badge>
        )}
        {student.overdue > 0 && <Badge tone="danger">{student.overdue} overdue</Badge>}
        {student.enrollments.pending > 0 && (
          <Badge tone="warning">
            {student.enrollments.pending} request{student.enrollments.pending === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
    </li>
  );
}

/** Every student account, with search and filters (GET /admin/students). */
export function StudentsPage() {
  const filters = useUrlFilters({ sort: 'name' });
  const { q, input } = useSearch(filters, 'Search by name or email');
  const course = filters.get('course');
  const enrollment = filters.get('enrollment');
  const learning = filters.get('learning');
  const sort = filters.get('sort');
  const params = {
    page: filters.page,
    limit: 20,
    sort,
    ...(q && { q }),
    ...(course && { course }),
    ...(enrollment && { enrollment }),
    ...(learning && { learning }),
  };
  const { data, isPending, isError, error, refetch, isFetching } = useStudents(params);
  const courses = useCourses({ limit: 100 });
  const filtered = Boolean(q || course || enrollment || learning);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Everyone with a student account: their courses, progress and work waiting for you."
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {input}
        <FilterSelect
          label="Course"
          value={course}
          onChange={(value) => filters.update({ course: value })}
        >
          <option value="">All courses</option>
          {courses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Enrollment"
          value={enrollment}
          onChange={(value) => filters.update({ enrollment: value })}
        >
          {ENROLLMENT_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === 'none' && course ? 'Not in this course' : option.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Learning"
          value={learning}
          onChange={(value) => filters.update({ learning: value })}
        >
          {LEARNING_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Order"
          value={sort}
          onChange={(value) => filters.update({ sort: value })}
        >
          <option value="name">Name</option>
          <option value="newest">Newest accounts</option>
          <option value="recent">Recently signed in</option>
        </FilterSelect>
      </div>

      {isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading students">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={filtered ? 'No students match' : 'No students yet'}>
          {filtered
            ? 'Try a different search or filter.'
            : 'Students appear here once they create an account at /register.'}
        </EmptyState>
      ) : (
        <>
          <ul
            aria-label="Students"
            aria-busy={isFetching || undefined}
            className={`divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs ${isFetching ? 'opacity-70' : ''}`}
          >
            {data.items.map((student) => (
              <StudentRow key={student.id} student={student} />
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={(p) => filters.update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
