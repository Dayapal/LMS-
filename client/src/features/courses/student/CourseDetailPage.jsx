import { Link, useParams } from 'react-router';
import { useRoadmap } from '../api.js';
import { CourseCover } from '../components/CourseCover.jsx';
import { EnrollmentAction, EnrollmentBadge } from './EnrollmentAction.jsx';
import { LEVEL_LABEL, formatMinutes, plural } from '../format.js';
import { LazyMarkdownView } from '../../../components/content/LazyMarkdownView.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Card, CardBody } from '../../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

/**
 * The roadmap of published modules and lessons. Lessons link to the reader
 * once the student's enrollment is active (`lessonPath` is set).
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
    <ol className="relative space-y-6 border-l-2 border-brand-100 pl-6 sm:pl-8">
      {modules.map((module, index) => (
        <li key={module.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[2.3rem] flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white ring-4 ring-slate-50 sm:-left-[2.8rem]"
          >
            {index + 1}
          </span>
          <Card>
            <CardBody className="space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  <span className="sr-only">Module {index + 1}: </span>
                  {module.title}
                </h3>
                {module.description && (
                  <p className="mt-1 text-sm text-slate-600">{module.description}</p>
                )}
              </div>
              {module.lessons.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <li key={lesson.id} className="flex gap-3 px-3 py-2.5">
                      <span className="w-8 shrink-0 pt-0.5 text-xs font-medium text-slate-400">
                        {index + 1}.{lessonIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {lessonPath ? (
                            <Link
                              to={lessonPath(lesson.id)}
                              className="text-brand-700 hover:text-brand-800 hover:underline"
                            >
                              {lesson.title}
                            </Link>
                          ) : (
                            lesson.title
                          )}
                        </p>
                        {lesson.summary && (
                          <p className="text-sm text-slate-500">{lesson.summary}</p>
                        )}
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs text-slate-500">
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
      <div className="space-y-6" aria-label="Loading course">
        <Skeleton className="h-48" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32" />
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
        <Link to="/app/courses" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          ← Back to the catalogue
        </Link>
      </div>
    );
  }

  const { course, modules } = data;
  const enrolled = course.enrollment?.status === 'active';
  const lessonPath = enrolled
    ? (lessonId) => `/app/courses/${course.id}/lessons/${lessonId}`
    : undefined;
  const firstLesson = modules.find((m) => m.lessons.length > 0)?.lessons[0];

  return (
    <div className="space-y-8">
      <Link
        to="/app/courses"
        className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        ← Course catalogue
      </Link>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs lg:grid lg:grid-cols-[2fr_3fr]">
        <CourseCover course={course} className="h-44 lg:h-full" />
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{LEVEL_LABEL[course.level]}</Badge>
            <EnrollmentBadge enrollment={course.enrollment} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {course.title}
          </h1>
          <p className="text-slate-600">{course.summary}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <div>
              <dt className="inline text-slate-500">Modules: </dt>
              <dd className="inline font-medium">{course.stats.moduleCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Lessons: </dt>
              <dd className="inline font-medium">{course.stats.lessonCount}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Estimated: </dt>
              <dd className="inline font-medium">{course.estimatedHours} hours</dd>
            </div>
          </dl>
          <EnrollmentAction course={course} />
          {enrolled && firstLesson && (
            <Link
              to={lessonPath(firstLesson.id)}
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start with “{firstLesson.title}”
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="roadmap-heading" className="space-y-4">
          <div>
            <h2 id="roadmap-heading" className="text-lg font-semibold text-slate-900">
              Roadmap
            </h2>
            <p className="text-sm text-slate-500">
              {plural(modules.length, 'module')} · {formatMinutes(course.stats.totalMinutes)} of
              guided lessons
            </p>
          </div>
          <RoadmapTimeline modules={modules} lessonPath={lessonPath} />
        </section>

        {course.description && (
          <section aria-labelledby="about-heading" className="space-y-3 lg:order-last">
            <h2 id="about-heading" className="text-lg font-semibold text-slate-900">
              About this course
            </h2>
            <LazyMarkdownView className="text-sm leading-6">{course.description}</LazyMarkdownView>
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
    </div>
  );
}
