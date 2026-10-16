import { useAssignments } from '../api.js';
import { AssignmentList } from './AssignmentParts.jsx';
import { ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

/** The enrolled student's assignments for a course, on the course page. */
export function CourseAssignments({ courseId }) {
  const { data, isPending, isError, error, refetch } = useAssignments({
    course: courseId,
    limit: 100,
  });
  return (
    <section aria-labelledby="course-assignments-heading" className="space-y-3">
      <h2 id="course-assignments-heading" className="text-lg font-semibold text-slate-900">
        Assignments
      </h2>
      {isPending ? (
        <Skeleton className="h-24" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No assignments have been set for this course yet.</p>
      ) : (
        <AssignmentList
          assignments={data.items}
          pathFor={(a) => `/app/courses/${courseId}/assignments/${a.id}`}
        />
      )}
    </section>
  );
}

/**
 * Assignments that belong to one lesson, under its materials. Shown only when
 * there are some. `pathFor` points at the student page or the trainer's page.
 */
export function LessonAssignments({ lessonId, pathFor, showState }) {
  const { data } = useAssignments({ lesson: lessonId });
  if (!data?.items.length) return null;
  return (
    <section aria-labelledby="lesson-assignments-heading" className="space-y-3">
      <h2 id="lesson-assignments-heading" className="text-lg font-semibold text-slate-900">
        Practice assignments
      </h2>
      <AssignmentList assignments={data.items} pathFor={pathFor} showState={showState} />
    </section>
  );
}
