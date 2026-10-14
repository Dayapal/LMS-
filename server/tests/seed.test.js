import { describe, it, expect } from 'vitest';
import { Course, CourseModule, Enrollment, Lesson, User } from '../src/models/index.js';
import {
  COURSE_SEEDS,
  removeDemoStudents,
  resetCourseData,
  seedCourses,
  seedDemoStudents,
} from '../src/seeds/course.seed.js';
import { createUser } from './helpers.js';

const expectedModules = COURSE_SEEDS.reduce((sum, c) => sum + c.modules.length, 0);
const expectedLessons = COURSE_SEEDS.reduce(
  (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0),
  0,
);

describe('seedCourses', () => {
  it('ships the three starter roadmaps with real lesson content', () => {
    expect(COURSE_SEEDS.map((c) => c.title)).toEqual([
      'Full-Stack MERN Development',
      'Java Full-Stack Development',
      'DSA with JavaScript',
    ]);
    expect(COURSE_SEEDS.map((c) => c.modules.length)).toEqual([11, 13, 14]);
    for (const course of COURSE_SEEDS) {
      for (const module of course.modules) {
        expect(module.lessons.length, module.title).toBeGreaterThanOrEqual(2);
        for (const lesson of module.lessons) {
          expect(lesson.summary.length, lesson.title).toBeGreaterThan(10);
          expect(lesson.objectives.length, lesson.title).toBeGreaterThanOrEqual(2);
          expect(lesson.estimatedMinutes, lesson.title).toBeGreaterThan(0);
        }
      }
    }
  });

  it('creates published courses, modules and lessons in order', async () => {
    const results = await seedCourses();
    expect(results.every((r) => r.created)).toBe(true);
    expect(await Course.countDocuments({ status: 'published' })).toBe(3);
    expect(await CourseModule.countDocuments({ status: 'published' })).toBe(expectedModules);
    expect(await Lesson.countDocuments({ status: 'published' })).toBe(expectedLessons);

    const mern = await Course.findOne({ slug: 'full-stack-mern-development' });
    const modules = await CourseModule.find({ course: mern._id }).sort({ order: 1 });
    expect(modules[0].title).toBe('HTML Fundamentals');
    expect(modules.at(-1).title).toBe('Deployment and Capstone Project');
  });

  it('is idempotent and never overwrites trainer edits', async () => {
    await seedCourses();
    const mern = await Course.findOne({ slug: 'full-stack-mern-development' });
    mern.title = 'MERN Bootcamp (2026 cohort)';
    mern.status = 'archived';
    await mern.save();
    const firstModule = await CourseModule.findOne({ course: mern._id, order: 0 });
    await Lesson.deleteOne({ module: firstModule._id, order: 0 });

    const rerun = await seedCourses();
    expect(rerun.every((r) => !r.created)).toBe(true);
    expect(await Course.countDocuments()).toBe(3);
    expect(await CourseModule.countDocuments()).toBe(expectedModules);
    expect(await Lesson.countDocuments()).toBe(expectedLessons - 1);

    const after = await Course.findById(mern._id);
    expect(after.title).toBe('MERN Bootcamp (2026 cohort)');
    expect(after.status).toBe('archived');
  });

  it('reset removes course data but keeps users', async () => {
    const user = await createUser();
    await seedCourses();
    await resetCourseData();
    expect(await Course.countDocuments()).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);
    expect(await User.exists({ _id: user._id })).toBeTruthy();
  });
});

describe('seedDemoStudents', () => {
  it('creates students with sample enrollments once', async () => {
    const admin = await createUser({ role: 'admin' });
    await seedCourses();
    const first = await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });
    expect(first.every((r) => r.created)).toBe(true);
    const counts = {
      active: await Enrollment.countDocuments({ status: 'active' }),
      pending: await Enrollment.countDocuments({ status: 'pending' }),
    };
    expect(counts).toEqual({ active: 2, pending: 2 });

    // The trainer approves a request; rerunning the seed must not revert it.
    await Enrollment.updateMany({ status: 'pending' }, { status: 'active' });
    const second = await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });
    expect(second.every((r) => !r.created)).toBe(true);
    expect(await Enrollment.countDocuments({ status: 'active' })).toBe(4);
    expect(await User.countDocuments({ role: 'student' })).toBe(3);
  });

  it('reset recreates demo students with their enrollments', async () => {
    const admin = await createUser({ role: 'admin' });
    const realStudent = await createUser();
    await seedCourses();
    await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });

    await Promise.all([resetCourseData(), removeDemoStudents()]);
    await seedCourses();
    const again = await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });

    expect(again.every((r) => r.created)).toBe(true);
    expect(await Enrollment.countDocuments()).toBe(4);
    expect(await User.exists({ _id: realStudent._id })).toBeTruthy();
  });
});
