import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCourseMutation, useCourses, coursesApi } from '../api.js';
import { CourseFormModal } from './CourseFormModal.jsx';
import { CourseCover } from '../components/CourseCover.jsx';
import { LEVEL_LABEL, plural } from '../format.js';
import { Button } from '../../../components/ui/Button.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
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
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => updateParams({ status: tab.value, page: '' })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === tab.value
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            updateParams({ q: event.target.value.trim(), page: '' });
          }}
          placeholder="Search courses"
          aria-label="Search courses"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:w-64"
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
            className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? 'opacity-70' : ''}`}
          >
            {data.items.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/admin/courses/${course.id}`}
                  className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-brand-200 hover:shadow-md"
                >
                  <CourseCover course={course} className="h-28" />
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">
                        {course.title}
                      </h2>
                      <StatusBadge status={course.status} />
                    </div>
                    <p className="text-sm text-slate-500">
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
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading courses">
      {[0, 1, 2].map((i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Skeleton className="h-28 rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
