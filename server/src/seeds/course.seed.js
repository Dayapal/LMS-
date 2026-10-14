import mongoose from 'mongoose';
import {
  CONTENT_STATUS,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  Lesson,
  ROLES,
  Session,
  User,
} from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { slugify } from '../utils/text.js';
import mern from './data/mern.js';
import java from './data/java.js';
import dsa from './data/dsa.js';
import { resetMaterials, seedCourseMaterials } from './materials.seed.js';

export const COURSE_SEEDS = [mern, java, dsa];

const PUBLISHED = CONTENT_STATUS.PUBLISHED;
const { trusted } = mongoose;

/**
 * The slug each starter lesson gets, keyed by title. Slugs never change after
 * creation, so the material seed uses them to find starter lessons again even
 * after the trainer renames them.
 */
export function lessonSlugsFor(data) {
  const slugs = new Map();
  const used = new Set();
  data.modules.forEach((module, moduleIndex) => {
    for (const lesson of module.lessons) {
      let slug = slugify(lesson.title);
      while (used.has(slug)) slug = `${slug}-${moduleIndex + 1}`;
      used.add(slug);
      slugs.set(lesson.title, slug);
    }
  });
  return slugs;
}

async function createCourseTree(data, createdBy) {
  const { modules, ...courseFields } = data;
  const course = await Course.create({ ...courseFields, status: PUBLISHED, createdBy });
  const slugs = lessonSlugsFor(data);
  try {
    for (const [moduleIndex, { lessons, ...moduleFields }] of modules.entries()) {
      const module = await CourseModule.create({
        ...moduleFields,
        course: course._id,
        order: moduleIndex,
        status: PUBLISHED,
      });
      await Lesson.insertMany(
        lessons.map((lesson, lessonIndex) => ({
          ...lesson,
          slug: slugs.get(lesson.title),
          course: course._id,
          module: module._id,
          order: lessonIndex,
          status: PUBLISHED,
        })),
      );
    }
  } catch (error) {
    // Don't leave a half-built course behind: a rerun would skip it as "existing".
    await Promise.all([
      Lesson.deleteMany({ course: course._id }),
      CourseModule.deleteMany({ course: course._id }),
      course.deleteOne(),
    ]);
    throw error;
  }
  return course;
}

/**
 * Creates each starter course whose slug doesn't exist yet. Existing courses,
 * including ones the trainer has edited, renamed or archived, are never touched.
 */
export async function seedCourses({ createdBy } = {}) {
  const results = [];
  for (const data of COURSE_SEEDS) {
    if (await Course.exists({ slug: data.slug })) {
      results.push({ slug: data.slug, created: false });
      continue;
    }
    await createCourseTree(data, createdBy);
    results.push({ slug: data.slug, created: true });
  }
  return results;
}

/** Starter notes, code, links and cheat sheets for the starter lessons. See materials.seed.js. */
export const seedMaterials = ({ createdBy } = {}) =>
  seedCourseMaterials({ courses: COURSE_SEEDS, lessonSlugsFor, createdBy });

const DEMO_STUDENTS = [
  {
    name: 'Aarav Mehta',
    email: 'aarav.demo@example.com',
    enrollments: [{ slug: mern.slug, status: ENROLLMENT_STATUS.ACTIVE }],
  },
  {
    name: 'Neha Kapoor',
    email: 'neha.demo@example.com',
    enrollments: [
      { slug: mern.slug, status: ENROLLMENT_STATUS.ACTIVE },
      { slug: java.slug, status: ENROLLMENT_STATUS.PENDING },
    ],
  },
  {
    name: 'Kabir Singh',
    email: 'kabir.demo@example.com',
    enrollments: [{ slug: dsa.slug, status: ENROLLMENT_STATUS.PENDING }],
  },
];

/**
 * Demo students with a mix of active and pending enrollments. Only students
 * created by this run get enrollments, so reruns never undo trainer decisions.
 */
export async function seedDemoStudents({ password, enrolledBy }) {
  const passwordHash = await hashPassword(password);
  const results = [];
  for (const demo of DEMO_STUDENTS) {
    if (await User.exists({ email: demo.email })) {
      results.push({ email: demo.email, created: false });
      continue;
    }
    const student = await User.create({
      name: demo.name,
      email: demo.email,
      passwordHash,
      role: ROLES.STUDENT,
    });
    for (const { slug, status } of demo.enrollments) {
      const course = await Course.findOne({ slug }).select('_id');
      if (!course) continue;
      const active = status === ENROLLMENT_STATUS.ACTIVE;
      await Enrollment.create({
        user: student._id,
        course: course._id,
        status,
        enrolledBy: active ? enrolledBy : student._id,
        ...(active && { enrolledAt: new Date() }),
      });
    }
    results.push({ email: demo.email, created: true });
  }
  return results;
}

/** Deletes the demo student accounts (and their sessions) so a reset can recreate them. */
export async function removeDemoStudents() {
  const emails = DEMO_STUDENTS.map((d) => d.email);
  const users = await User.find({ email: trusted({ $in: emails }), role: ROLES.STUDENT }).select(
    '_id',
  );
  const ids = users.map((u) => u._id);
  await Promise.all([
    Session.deleteMany({ user: trusted({ $in: ids }) }),
    User.deleteMany({ _id: trusted({ $in: ids }) }),
  ]);
}

/** Removes all course content, materials, files and enrollments. Users are kept. Development only. */
export async function resetCourseData() {
  await resetMaterials();
  await Promise.all([
    Enrollment.deleteMany({}),
    Lesson.deleteMany({}),
    CourseModule.deleteMany({}),
    Course.deleteMany({}),
  ]);
}
