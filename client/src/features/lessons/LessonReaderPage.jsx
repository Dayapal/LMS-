import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLesson, useLessonNavigation, useMaterials } from './api.js';
import { LessonMaterials } from './components/MaterialBlock.jsx';
import { LessonAssignments } from '../assignments/components/AssignmentSections.jsx';
import { formatDateTime } from '../assignments/format.js';
import { formatMinutes } from '../courses/format.js';
import { useLessonCompletion, useRecordLessonVisit } from '../progress/api.js';
import { completionMessage } from '../progress/format.js';
import { Icon } from '../../components/Icon.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../utils/apiErrors.js';

/** Where links point: the student reader, or the trainer's preview of it. */
const PATHS = {
  student: {
    course: (courseId) => `/app/courses/${courseId}`,
    lesson: (courseId, lessonId) => `/app/courses/${courseId}/lessons/${lessonId}`,
    assignment: (courseId, assignmentId) => `/app/courses/${courseId}/assignments/${assignmentId}`,
    backLabel: 'Back to the course',
  },
  preview: {
    course: (courseId, lessonId) => `/admin/courses/${courseId}/lessons/${lessonId}`,
    lesson: (courseId, lessonId) => `/admin/courses/${courseId}/lessons/${lessonId}/preview`,
    assignment: (courseId, assignmentId) =>
      `/admin/courses/${courseId}/assignments/${assignmentId}`,
    backLabel: 'Back to the materials editor',
  },
};

function LessonNav({ navigation, courseId, paths }) {
  if (!navigation || (!navigation.previous && !navigation.next)) return null;
  const card = (item, direction) => (
    <Link
      to={paths.lesson(courseId, item.id)}
      rel={direction === 'previous' ? 'prev' : 'next'}
      className={`group flex flex-col rounded-2xl border border-slate-200/80 bg-white/75 p-5 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-[0_8px_25px_rgba(3,174,210,0.12)] dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-cyan-400/40 dark:hover:bg-white/[0.08] ${
        direction === 'next' ? 'sm:col-start-2 sm:text-right' : ''
      }`}
    >
      <span className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {direction === 'previous' ? '← Previous lesson' : 'Next lesson →'}
      </span>
      <span className="mt-1 font-semibold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-cyan-400">
        {item.title}
      </span>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.moduleTitle}</span>
    </Link>
  );
  return (
    <nav aria-label="Lesson navigation" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      {navigation.previous && card(navigation.previous, 'previous')}
      {navigation.next && card(navigation.next, 'next')}
    </nav>
  );
}

/**
 * The student's "Mark as complete" switch. The server decides what counts and
 * answers with the new course progress. The result is shown (and read out)
 * inside this panel rather than as a toast, so nothing covers the
 * "Next lesson" link below it.
 */
function CompletionControl({ lesson }) {
  const completion = useLessonCompletion(lesson.id);
  const { completed, completedAt } = lesson.completion;
  const [feedback, setFeedback] = useState(null);

  const toggle = () =>
    completion.mutate(!completed, {
      onSuccess: (result) => setFeedback({ tone: 'success', text: completionMessage(result) }),
      onError: (error) => setFeedback({ tone: 'error', text: getErrorMessage(error) }),
    });

  return (
    <section
      aria-label="Lesson completion"
      className={`rounded-2xl border p-5 backdrop-blur-xl transition-all ${
        completed
          ? 'border-emerald-300/60 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-950/30'
          : 'border-slate-200/80 bg-white/75 dark:border-white/10 dark:bg-white/[0.05]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {completed ? (
          <p className="flex items-center gap-2 text-sm text-emerald-900 dark:text-emerald-200">
            <Icon name="check" className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <span className="font-semibold">Completed</span>
              {completedAt && <> on {formatDateTime(completedAt)}</>}
            </span>
          </p>
        ) : (
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Worked through the materials? Mark the lesson as complete to track your progress.
          </p>
        )}
        <Button
          variant={completed ? 'secondary' : 'primary'}
          size="sm"
          loading={completion.isPending}
          onClick={toggle}
          className="shrink-0"
        >
          {completed ? 'Mark as not completed' : 'Mark as complete'}
        </Button>
      </div>
      {/* Always rendered, so screen readers announce each new message. */}
      <p
        role="status"
        className={`text-sm ${feedback ? 'mt-3' : ''} ${
          feedback?.tone === 'error' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-medium text-slate-700 dark:text-slate-200'
        }`}
      >
        {feedback?.text}
      </p>
    </section>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" role="status" aria-label="Loading lesson">
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
  // An enrolled student's lesson (it carries their completion) becomes their continue point.
  useRecordLessonVisit(loadedId, !preview && Boolean(lesson.data?.completion));

  const backLink = (
    <Link
      to={paths.course(courseId, lessonId)}
      className="inline-block text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
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
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                to={preview ? `/admin/courses/${data.course.id}` : paths.course(data.course.id)}
                className="transition-colors hover:text-slate-800 dark:hover:text-slate-200"
              >
                {data.course.title}
              </Link>
            </li>
            <li aria-hidden="true" className="opacity-50">/</li>
            <li className="font-medium text-slate-700 dark:text-slate-300">{data.module.title}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-slate-900 focus:outline-none dark:text-white sm:text-3xl"
          >
            {data.title}
          </h1>
          {preview && data.status !== 'published' && <StatusBadge status={data.status} />}
          {data.completion?.completed && <Badge tone="success">Completed</Badge>}
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {position?.total ? `Lesson ${position.position} of ${position.total}` : null}
          {position?.total && data.estimatedMinutes ? ' · ' : null}
          {data.estimatedMinutes ? formatMinutes(data.estimatedMinutes) : null}
        </p>
        {data.summary && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{data.summary}</p>}
      </div>

      {preview && (
        <Alert tone="info" title="Trainer preview">
          This is how students see the lesson. Drafts and archived items are shown here with a
          badge, but students only see published content.
        </Alert>
      )}

      {(data.objectives.length > 0 || data.prerequisites.length > 0) && (
        <div className="grid gap-4 rounded-3xl border border-brand-500/20 bg-brand-500/[0.05] p-6 backdrop-blur-md dark:border-cyan-500/20 dark:bg-cyan-500/[0.05] sm:grid-cols-2">
          {data.objectives.length > 0 && (
            <section aria-labelledby="objectives-heading">
              <h2 id="objectives-heading" className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                In this lesson you will
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {data.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </section>
          )}
          {data.prerequisites.length > 0 && (
            <section aria-labelledby="prerequisites-heading">
              <h2 id="prerequisites-heading" className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Before you start
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {data.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {materials.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading study materials">
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

      <LessonAssignments
        lessonId={data.id}
        pathFor={(assignment) => paths.assignment(data.course.id, assignment.id)}
        showState={!preview}
      />

      {!preview && data.completion && <CompletionControl lesson={data} />}

      <div className="border-t border-slate-200/80 pt-6 dark:border-white/10">
        <LessonNav navigation={position} courseId={data.course.id} paths={paths} />
      </div>
    </article>
  );
}
