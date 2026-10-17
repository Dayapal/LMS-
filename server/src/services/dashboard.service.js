import { SUBMISSION_STATUS } from '../models/index.js';
import { countStates, myAssignmentRows } from './assignment.service.js';
import { listMyCourses } from './progress.service.js';

const LIST_SIZE = 5;

const FEEDBACK_STATES = new Set([SUBMISSION_STATUS.REVIEWED, SUBMISSION_STATUS.RESUBMIT_REQUESTED]);

/**
 * The student's own dashboard: their courses with progress, where to continue,
 * what they can hand in now, and their latest feedback. Built from the same
 * services as GET /me/courses and GET /me/assignments.
 */
export async function getStudentDashboard(student) {
  const [courses, assignments] = await Promise.all([
    listMyCourses(student),
    myAssignmentRows(student),
  ]);
  const active = courses.filter((item) => item.progress);

  return {
    summary: {
      activeCourses: active.length,
      completedCourses: active.filter((item) => item.progress.completed).length,
      pendingRequests: courses.length - active.length,
      lessonsCompleted: active.reduce((sum, item) => sum + item.progress.completedLessons, 0),
      assignments: countStates(assignments),
    },
    // Courses are ordered by recent activity, so this is the one studied last.
    continueLearning: active.find((item) => item.progress.nextLesson) ?? null,
    courses,
    // Work the student can hand in now (first attempts and requested resubmissions), due first.
    upcoming: assignments.filter((row) => row.mySubmission.canSubmit).slice(0, LIST_SIZE),
    recentFeedback: assignments
      .filter(
        (row) =>
          FEEDBACK_STATES.has(row.mySubmission.status) && row.mySubmission.latest?.reviewedAt,
      )
      .sort((a, b) => b.mySubmission.latest.reviewedAt - a.mySubmission.latest.reviewedAt)
      .slice(0, LIST_SIZE),
  };
}
