import { StudyBook, StudyModule } from '../models/index.js';
import { STUDY_BOOKS_DATA, STUDY_MODULES_DATA } from './data/studyMaterials.js';

/**
 * Seeds or updates the 3 Study Books. Idempotent: re-runs will not duplicate books.
 */
export async function seedStudyBooks({ createdBy } = {}) {
  const results = [];
  for (const data of STUDY_BOOKS_DATA) {
    let book = await StudyBook.findOne({ slug: data.slug });
    if (!book) {
      book = await StudyBook.create({
        ...data,
        createdBy: createdBy || null,
      });
      results.push({ slug: data.slug, created: true, book });
    } else {
      // Update metadata while preserving any trainer status customizations
      book.title = data.title;
      book.category = data.category;
      book.description = data.description;
      book.order = data.order;
      book.gradient = data.gradient;
      if (createdBy && !book.createdBy) book.createdBy = createdBy;
      await book.save();
      results.push({ slug: data.slug, created: false, book });
    }
  }
  return results;
}

/**
 * Seeds or updates the 27 Study Modules across the books.
 * Idempotent: re-runs ensure all modules exist with accurate hashes and metadata.
 */
export async function seedStudyModules() {
  const books = await StudyBook.find();
  const bookMap = new Map(books.map((b) => [b.slug, b]));

  let added = 0;
  let updated = 0;

  for (const data of STUDY_MODULES_DATA) {
    const book = bookMap.get(data.bookSlug);
    if (!book) continue;

    let moduleDoc = await StudyModule.findOne({ book: book._id, slug: data.slug });
    if (!moduleDoc) {
      await StudyModule.create({
        book: book._id,
        slug: data.slug,
        title: data.title,
        phaseLabel: data.phaseLabel,
        originalFilename: data.originalFilename,
        sourcePath: data.sourcePath,
        fileHash: data.fileHash,
        fileBytes: data.fileBytes,
        order: data.order,
        status: data.status,
        estimatedMinutes: data.estimatedMinutes,
      });
      added += 1;
    } else {
      moduleDoc.title = data.title;
      moduleDoc.phaseLabel = data.phaseLabel;
      moduleDoc.sourcePath = data.sourcePath;
      moduleDoc.fileHash = data.fileHash;
      moduleDoc.fileBytes = data.fileBytes;
      moduleDoc.order = data.order;
      moduleDoc.estimatedMinutes = data.estimatedMinutes;
      await moduleDoc.save();
      updated += 1;
    }
  }

  return { added, updated, total: STUDY_MODULES_DATA.length };
}

/**
 * Main entry point for study materials seeding.
 */
export async function seedStudyMaterials({ createdBy } = {}) {
  const books = await seedStudyBooks({ createdBy });
  const modules = await seedStudyModules();
  return { books, modules };
}

/**
 * Resets study materials. Development only (--reset).
 */
export async function resetStudyMaterials() {
  await StudyModule.deleteMany({});
  await StudyBook.deleteMany({});
}
