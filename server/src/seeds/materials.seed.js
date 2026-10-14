import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  CODE_LANGUAGES,
  CONTENT_STATUS,
  Course,
  FILE_PURPOSES,
  Lesson,
  Material,
  MATERIAL_TYPES,
} from '../models/index.js';
import { deleteFilesIfUnused, deleteFilesWhere, storeFile } from '../services/file.service.js';
import { inspectUpload } from '../services/fileRules.js';
import { buildPdf } from './pdf.js';
import { CHEAT_SHEETS } from './data/cheatsheets.js';

const { trusted } = mongoose;
const PUBLISHED = CONTENT_STATUS.PUBLISHED;

/*
 * Starter materials live in seeds/content/<course slug>.md as plain Markdown:
 *
 *   <!-- lesson: Lesson title -->
 *   The lesson note, in Markdown.
 *
 *   <!-- code: javascript | Example title | Optional caption -->
 *   ```js
 *   ...source...
 *   ```
 *
 *   <!-- link: Link title | https://example.com/page | Optional description -->
 */

const LESSON_MARKER = /^<!-- lesson: (.+?) -->[ \t]*$/gm;
const BLOCK_MARKER = /^<!-- (code|link): (.+?) -->[ \t]*$/gm;
const FENCE = /^```[^\n]*\n([\s\S]*?)\n```[ \t]*$/m;

const params = (text) => text.split('|').map((part) => part.trim());

/** Parses one course content file into `Map<lessonTitle, { note, code[], links[] }>`. */
export function parseMaterialContent(text, source = 'content') {
  const normalized = text.replace(/\r\n/g, '\n');
  const lessons = new Map();
  const markers = [...normalized.matchAll(LESSON_MARKER)];
  markers.forEach((marker, index) => {
    const title = marker[1].trim();
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? normalized.length;
    const chunk = normalized.slice(start, end);
    const blocks = [...chunk.matchAll(BLOCK_MARKER)];
    const entry = {
      note: chunk.slice(0, blocks[0]?.index ?? chunk.length).trim(),
      code: [],
      links: [],
    };

    blocks.forEach((block, blockIndex) => {
      const body = chunk.slice(
        block.index + block[0].length,
        blocks[blockIndex + 1]?.index ?? chunk.length,
      );
      const [first, second, third] = params(block[2]);
      if (block[1] === 'code') {
        const fence = body.match(FENCE);
        if (!fence) throw new Error(`${source}: code block without a fence in "${title}"`);
        entry.code.push({ language: first, title: second, caption: third ?? '', source: fence[1] });
      } else {
        entry.links.push({ title: first, url: second, description: third ?? '' });
      }
    });

    if (lessons.has(title)) throw new Error(`${source}: lesson "${title}" appears twice`);
    lessons.set(title, entry);
  });
  return lessons;
}

const contentCache = new Map();

/** The parsed starter materials of a seeded course. */
export async function loadCourseContent(course) {
  if (!contentCache.has(course.slug)) {
    const file = fileURLToPath(new URL(`./content/${course.slug}.md`, import.meta.url));
    contentCache.set(course.slug, parseMaterialContent(await fs.readFile(file, 'utf8'), file));
  }
  return contentCache.get(course.slug);
}

/** Validates a parsed entry the same way the API would. Used by the seed test. */
export function checkEntry(title, entry) {
  const problems = [];
  if (!entry.note) problems.push('missing note');
  if (entry.code.length === 0) problems.push('missing code example');
  for (const code of entry.code) {
    if (!CODE_LANGUAGES.includes(code.language)) problems.push(`unknown language ${code.language}`);
    if (!code.title || !code.source.trim()) problems.push('code without title or source');
  }
  for (const link of entry.links) {
    if (!link.url.startsWith('https://')) problems.push(`non-https link ${link.url}`);
  }
  return problems.map((problem) => `${title}: ${problem}`);
}

async function cheatSheetMaterial({ sheet, lesson, createdBy }) {
  const buffer = buildPdf(sheet);
  // The same checks as a trainer upload, so seeded files are indistinguishable from real ones.
  const checked = await inspectUpload({
    purpose: FILE_PURPOSES.MATERIAL,
    buffer,
    originalName: sheet.filename,
    declaredMime: 'application/pdf',
  });
  const file = await storeFile({
    ...checked,
    buffer,
    purpose: FILE_PURPOSES.MATERIAL,
    course: lesson.course,
    user: { _id: createdBy },
  });
  return {
    type: MATERIAL_TYPES.FILE,
    title: sheet.materialTitle,
    file: file._id,
    downloadable: true,
  };
}

async function materialsFor({ entry, lesson, sheet, createdBy }) {
  const blocks = [
    { type: MATERIAL_TYPES.NOTE, title: 'Lesson notes', body: entry.note },
    ...entry.code.map((code) => ({ type: MATERIAL_TYPES.CODE, ...code })),
    ...entry.links.map((link) => ({ type: MATERIAL_TYPES.LINK, ...link })),
  ];
  if (sheet) blocks.push(await cheatSheetMaterial({ sheet, lesson, createdBy }));
  return blocks.map((block, order) => ({
    ...block,
    lesson: lesson._id,
    course: lesson.course,
    order,
    status: PUBLISHED,
  }));
}

/**
 * Adds starter materials to the starter lessons of the seeded courses.
 * A lesson only gets them while it has no materials at all, so reruns never
 * duplicate, change or remove anything a trainer has added or edited.
 */
export async function seedCourseMaterials({ courses, lessonSlugsFor, createdBy }) {
  const results = [];
  for (const data of courses) {
    const course = await Course.findOne({ slug: data.slug }).select('_id');
    if (!course) continue;
    const content = await loadCourseContent(data);
    const slugs = lessonSlugsFor(data); // Map<title, slug>
    const sheet = CHEAT_SHEETS[data.slug];
    const lessons = await Lesson.find({
      course: course._id,
      slug: trusted({ $in: [...slugs.values()] }),
    });
    const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));

    let added = 0;
    let kept = 0;
    for (const [title, slug] of slugs) {
      const lesson = bySlug.get(slug);
      const entry = content.get(title);
      if (!lesson || !entry) continue;
      if (await Material.exists({ lesson: lesson._id })) {
        kept += 1;
        continue;
      }
      const lessonSheet = sheet?.lesson === title ? sheet : null;
      const docs = await materialsFor({ entry, lesson, sheet: lessonSheet, createdBy });
      try {
        await Material.insertMany(docs);
      } catch (error) {
        await deleteFilesIfUnused(docs.map((doc) => doc.file));
        throw error;
      }
      added += 1;
    }
    results.push({ slug: data.slug, added, kept });
  }
  return results;
}

/** Removes every material and material file. Development only (seed --reset). */
export async function resetMaterials() {
  await Material.deleteMany({});
  await deleteFilesWhere({ purpose: FILE_PURPOSES.MATERIAL });
}
