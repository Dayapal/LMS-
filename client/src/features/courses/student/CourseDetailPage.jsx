import { Link, useParams } from 'react-router';
import { useRoadmap } from '../api.js';
import { CourseCover } from '../components/CourseCover.jsx';
import { EnrollmentAction, EnrollmentBadge } from './EnrollmentAction.jsx';
import { LEVEL_LABEL, formatMinutes, plural } from '../format.js';
import { LazyMarkdownView } from '../../../components/content/LazyMarkdownView.jsx';
import { CourseAssignments } from '../../assignments/components/AssignmentSections.jsx';
import { lessonsDoneText, nextLessonLabel } from '../../progress/format.js';
import { Icon } from '../../../components/Icon.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { Card, CardBody } from '../../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

/**
 * The roadmap of published modules and lessons. Lessons link to the reader
 * once the student's enrollment is active (`lessonPath` is set), and then
 * carry the student's own `completed` flag.
 */
function RoadmapTimeline({ modules, lessonPath }) {
  if (modules.length === 0) {
    return (
      <EmptyState title="Roadmap coming soon">
        Your trainer hasn&apos;t published any modules for this course yet.
      </EmptyState>
    );
  }
  return (
    <ol className="relative space-y-6 border-l-2 border-brand-500/20 pl-6 sm:pl-8 dark:border-cyan-500/20">
      {modules.map((module, index) => (
        <li key={module.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[2.3rem] flex size-8 items-center justify-center rounded-full bg-linear-to-r from-brand-500 to-[#029ab8] text-sm font-bold text-white shadow-[0_0_12px_rgba(3,174,210,0.35)] ring-4 ring-[rgb(var(--surface-base))] sm:-left-[2.8rem]"
          >
            {index + 1}
          </span>
          <Card>
            <CardBody className="space-y-3.5">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    <span className="sr-only">Module {index + 1}: </span>
                    {module.title}
                  </h3>
                  {lessonPath && module.lessons.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {module.lessons.filter((l) => l.completed).length} of {module.lessons.length}{' '}
                      done
                    </span>
                  )}
                </div>
                {module.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{module.description}</p>
                )}
              </div>
              {module.lessons.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white/40 dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.02]">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <li key={lesson.id} className="flex gap-3 px-3.5 py-3 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.02]">
                      {lesson.completed ? (
                        <span className="flex w-8 shrink-0 pt-0.5 text-emerald-600 dark:text-emerald-400">
                          <Icon name="check" className="size-4" />
                        </span>
                      ) : (
                        <span className="w-8 shrink-0 pt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {index + 1}.{lessonIndex + 1}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {lessonPath ? (
                            <Link
                              to={lessonPath(lesson.id)}
                              className="text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                            >
                              {lesson.title}
                            </Link>
                          ) : (
                            lesson.title
                          )}
                          {lesson.completed && <span className="sr-only"> (completed)</span>}
                        </p>
                        {lesson.summary && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{lesson.summary}</p>
                        )}
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatMinutes(lesson.estimatedMinutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { data, isPending, isError, error, refetch } = useRoadmap(courseId);

  if (isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading course">
        <Skeleton className="h-56" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-36" />
      </div>
    );
  }
  if (isError) {
    const notFound = error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This course is not available.' : getErrorMessage(error)}
          onRetry={notFound ? undefined : refetch}
        />
        <Link to="/app/courses" className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300">
          ← Back to the catalogue
        </Link>
      </div>
    );
  }

  const { course, modules, progress } = data;
  const enrolled = course.enrollment?.status === 'active';
  const lessonPath = enrolled
    ? (lessonId) => `/app/courses/${course.id}/lessons/${lessonId}`
    : undefined;

  return (
    <div className="space-y-8">
      <Link
        to="/app/courses"
        className="inline-block text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
      >
        ← Course catalogue
      </Link>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:backdrop-blur-2xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] lg:grid lg:grid-cols-[2fr_3fr]">
        <CourseCover course={course} className="h-52 lg:h-full" />
        <div className="space-y-4.5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{LEVEL_LABEL[course.level]}</Badge>
            <EnrollmentBadge enrollment={course.enrollment} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {course.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{course.summary}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <div>
              <dt className="inline text-slate-500 dark:text-slate-400">Modules: </dt>
              <dd className="inline font-semibold text-slate-900 dark:text-white">{course.stats.moduleCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500 dark:text-slate-400">Lessons: </dt>
              <dd className="inline font-semibold text-slate-900 dark:text-white">{course.stats.lessonCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500 dark:text-slate-400">Estimated: </dt>
              <dd className="inline font-semibold text-slate-900 dark:text-white">{course.estimatedHours} hours</dd>
            </div>
          </dl>
          <EnrollmentAction course={course} />
          {enrolled && progress?.totalLessons > 0 && (
            <div className="space-y-1.5 pt-1">
              <ProgressBar value={progress.percent} label="Course progress" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {progress.percent}% · {lessonsDoneText(progress)}
              </p>
            </div>
          )}
          {enrolled && progress?.nextLesson && (
            <Link
              to={lessonPath(progress.nextLesson.id)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-linear-to-r from-brand-500 to-[#029ab8] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:shadow-[0_0_20px_rgba(3,174,210,0.35)] transition-all"
            >
              {nextLessonLabel(progress.nextLesson)}
            </Link>
          )}
          {enrolled && progress?.completed && (
            <p role="status" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              You&apos;ve completed every lesson in this course.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="roadmap-heading" className="space-y-4">
          <div>
            <h2 id="roadmap-heading" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Roadmap
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {plural(modules.length, 'module')} · {formatMinutes(course.stats.totalMinutes)} of
              guided lessons
            </p>
          </div>
          <RoadmapTimeline modules={modules} lessonPath={lessonPath} />
        </section>

        {(enrolled || course.description) && (
          <div className="space-y-8 lg:order-last">
            {enrolled && <CourseAssignments courseId={course.id} />}
            {course.description && (
              <section aria-labelledby="about-heading" className="space-y-3.5">
                <h2 id="about-heading" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  About this course
                </h2>
                <LazyMarkdownView className="text-sm leading-6">
                  {course.description}
                </LazyMarkdownView>
                {course.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2 pt-2" aria-label="Topics">
                    {course.tags.map((tag) => (
                      <li key={tag}>
                        <Badge>{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
