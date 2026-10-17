import {
  Activity,
  ACTIVITY_TYPES,
  Assignment,
  CONTENT_STATUS,
  Course,
  Enrollment,
  ENROLLMENT_STATUS,
  LessonProgress,
  ROLES,
  Submission,
  SUBMISSION_STATUS,
  User,
} from '../models/index.js';
import { countableLessons } from '../services/progress.service.js';
import { finalMarksFor } from '../services/submissionRules.js';
import { DEMO_PROGRESS, DEMO_SUBMISSIONS } from './data/demoProgress.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The demo student, their published course and active enrollment, or null. */
async function findDemoEnrollment({ email, course: slug }) {
  const [student, course] = await Promise.all([
    User.findOne({ email, role: ROLES.STUDENT }),
    Course.findOne({ slug, status: CONTENT_STATUS.PUBLISHED }).select('_id'),
  ]);
  if (!student || !course) return null;
  const enrollment = await Enrollment.findOne({
    user: student._id,
    course: course._id,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
  return enrollment ? { student, course, enrollment } : null;
}

/**
 * Completed lessons for each demo student who has none yet in the course, so
 * reruns never change progress the student made themselves. Completion dates
 * are spread over the days before `now`.
 */
async function seedDemoLessonProgress(now) {
  const results = [];
  for (const demo of DEMO_PROGRESS) {
    const found = await findDemoEnrollment(demo);
    if (!found) continue;
    const { student, course, enrollment } = found;
    if (await LessonProgress.exists({ user: student._id, course: course._id })) {
      results.push({ email: demo.email, slug: demo.course, added: 0 });
      continue;
    }
    const lessons = (await countableLessons(student, [course._id])).get(course._id.toString());
    const done = lessons.slice(0, demo.lessonsCompleted);
    const records = await LessonProgress.insertMany(
      done.map((lesson, index) => ({
        user: student._id,
        course: course._id,
        lesson: lesson.id,
        completedAt: new Date(now.getTime() - (done.length - index) * DAY_MS),
      })),
    );
    // The matching activity, so the trainer's recent activity isn't empty.
    await Activity.insertMany(
      records.map((record) => ({
        user: student._id,
        type: ACTIVITY_TYPES.LESSON_COMPLETED,
        course: course._id,
        lesson: record.lesson,
        createdAt: record.completedAt,
      })),
    );
    const reading = lessons[done.length] ?? done.at(-1);
    if (reading) {
      enrollment.set({ lastLesson: reading.id, lastAccessedAt: new Date(now.getTime() - HOUR_MS) });
      await enrollment.save();
    }
    results.push({ email: demo.email, slug: demo.course, added: done.length });
  }
  return results;
}

/**
 * One first attempt per demo submission, while the student has none for that
 * assignment, already reviewed or sent back for resubmission by `reviewer`.
 */
async function seedDemoSubmissions(reviewer, now) {
  const results = [];
  for (const demo of DEMO_SUBMISSIONS) {
    const found = await findDemoEnrollment(demo);
    if (!found) continue;
    const { student, course } = found;
    const assignment = await Assignment.findOne({
      course: course._id,
      title: demo.assignment,
      status: CONTENT_STATUS.PUBLISHED,
    });
    if (!assignment) continue;
    if (await Submission.exists({ assignment: assignment._id, student: student._id })) {
      results.push({ email: demo.email, assignment: demo.assignment, added: false });
      continue;
    }
    const submittedAt = new Date(now.getTime() - 2 * DAY_MS);
    const isLate = submittedAt > assignment.dueAt;
    const marks = demo.status === SUBMISSION_STATUS.REVIEWED ? demo.marks : null;
    const reviewedAt = new Date(now.getTime() - DAY_MS);
    const submission = await Submission.create({
      assignment: assignment._id,
      course: course._id,
      student: student._id,
      attempt: 1,
      items: demo.items,
      note: demo.note,
      submittedAt,
      isLate,
      status: demo.status,
      review: {
        marks,
        finalMarks: finalMarksFor(assignment, { marks, isLate }),
        feedback: demo.feedback,
        reviewedBy: reviewer,
        reviewedAt,
      },
    });
    const event = {
      user: student._id,
      course: course._id,
      assignment: assignment._id,
      submission: submission._id,
      attempt: 1,
    };
    await Activity.insertMany([
      { ...event, type: ACTIVITY_TYPES.SUBMISSION_CREATED, createdAt: submittedAt },
      {
        ...event,
        actor: reviewer,
        type:
          demo.status === SUBMISSION_STATUS.REVIEWED
            ? ACTIVITY_TYPES.SUBMISSION_REVIEWED
            : ACTIVITY_TYPES.RESUBMISSION_REQUESTED,
        createdAt: reviewedAt,
      },
    ]);
    results.push({ email: demo.email, assignment: demo.assignment, added: true });
  }
  return results;
}

/** Demo progress and submissions for the demo students. Safe to rerun. */
export async function seedDemoProgress({ reviewer, now = new Date() }) {
  return {
    progress: await seedDemoLessonProgress(now),
    submissions: await seedDemoSubmissions(reviewer, now),
  };
}
