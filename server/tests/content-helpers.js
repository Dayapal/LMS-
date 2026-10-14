import { Course, CourseModule, Enrollment, Lesson, ROLES } from '../src/models/index.js';
import { signAccessToken } from '../src/services/token.service.js';
import { createUser } from './helpers.js';

export const bearer = (user) => ({ Authorization: `Bearer ${signAccessToken(user)}` });

export async function actors() {
  const [admin, student, otherStudent] = await Promise.all([
    createUser({ role: ROLES.ADMIN }),
    createUser({ role: ROLES.STUDENT }),
    createUser({ role: ROLES.STUDENT }),
  ]);
  return { admin, student, otherStudent };
}

let n = 0;

/**
 * Inserts a course with modules and lessons directly in the database.
 * `shape` is a list of modules: { status, lessons: [status, ...] }.
 */
export async function makeCourse({ status = 'published', shape = [] } = {}) {
  n += 1;
  const course = await Course.create({ title: `Course ${n}`, slug: `course-${n}`, status });
  const modules = [];
  for (const [mi, spec] of shape.entries()) {
    const module = await CourseModule.create({
      course: course._id,
      title: `Module ${mi + 1}`,
      order: mi,
      status: spec.status ?? 'published',
    });
    const lessons = [];
    for (const [li, lessonStatus] of (spec.lessons ?? []).entries()) {
      lessons.push(
        await Lesson.create({
          course: course._id,
          module: module._id,
          title: `Lesson ${mi + 1}.${li + 1}`,
          slug: `lesson-${mi + 1}-${li + 1}`,
          order: li,
          status: lessonStatus,
          estimatedMinutes: 30,
        }),
      );
    }
    modules.push({ module, lessons });
  }
  return { course, modules };
}

export const enroll = (user, course, status = 'active') =>
  Enrollment.create({ user: user._id, course: course._id, status, enrolledAt: new Date() });
