import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { describe, it, expect } from 'vitest';
import { config } from '../src/config/env.js';
import {
  Assignment,
  Course,
  CourseModule,
  Enrollment,
  FileAsset,
  Lesson,
  LessonProgress,
  Material,
  Submission,
  User,
} from '../src/models/index.js';
import {
  COURSE_SEEDS,
  lessonSlugsFor,
  removeDemoStudents,
  resetCourseData,
  seedAssignments,
  seedCourses,
  seedDemoStudents,
  seedMaterials,
} from '../src/seeds/course.seed.js';
import {
  checkEntry,
  loadCourseContent,
  parseMaterialContent,
} from '../src/seeds/materials.seed.js';
import { CHEAT_SHEETS } from '../src/seeds/data/cheatsheets.js';
import { seedDemoProgress } from '../src/seeds/progress.seed.js';
import { DEMO_PROGRESS, DEMO_SUBMISSIONS } from '../src/seeds/data/demoProgress.js';
import { submissionLink } from '../src/validators/links.js';
import { ASSIGNMENT_SEEDS } from '../src/seeds/data/assignments.js';
import { createAssignmentSchema } from '../src/validators/assignment.validators.js';
import { createUser } from './helpers.js';
import { storedFiles } from './file-helpers.js';

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

describe('starter materials content', () => {
  it('has a note and a code example for every starter lesson, and nothing else', async () => {
    for (const course of COURSE_SEEDS) {
      const content = await loadCourseContent(course);
      const titles = [...lessonSlugsFor(course).keys()];
      expect([...content.keys()].sort(), course.slug).toEqual([...titles].sort());

      for (const [title, entry] of content) {
        expect(checkEntry(title, entry)).toEqual([]);
        const words = entry.note.split(/\s+/).length;
        expect(words, title).toBeGreaterThanOrEqual(120);
        expect(words, title).toBeLessThanOrEqual(450);
      }
    }
  });

  it('attaches each cheat sheet to an existing starter lesson', () => {
    for (const course of COURSE_SEEDS) {
      const sheet = CHEAT_SHEETS[course.slug];
      expect(sheet, course.slug).toBeDefined();
      expect(lessonSlugsFor(course).has(sheet.lesson)).toBe(true);
    }
  });

  it('parses notes, fenced code and links', () => {
    const parsed = parseMaterialContent(
      [
        '<!-- lesson: One -->',
        '## Heading',
        '',
        'Text with `code`.',
        '',
        '<!-- code: javascript | Example | A caption -->',
        '```js',
        '  const x = `${1}`;',
        '```',
        '',
        '<!-- link: Docs | https://example.com/docs -->',
        '<!-- lesson: Two -->',
        'Second note.',
        '<!-- code: java | Hello -->',
        '```java',
        'class A {}',
        '```',
      ].join('\r\n'),
    );
    expect(parsed.get('One')).toEqual({
      note: '## Heading\n\nText with `code`.',
      code: [
        {
          language: 'javascript',
          title: 'Example',
          caption: 'A caption',
          source: '  const x = `${1}`;',
        },
      ],
      links: [{ title: 'Docs', url: 'https://example.com/docs', description: '' }],
    });
    expect(parsed.get('Two').code[0]).toMatchObject({
      language: 'java',
      caption: '',
      source: 'class A {}',
    });
  });

  it('refuses a code block without a fence', () => {
    expect(() =>
      parseMaterialContent('<!-- lesson: One -->\nNote\n<!-- code: java | Hello -->\nclass A {}'),
    ).toThrow(/without a fence/);
  });
});

