/*
 * Course progress (spec §5) as pure functions of the course's countable lessons
 * and one student's completion records. Never stored, so it follows the
 * trainer's changes:
 *
 * - Countable lessons are the ones a student sees on the roadmap: published
 *   lessons in published modules, in course order (module order, then lesson
 *   order). Callers load them through `visibleTo` in access.service.js.
 * - Progress = completed countable lessons ÷ countable lessons. Completions of
 *   lessons that are hidden now (unpublished, archived, in an unpublished
 *   module) are kept but don't count, in either number.
 * - The percentage is rounded down, so 100% always means every lesson is done.
 */

/** Completed ÷ total as a whole percentage, rounded down; 0 when there is nothing to complete. */
export const progressPercent = (completedLessons, totalLessons) =>
  totalLessons ? Math.floor((completedLessons * 100) / totalLessons) : 0;

/** Whether every countable lesson is done (never for a course without lessons). */
export const isCourseComplete = (completedLessons, totalLessons) =>
  totalLessons > 0 && completedLessons === totalLessons;

/**
 * `lessons`: countable lessons in course order, each with a string `id`.
 * `completedAt`: Map of lesson id → completion date (other courses' entries are ignored).
 */
export function courseProgress(lessons, completedAt) {
  let completedLessons = 0;
  let lastCompletedAt = null;
  for (const lesson of lessons) {
    const at = completedAt.get(lesson.id);
    if (!at) continue;
    completedLessons += 1;
    if (!lastCompletedAt || at > lastCompletedAt) lastCompletedAt = at;
  }
  const totalLessons = lessons.length;
  return {
    completedLessons,
    totalLessons,
    percent: progressPercent(completedLessons, totalLessons),
    completed: isCourseComplete(completedLessons, totalLessons),
    lastCompletedAt,
  };
}

/**
 * Where "continue learning" leads, or null when there's nothing left to do.
 * - `resume`: the last lesson the student opened, while it isn't completed.
 * - `next`: the first incomplete lesson after it (wrapping to the start), or
 *   the first incomplete lesson when the last one opened is gone.
 * - `start`: the first lesson, while no countable lesson is completed and the
 *   last lesson opened (if any) is no longer on the roadmap.
 */
export function nextLesson(lessons, completedAt, lastLessonId) {
  const isOpen = (lesson) => !completedAt.has(lesson.id);
  const lastIndex = lastLessonId ? lessons.findIndex((l) => l.id === lastLessonId) : -1;

  if (lastIndex >= 0) {
    if (isOpen(lessons[lastIndex])) return { lesson: lessons[lastIndex], kind: 'resume' };
    const after = lessons.slice(lastIndex + 1).find(isOpen) ?? lessons.find(isOpen);
    return after ? { lesson: after, kind: 'next' } : null;
  }

  const first = lessons.find(isOpen);
  if (!first) return null;
  return { lesson: first, kind: lessons.every(isOpen) ? 'start' : 'next' };
}
