import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useLesson, useLessonNavigation, useMaterials } from './api.js';
import { LessonMaterials } from './components/MaterialBlock.jsx';
import { formatMinutes } from '../courses/format.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../utils/apiErrors.js';

/** Where links point: the student reader, or the trainer's preview of it. */
const PATHS = {
  student: {
    course: (courseId) => `/app/courses/${courseId}`,
    lesson: (courseId, lessonId) => `/app/courses/${courseId}/lessons/${lessonId}`,
    backLabel: 'Back to the course',
  },
  preview: {
    course: (courseId, lessonId) => `/admin/courses/${courseId}/lessons/${lessonId}`,
    lesson: (courseId, lessonId) => `/admin/courses/${courseId}/lessons/${lessonId}/preview`,
    backLabel: 'Back to the materials editor',
  },
};

function LessonNav({ navigation, courseId, paths }) {
  if (!navigation || (!navigation.previous && !navigation.next)) return null;
  const card = (item, direction) => (
    <Link
      to={paths.lesson(courseId, item.id)}
      rel={direction === 'previous' ? 'prev' : 'next'}
      className={`group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-brand-300 hover:bg-brand-50/40 ${
        direction === 'next' ? 'sm:col-start-2 sm:text-right' : ''
      }`}
    >
      <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {direction === 'previous' ? '← Previous lesson' : 'Next lesson →'}
      </span>
      <span className="mt-1 font-medium text-slate-900 group-hover:text-brand-800">
        {item.title}
      </span>
      <span className="text-xs text-slate-500">{item.moduleTitle}</span>
    </Link>
  );
  return (
    <nav aria-label="Lesson navigation" className="grid gap-3 sm:grid-cols-2">
      {navigation.previous && card(navigation.previous, 'previous')}
      {navigation.next && card(navigation.next, 'next')}
    </nav>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-label="Loading lesson">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * The lesson reader: objectives, then each study material in order, then
 * previous/next navigation through the course.
 * `mode="preview"` is the trainer's view of the same page, drafts included.
 */
export function LessonReaderPage({ mode = 'student' }) {
  const { courseId, lessonId } = useParams();
  const paths = PATHS[mode];
  const preview = mode === 'preview';
  const lesson = useLesson(lessonId);
  const materials = useMaterials(lessonId);
  const navigation = useLessonNavigation(lessonId);
  const headingRef = useRef(null);

  // Moving between lessons keeps the same component mounted: start at the top
  // and move focus to the new title for keyboard and screen reader users.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lessonId]);
  const loadedId = lesson.data?.id;
  useEffect(() => {
    if (loadedId) headingRef.current?.focus();
  }, [loadedId]);

  const backLink = (
    <Link
      to={paths.course(courseId, lessonId)}
      className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
    >
      ← {paths.backLabel}
    </Link>
  );

  if (lesson.isPending) return <ReaderSkeleton />;
  if (lesson.isError) {
    const notFound = lesson.error.response?.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState
          message={
            notFound
              ? 'This lesson is not available. It may be unpublished, or you may not be enrolled in this course yet.'
              : getErrorMessage(lesson.error)
          }
          onRetry={notFound ? undefined : lesson.refetch}
        />
        {backLink}
      </div>
    );
  }

  const data = lesson.data;
  const position = navigation.data;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        {backLink}
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                to={preview ? `/admin/courses/${data.course.id}` : paths.course(data.course.id)}
                className="hover:text-slate-800"
              >
                {data.course.title}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>{data.module.title}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
          >
            {data.title}
          </h1>
          {preview && data.status !== 'published' && <StatusBadge status={data.status} />}
        </div>
        <p className="text-sm text-slate-500">
          {position?.total ? `Lesson ${position.position} of ${position.total}` : null}
          {position?.total && data.estimatedMinutes ? ' · ' : null}
          {data.estimatedMinutes ? formatMinutes(data.estimatedMinutes) : null}
        </p>
        {data.summary && <p className="text-slate-700">{data.summary}</p>}
      </div>

      {preview && (
        <Alert tone="info" title="Trainer preview">
          This is how students see the lesson. Drafts and archived items are shown here with a
          badge, but students only see published content.
        </Alert>
      )}

      {(data.objectives.length > 0 || data.prerequisites.length > 0) && (
        <div className="grid gap-4 rounded-xl border border-brand-100 bg-brand-50/50 p-5 sm:grid-cols-2">
          {data.objectives.length > 0 && (
            <section aria-labelledby="objectives-heading">
              <h2 id="objectives-heading" className="text-sm font-semibold text-slate-900">
                In this lesson you will
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {data.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </section>
          )}
          {data.prerequisites.length > 0 && (
            <section aria-labelledby="prerequisites-heading">
              <h2 id="prerequisites-heading" className="text-sm font-semibold text-slate-900">
                Before you start
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {data.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {materials.isPending ? (
        <div className="space-y-4" aria-label="Loading study materials">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-48" />
        </div>
      ) : materials.isError ? (
        <ErrorState message={getErrorMessage(materials.error)} onRetry={materials.refetch} />
      ) : materials.data.length === 0 ? (
        <EmptyState title="No study materials yet">
          {preview
            ? 'Add notes, code, files or links in the materials editor.'
            : "Your trainer hasn't added study materials to this lesson yet."}
        </EmptyState>
      ) : (
        <LessonMaterials materials={materials.data} showStatus={preview} />
      )}

      <div className="border-t border-slate-200 pt-6">
        <LessonNav navigation={position} courseId={data.course.id} paths={paths} />
      </div>
    </article>
  );
}
