import { useState } from 'react';
import { Link } from 'react-router';
import { useCourses } from '../api.js';
import { CourseCover } from '../components/CourseCover.jsx';
import { EnrollmentBadge } from './EnrollmentAction.jsx';
import { LEVEL_LABEL, formatMinutes, plural } from '../format.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

export function CourseCatalogPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 300);

  const params = { page, limit: 12, ...(q && { q }), ...(level && { level }) };
  const { data, isPending, isError, error, refetch } = useCourses(params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course catalogue"
        description="Browse the courses on offer and request to join the ones you want to study."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search courses"
          aria-label="Search courses"
          className="w-full rounded-xl border border-slate-300/80 bg-white/80 px-3.5 py-2 text-sm text-slate-900 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 sm:max-w-xs"
        />
        <select
          value={level}
          onChange={(event) => {
            setLevel(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by level"
          className="rounded-xl border border-slate-300/80 bg-white/80 px-3.5 py-2 text-sm text-slate-900 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-slate-900/90 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 sm:w-48 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white"
        >
          <option value="">All levels</option>
          {Object.entries(LEVEL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <ul
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading courses"
        >
          {[0, 1, 2].map((i) => (
            <li key={i} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.05]">
              <Skeleton className="h-36 rounded-none" />
              <div className="space-y-3 p-6">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title={q || level ? 'No courses match' : 'No courses available yet'}>
          {q || level
            ? 'Try another search or level.'
            : 'Your trainer has not published any courses yet. Check back soon.'}
        </EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/app/courses/${course.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-[0_12px_35px_rgba(3,174,210,0.15)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] dark:hover:border-cyan-400/40 dark:hover:bg-white/[0.08]"
                >
                  <CourseCover course={course} />
                  <div className="flex flex-1 flex-col gap-3.5 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{LEVEL_LABEL[course.level]}</Badge>
                      <EnrollmentBadge enrollment={course.enrollment} />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-cyan-400">
                      {course.title}
                    </h2>
                    <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{course.summary}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {plural(course.stats.moduleCount, 'module')} ·{' '}
                      {plural(course.stats.lessonCount, 'lesson')} ·{' '}
                      {formatMinutes(course.stats.totalMinutes)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
