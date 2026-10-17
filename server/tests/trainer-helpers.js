import { LessonProgress } from '../src/models/index.js';
import { createUser } from './helpers.js';
import { enroll, makeCourse } from './content-helpers.js';
import { DAY, HOUR, fromNow, makeAssignment, makeSubmission } from './assignment-helpers.js';

export const complete = (user, lesson, at = new Date()) =>
  LessonProgress.create({
    user: user._id,
    course: lesson.course,
    lesson: lesson._id,
    completedAt: at,
  });

/**
 * A school with known numbers, for the dashboard and report tests.
 *
 * Courses: A (published, 2 lessons), B (published, 1 lesson), D (draft,
 * 1 lesson) and Z (archived).
 * Students (plus the two from actors(), who have no enrollments):
 * - s1: active in A, both lessons done; Past A waiting for review; Soon A reviewed (45/50)
 * - s2: active in A, 1 of 2 done; nothing handed in, so overdue on Past A
 * - s3: active in B, nothing done; overdue on Past B
 * - s4: pending request for A
 * - s5: removed from B; their Past B attempt still waits for review
 *
 * Assignments in A: Past A (due yesterday), Soon A (in 2 days, 50 marks),
 * Later A (in 10 days), and a draft due yesterday. In B: Past B (3 days ago).
 */
export async function school(admin) {
  const [s1, s2, s3, s4, s5] = await Promise.all(
    ['Asha Rao', 'Bela Iyer', 'Chirag Jain', 'Dev Malhotra', 'Esha Nair'].map((name) =>
      createUser({ name }),
    ),
  );
  const a = await makeCourse({ shape: [{ lessons: ['published', 'published'] }] });
  const b = await makeCourse({ shape: [{ lessons: ['published'] }] });
  const d = await makeCourse({ status: 'draft', shape: [{ lessons: ['published'] }] });
  const z = await makeCourse({ status: 'archived', shape: [{ lessons: ['published'] }] });
  await Promise.all([
    enroll(s1, a.course),
    enroll(s2, a.course),
    enroll(s3, b.course),
    enroll(s4, a.course, 'pending'),
    enroll(s5, b.course, 'removed'),
  ]);
  const [a1, a2] = a.modules[0].lessons;
  await Promise.all([complete(s1, a1), complete(s1, a2), complete(s2, a1)]);

  const pastA = await makeAssignment(a.course, { title: 'Past A', dueAt: fromNow(-DAY) });
  const soonA = await makeAssignment(a.course, {
    title: 'Soon A',
    dueAt: fromNow(2 * DAY),
    maxMarks: 50,
  });
  const laterA = await makeAssignment(a.course, { title: 'Later A', dueAt: fromNow(10 * DAY) });
  const draftA = await makeAssignment(a.course, {
    title: 'Draft A',
    dueAt: fromNow(-DAY),
    status: 'draft',
  });
  const pastB = await makeAssignment(b.course, { title: 'Past B', dueAt: fromNow(-3 * DAY) });

  await makeSubmission(pastA, s1, { submittedAt: fromNow(-2 * DAY) });
  await makeSubmission(soonA, s1, {
    submittedAt: fromNow(-DAY),
    status: 'reviewed',
    review: {
      marks: 45,
      finalMarks: 45,
      feedback: 'Great',
      reviewedBy: admin._id,
      reviewedAt: fromNow(-HOUR),
    },
  });
  await makeSubmission(pastB, s5, { submittedAt: fromNow(-4 * DAY) });

  return { s1, s2, s3, s4, s5, a, b, d, z, pastA, soonA, laterA, draftA, pastB };
}
