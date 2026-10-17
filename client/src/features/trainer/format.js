/** Review queue tabs; `value` is the server's review state (`all` sends none). */
export const REVIEW_TABS = [
  { value: 'submitted', label: 'To review' },
  { value: 'resubmitted', label: 'Resubmissions' },
  { value: 'resubmit_requested', label: 'Waiting for student' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'all', label: 'All' },
];

export const LEARNING_FILTERS = [
  { value: '', label: 'Any learning state' },
  { value: 'to_review', label: 'Has work to review' },
  { value: 'overdue', label: 'Has overdue work' },
  { value: 'not_started', label: 'Not started a course' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed a course' },
];

export const ENROLLMENT_FILTERS = [
  { value: '', label: 'Any enrollment' },
  { value: 'active', label: 'Enrolled' },
  { value: 'pending', label: 'Request pending' },
  { value: 'removed', label: 'Removed' },
  { value: 'none', label: 'Not enrolled' },
];

/** Badge tone and label for an enrollment status. */
export const ENROLLMENT_BADGE = {
  active: { tone: 'success', label: 'Enrolled' },
  pending: { tone: 'warning', label: 'Request pending' },
  removed: { tone: 'muted', label: 'Removed' },
};

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';

/** "75%", or "—" when there is nothing to average. */
export const formatPercent = (value) => (value == null ? '—' : `${value}%`);

export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const studentPath = (id) => `/admin/students/${id}`;
export const courseReportPath = (id) => `/admin/reports/courses/${id}`;
export const assignmentAdminPath = (courseId, assignmentId) =>
  `/admin/courses/${courseId}/assignments/${assignmentId}`;
/** The Phase 4 review page for one attempt. */
export const reviewPath = (row) =>
  `${assignmentAdminPath(row.course.id, row.assignment.id)}/submissions/${row.id}`;

const title = (ref, fallback) => ref?.title ?? fallback;

/** One activity event as a sentence about the student. */
export function activityText(activity) {
  const course = title(activity.course, 'a deleted course');
  const assignment = title(activity.assignment, 'an assignment');
  switch (activity.type) {
    case 'registered':
      return 'signed up';
    case 'login':
      return 'signed in';
    case 'enrollment_requested':
      return `asked to join ${course}`;
    case 'enrolled':
      return `was enrolled in ${course}`;
    case 'enrollment_removed':
      return `was removed from ${course}`;
    case 'lesson_completed':
      return `completed ${title(activity.lesson, 'a lesson')} in ${course}`;
    case 'submission_created':
      return activity.attempt > 1
        ? `handed in attempt ${activity.attempt} of ${assignment}`
        : `handed in ${assignment}`;
    case 'submission_reviewed':
      return `received a review of ${assignment}`;
    case 'resubmission_requested':
      return `was asked to resubmit ${assignment}`;
    default:
      return activity.type;
  }
}
