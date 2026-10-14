import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { describe, it, expect } from 'vitest';
import { config } from '../src/config/env.js';
import {
  Course,
  CourseModule,
  Enrollment,
  FileAsset,
  Lesson,
  Material,
  User,
} from '../src/models/index.js';
import {
  COURSE_SEEDS,
  lessonSlugsFor,
  removeDemoStudents,
  resetCourseData,
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
