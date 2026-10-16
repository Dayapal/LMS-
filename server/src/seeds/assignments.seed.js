import mongoose from 'mongoose';
import {
  Assignment,
  CONTENT_STATUS,
  Course,
  FILE_PURPOSES,
  Lesson,
  Submission,
} from '../models/index.js';
import { deleteFilesWhere } from '../services/file.service.js';
import { ASSIGNMENT_SEEDS } from './data/assignments.js';

const { trusted } = mongoose;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `days` from `now`, at 18:30 UTC (midnight India time). */
export function dueDate(now, days) {
  const date = new Date(now.getTime() + days * DAY_MS);
  date.setUTCHours(18, 30, 0, 0);
  return date;
}

function toAssignment(seed, { course, lesson, createdBy, now }) {
  const { lateDays, ...policy } = seed.latePolicy;
  const dueAt = dueDate(now, seed.dueInDays);
  return {
    course: course._id,
    module: lesson?.module ?? null,
    lesson: lesson && seed.attachTo === 'lesson' ? lesson._id : null,
    title: seed.title,
    instructions: seed.instructions,
    objectives: seed.objectives,
    dueAt,
    maxMarks: seed.maxMarks,
    maxAttempts: seed.maxAttempts,
    allowedSubmissionTypes: seed.allowedSubmissionTypes,
    latePolicy: policy.allowLate
      ? {
          allowLate: true,
          lateUntil: dueDate(now, seed.dueInDays + lateDays),
          penaltyPercent: policy.penaltyPercent,
        }
      : { allowLate: false, lateUntil: null, penaltyPercent: 0 },
    status: CONTENT_STATUS.PUBLISHED,
    createdBy,
  };
}

/**
 * Adds the starter assignments to each starter course that has no assignments
 * yet, so reruns never duplicate or change the trainer's assignments.
 * Lessons are found by their starter slug; a missing lesson leaves the
 * assignment at course level.
 */
export async function seedCourseAssignments({
  courses,
  lessonSlugsFor,
  createdBy,
  now = new Date(),
}) {
  const results = [];
  for (const data of courses) {
    const seeds = ASSIGNMENT_SEEDS[data.slug] ?? [];
    const course = await Course.findOne({ slug: data.slug }).select('_id');
    if (!course || seeds.length === 0) continue;
    if (await Assignment.exists({ course: course._id })) {
      results.push({ slug: data.slug, added: 0 });
      continue;
    }
    const slugs = lessonSlugsFor(data);
    const lessons = await Lesson.find({
      course: course._id,
      slug: trusted({ $in: seeds.map((seed) => slugs.get(seed.lesson)).filter(Boolean) }),
    });
    const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
    await Assignment.insertMany(
      seeds.map((seed) =>
        toAssignment(seed, {
          course,
          lesson: bySlug.get(slugs.get(seed.lesson)),
          createdBy,
          now,
        }),
      ),
    );
    results.push({ slug: data.slug, added: seeds.length });
  }
  return results;
}

/** Removes every assignment, submission and their files. Development only (seed --reset). */
export async function resetAssignments() {
  await Promise.all([Submission.deleteMany({}), Assignment.deleteMany({})]);
  await deleteFilesWhere({
    purpose: trusted({ $in: [FILE_PURPOSES.ASSIGNMENT, FILE_PURPOSES.SUBMISSION] }),
  });
}
