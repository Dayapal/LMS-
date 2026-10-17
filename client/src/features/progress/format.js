/** "3 of 12 lessons completed" */
export const lessonsDoneText = ({ completedLessons, totalLessons }) =>
  `${completedLessons} of ${totalLessons} lesson${totalLessons === 1 ? '' : 's'} completed`;

const NEXT_LABEL = { start: 'Start', resume: 'Continue', next: 'Up next' };

/** The button label for a course's next lesson: "Continue: Flexbox Layouts". */
export const nextLessonLabel = (nextLesson) =>
  `${NEXT_LABEL[nextLesson.kind] ?? 'Continue'}: ${nextLesson.title}`;

export const lessonPath = (courseId, lessonId) => `/app/courses/${courseId}/lessons/${lessonId}`;

/** The sentence shown after "Mark as complete" changes, with the course progress from the server. */
export function completionMessage(result) {
  const progress = result.courseProgress;
  if (!result.completed) return 'Lesson marked as not completed.';
  if (progress.completed) return 'You have completed every lesson in this course.';
  return `Lesson completed. ${progress.percent}% · ${lessonsDoneText(progress)}.`;
}
