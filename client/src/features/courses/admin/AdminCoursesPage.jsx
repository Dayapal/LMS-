import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCourseMutation, useCourses, coursesApi } from '../api.js';
import { CourseFormModal } from './CourseFormModal.jsx';
import { CourseCover } from '../components/CourseCover.jsx';
import { LEVEL_LABEL, plural } from '../format.js';
import { Button } from '../../../components/ui/Button.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { FilterPills } from '../../../components/ui/FilterPills.jsx';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from '../../../components/ui/Feedback.jsx';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

const TABS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

export function AdminCoursesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? 1);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const q = useDebouncedValue(search.trim(), 300);
  const [creating, setCreating] = useState(false);

  const params = { page, limit: 12, ...(status && { status }), ...(q && { q }) };
  const { data, isPending, isError, error, refetch, isFetching } = useCourses(params);
  const create = useCourseMutation(coursesApi.create);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async (values) => {
    const course = await create.mutateAsync(values);
    toast.success('Course created as a draft.');
    setCreating(false);
    navigate(`/admin/courses/${course.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Create courses, build roadmaps and control what students can see."
        actions={<Button onClick={() => setCreating(true)}>New course</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          label="Filter by status"
          options={TABS}
          value={status}
          onChange={(value) => updateParams({ status: value, page: '' })}
        />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            updateParams({ q: event.target.value.trim(), page: '' });
          }}
          placeholder="Search courses"
          aria-label="Search courses"
          className="w-full rounded-xl border border-slate-300/80 bg-white/80 px-3.5 py-2 text-sm text-slate-900 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 sm:w-64"
        />
      </div>

      {isPending ? (
        <CourseListSkeleton />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={q || status ? 'No courses match' : 'No courses yet'}
          action={
            !q &&
            !status && <Button onClick={() => setCreating(true)}>Create your first course</Button>
          }
        >
          {q || status
            ? 'Try a different search or status filter.'
            : 'Run the seed or create a course to get started.'}
        </EmptyState>
      ) : (
        <>
          <ul
            className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? 'opacity-70' : ''}`}
          >
            {data.items.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/admin/courses/${course.id}`}
                  className="group block overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-[0_12px_35px_rgba(3,174,210,0.15)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] dark:hover:border-cyan-400/40 dark:hover:bg-white/[0.08]"
                >
                  <CourseCover course={course} className="h-32" />
                  <div className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold tracking-tight text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-cyan-400">
                        {course.title}
                      </h2>
                      <StatusBadge status={course.status} />
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {LEVEL_LABEL[course.level]} · {plural(course.stats.moduleCount, 'module')} ·{' '}
                      {plural(course.stats.lessonCount, 'lesson')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={(p) => updateParams({ page: String(p) })} />
        </>
      )}

      <CourseFormModal open={creating} onClose={() => setCreating(false)} onSubmit={handleCreate} />
    </div>
  );
}

export function CourseListSkeleton() {
  return (
    <ul
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Loading courses"
    >
      {[0, 1, 2].map((i) => (
        <li key={i} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.05]">
          <Skeleton className="h-32 rounded-none" />
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