describe('seedMaterials', () => {
  async function seedAll() {
    const admin = await createUser({ role: 'admin' });
    await seedCourses({ createdBy: admin._id });
    const results = await seedMaterials({ createdBy: admin._id });
    return { admin, results };
  }

  it('adds published notes, code and links to every starter lesson', async () => {
    const { results } = await seedAll();
    expect(results.map((r) => r.added)).toEqual(
      COURSE_SEEDS.map((c) => c.modules.reduce((sum, m) => sum + m.lessons.length, 0)),
    );

    expect(await Material.distinct('lesson')).toHaveLength(expectedLessons);
    expect(await Material.countDocuments({ status: 'published' })).toBe(
      await Material.countDocuments(),
    );
    expect(await Material.countDocuments({ type: 'note' })).toBe(expectedLessons);
    expect(await Material.countDocuments({ type: 'code' })).toBeGreaterThanOrEqual(expectedLessons);
    expect(await Material.countDocuments({ type: 'link' })).toBeGreaterThan(50);

    // A lesson's note comes first, then its code example.
    const lesson = await Lesson.findOne({ slug: 'flexbox-layouts' });
    const blocks = await Material.find({ lesson: lesson._id }).sort({ order: 1 });
    expect(blocks.slice(0, 2).map((b) => b.type)).toEqual(['note', 'code']);
    expect(blocks[1].language).toBe('css');
  });

  it('stores one valid cheat sheet PDF per course through the storage provider', async () => {
    await seedAll();
    const files = await FileAsset.find().sort({ originalName: 1 });
    expect(files.map((f) => f.originalName)).toEqual([
      'dsa-complexity-cheat-sheet.pdf',
      'java-spring-quick-reference.pdf',
      'mern-quick-reference.pdf',
    ]);
    expect((await storedFiles()).sort()).toEqual(files.map((f) => f.storageKey).sort());
    for (const file of files) {
      const bytes = await fs.readFile(path.join(config.storage.localDir, file.storageKey));
      expect(await fileTypeFromBuffer(bytes)).toEqual({ ext: 'pdf', mime: 'application/pdf' });
      expect(bytes.length).toBe(file.size);
      const material = await Material.findOne({ file: file._id });
      expect(material).toMatchObject({ type: 'file', status: 'published', downloadable: true });
      expect(material.course.equals(file.course)).toBe(true);
    }
  });

  it('never duplicates or changes materials on a rerun', async () => {
    const { admin } = await seedAll();
    const total = await Material.countDocuments();
    const lesson = await Lesson.findOne({ slug: 'flexbox-layouts' });
    await Material.updateOne({ lesson: lesson._id, type: 'note' }, { body: 'Trainer rewrite' });
    await Material.deleteOne({ lesson: lesson._id, type: 'code' });

    const rerun = await seedMaterials({ createdBy: admin._id });
    expect(rerun.every((r) => r.added === 0)).toBe(true);
    expect(await Material.countDocuments()).toBe(total - 1);
    expect(await FileAsset.countDocuments()).toBe(3);
    const note = await Material.findOne({ lesson: lesson._id, type: 'note' });
    expect(note.body).toBe('Trainer rewrite');
  });

  it('fills starter lessons that have no materials yet, even after a rename', async () => {
    const admin = await createUser({ role: 'admin' });
    await seedCourses({ createdBy: admin._id }); // like a Phase 2 database: no materials
    await Lesson.updateOne({ slug: 'flexbox-layouts' }, { title: 'Flexbox in depth' });

    await seedMaterials({ createdBy: admin._id });
    const lesson = await Lesson.findOne({ slug: 'flexbox-layouts' });
    expect(await Material.countDocuments({ lesson: lesson._id })).toBeGreaterThanOrEqual(2);
  });

  it('skips starter courses that do not exist', async () => {
    const admin = await createUser({ role: 'admin' });
    expect(await seedMaterials({ createdBy: admin._id })).toEqual([]);
    expect(await Material.countDocuments()).toBe(0);
  });

  it('reset removes materials and their stored files', async () => {
    await seedAll();
    await resetCourseData();
    expect(await Material.countDocuments()).toBe(0);
    expect(await FileAsset.countDocuments()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });
});

describe('seedAssignments', () => {
  const now = new Date('2026-10-16T09:00:00.000Z');

  it('ships one or two valid assignments per course in the first modules', () => {
    for (const course of COURSE_SEEDS) {
      const seeds = ASSIGNMENT_SEEDS[course.slug];
      expect(seeds.length, course.slug).toBeGreaterThanOrEqual(1);
      expect(seeds.length, course.slug).toBeLessThanOrEqual(2);
      const firstLessons = course.modules.slice(0, 3).flatMap((m) => m.lessons.map((l) => l.title));
      for (const seed of seeds) {
        expect(firstLessons, seed.title).toContain(seed.lesson);
        const parsed = createAssignmentSchema.safeParse({
          courseId: '0123456789abcdef01234567',
          title: seed.title,
          instructions: seed.instructions,
          objectives: seed.objectives,
          dueAt: now.toISOString(),
          maxMarks: seed.maxMarks,
          maxAttempts: seed.maxAttempts,
          allowedSubmissionTypes: seed.allowedSubmissionTypes,
        });
        expect(parsed.success, `${seed.title}: ${parsed.error?.message}`).toBe(true);
      }
    }
    const all = Object.values(ASSIGNMENT_SEEDS).flat();
    expect(new Set(all.flatMap((a) => a.allowedSubmissionTypes))).toEqual(
      new Set(['drive_url', 'github_url', 'project_url', 'pdf', 'code']),
    );
    expect(new Set(all.map((a) => a.latePolicy.allowLate))).toEqual(new Set([true, false]));
  });

  it('creates published assignments placed in their lessons and modules', async () => {
    const admin = await createUser({ role: 'admin' });
    await seedCourses();
    const results = await seedAssignments({ createdBy: admin._id, now });
    expect(results.map((r) => r.added)).toEqual([2, 1, 2]);

    const portfolio = await Assignment.findOne({ title: 'Personal Profile Page' });
    const forms = await Lesson.findOne({ slug: 'forms-and-accessibility' });
    expect(portfolio).toMatchObject({ status: 'published', maxMarks: 100, maxAttempts: 2 });
    expect(portfolio.module.equals(forms.module)).toBe(true);
    expect(portfolio.lesson).toBeNull();
    expect(portfolio.dueAt.toISOString()).toBe('2026-10-30T18:30:00.000Z');
    expect(portfolio.latePolicy).toMatchObject({ allowLate: true, penaltyPercent: 10 });
    expect(portfolio.latePolicy.lateUntil.toISOString()).toBe('2026-11-06T18:30:00.000Z');
    expect(portfolio.createdBy.equals(admin._id)).toBe(true);

    const grades = await Assignment.findOne({ title: 'Console Grade Calculator' });
    const lesson = await Lesson.findOne({ slug: 'control-flow-and-methods' });
    expect(grades.lesson.equals(lesson._id)).toBe(true);
    expect(grades.module.equals(lesson.module)).toBe(true);
  });

  it('never adds assignments to a course that already has some', async () => {
    const admin = await createUser({ role: 'admin' });
    await seedCourses();
    await seedAssignments({ createdBy: admin._id, now });
    const edited = await Assignment.findOne({ title: 'Two-Pointer Practice Set' });
    edited.title = 'Two pointers (edited)';
    await edited.save();
    await Assignment.deleteOne({ title: 'Big-O Analysis Worksheet' });

    const rerun = await seedAssignments({ createdBy: admin._id, now });
    expect(rerun.map((r) => r.added)).toEqual([0, 0, 0]);
    expect(await Assignment.countDocuments()).toBe(4);
    expect(await Assignment.exists({ title: 'Two pointers (edited)' })).toBeTruthy();
  });

  it('reset removes assignments and submissions', async () => {
    const admin = await createUser({ role: 'admin' });
    const student = await createUser();
    await seedCourses();
    await seedAssignments({ createdBy: admin._id, now });
    const assignment = await Assignment.findOne();
    await Submission.create({
      assignment: assignment._id,
      course: assignment.course,
      student: student._id,
      attempt: 1,
      items: [{ type: 'github_url', url: 'https://github.com/a/b' }],
      submittedAt: now,
    });
    await resetCourseData();
    expect(await Assignment.countDocuments()).toBe(0);
    expect(await Submission.countDocuments()).toBe(0);
  });
});

describe('seedDemoProgress', () => {
  const now = new Date('2026-10-16T06:00:00Z');

  async function seedAll() {
    const admin = await createUser({ role: 'admin' });
    await seedCourses();
    await seedAssignments({ createdBy: admin._id, now });
    await seedDemoStudents({ password: 'Passw0rd!', enrolledBy: admin._id });
    return admin;
  }

  it('ships valid demo links', () => {
    for (const demo of DEMO_SUBMISSIONS) {
      for (const item of demo.items) {
        expect(submissionLink(item.type).safeParse(item.url).success).toBe(true);
      }
    }
  });

  it('completes the first lessons in roadmap order and sets where to continue', async () => {
    const admin = await seedAll();
    const result = await seedDemoProgress({ reviewer: admin._id, now });
    expect(result.progress.map((r) => r.added)).toEqual(
      DEMO_PROGRESS.map((d) => d.lessonsCompleted),
    );

    const aarav = await User.findOne({ email: 'aarav.demo@example.com' });
    const course = await Course.findOne({ slug: 'full-stack-mern-development' });
    const records = await LessonProgress.find({ user: aarav._id }).sort({ completedAt: 1 });
    expect(records).toHaveLength(8);
    expect(records.every((r) => r.course.equals(course._id) && r.completedAt < now)).toBe(true);

    const modules = await CourseModule.find({ course: course._id }).sort({ order: 1 });
    const lessons = [];
    for (const m of modules)
      lessons.push(...(await Lesson.find({ module: m._id }).sort({ order: 1 })));
    expect(records.map((r) => r.lesson.toString())).toEqual(lessons.slice(0, 8).map((l) => l.id));
    const enrollment = await Enrollment.findOne({ user: aarav._id, course: course._id });
    expect(enrollment.lastLesson.equals(lessons[8]._id)).toBe(true);
  });

  it('adds one reviewed and one resubmission-requested submission', async () => {
    const admin = await seedAll();
    await seedDemoProgress({ reviewer: admin._id, now });
    const submissions = await Submission.find().populate('student', 'email');
    const byEmail = Object.fromEntries(submissions.map((s) => [s.student.email, s]));
    expect(byEmail['aarav.demo@example.com']).toMatchObject({
      attempt: 1,
      status: 'reviewed',
      isLate: false,
      review: { marks: 86, finalMarks: 86 },
    });
    expect(byEmail['neha.demo@example.com']).toMatchObject({
      status: 'resubmit_requested',
      review: { marks: null },
    });
    expect(byEmail['neha.demo@example.com'].review.reviewedBy.equals(admin._id)).toBe(true);
  });

  it('never changes existing progress or submissions on a rerun', async () => {
    const admin = await seedAll();
    await seedDemoProgress({ reviewer: admin._id, now });
    const aarav = await User.findOne({ email: 'aarav.demo@example.com' });
    await LessonProgress.deleteOne({ user: aarav._id });

    const rerun = await seedDemoProgress({ reviewer: admin._id, now });
    expect(rerun.progress.every((r) => r.added === 0)).toBe(true);
    expect(rerun.submissions.every((r) => !r.added)).toBe(true);
    expect(await LessonProgress.countDocuments({ user: aarav._id })).toBe(7);
    expect(await Submission.countDocuments()).toBe(2);
  });

  it('skips students without an active enrollment', async () => {
    const admin = await seedAll();
    await Enrollment.updateMany({}, { status: 'removed' });
    const result = await seedDemoProgress({ reviewer: admin._id, now });
    expect(result).toEqual({ progress: [], submissions: [] });
    expect(await LessonProgress.countDocuments()).toBe(0);
  });

  it('reset removes progress', async () => {
    const admin = await seedAll();
    await seedDemoProgress({ reviewer: admin._id, now });
    await resetCourseData();
    expect(await LessonProgress.countDocuments()).toBe(0);
  });
});
