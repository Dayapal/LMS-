import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  CONTENT_STATUS,
  StudyAccess,
  StudyBook,
  StudyModule,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MATERIALS_ROOT = path.resolve(__dirname, '../../../content/study-materials');

/**
 * Resolves and reads an original HTML study material from disk.
 * Strictly prevents path traversal attacks and validates SHA-256 integrity.
 */
export async function readSourceHtml(sourcePath, expectedHash = null) {
  const normalizedRel = path.normalize(sourcePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolutePath = path.resolve(MATERIALS_ROOT, normalizedRel);

  // Path traversal guard: must be strictly inside MATERIALS_ROOT
  if (!absolutePath.startsWith(MATERIALS_ROOT)) {
    throw ApiError.badRequest('Invalid material file path traversal attempt');
  }

  let buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch (err) {
    logger.error(`Failed to read study material file at ${absolutePath}: ${err.message}`);
    throw ApiError.notFound('Study material source file not found');
  }

  // Integrity verification
  if (expectedHash) {
    const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (computedHash !== expectedHash) {
      logger.error(
        `Integrity mismatch for ${sourcePath}: expected ${expectedHash}, got ${computedHash}`,
      );
      throw ApiError.badRequest('Study material integrity check failed');
    }
  }

  return buffer.toString('utf8');
}

/**
 * Admin: Get all books and their modules for the catalogue / publishing manager.
 */
export async function getAdminBooksCatalogue() {
  const books = await StudyBook.find().sort({ order: 1 });
  const modules = await StudyModule.find().sort({ order: 1 }).populate('linkedAssignment', 'title dueAt');

  const modulesByBook = new Map();
  for (const mod of modules) {
    const key = mod.book.toString();
    if (!modulesByBook.has(key)) modulesByBook.set(key, []);
    modulesByBook.get(key).push(mod);
  }

  return books.map((book) => {
    const bookMods = modulesByBook.get(book._id.toString()) || [];
    const publishedCount = bookMods.filter((m) => m.status === CONTENT_STATUS.PUBLISHED).length;
    return {
      id: book._id.toString(),
      slug: book.slug,
      title: book.title,
      category: book.category,
      description: book.description,
      order: book.order,
      status: book.status,
      gradient: book.gradient,
      totalModules: bookMods.length,
      publishedModules: publishedCount,
      modules: bookMods.map((m) => ({
        id: m._id.toString(),
        slug: m.slug,
        title: m.title,
        phaseLabel: m.phaseLabel,
        originalFilename: m.originalFilename,
        order: m.order,
        status: m.status,
        estimatedMinutes: m.estimatedMinutes,
        fileBytes: m.fileBytes,
        linkedAssignment: m.linkedAssignment
          ? { id: m.linkedAssignment._id.toString(), title: m.linkedAssignment.title }
          : null,
      })),
    };
  });
}

/**
 * Admin: Update module publishing status, title, order, or linked assignment.
 */
export async function updateAdminStudyModule(moduleId, updateData) {
  const moduleDoc = await StudyModule.findById(moduleId);
  if (!moduleDoc) throw ApiError.notFound('Study module not found');

  const allowedFields = ['title', 'phaseLabel', 'status', 'order', 'estimatedMinutes', 'linkedAssignment'];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      moduleDoc[field] = updateData[field];
    }
  }

  await moduleDoc.save();
  return moduleDoc;
}

/**
 * Admin: Update study book title, description, status, or gradient.
 */
export async function updateAdminStudyBook(bookId, updateData) {
  const book = await StudyBook.findById(bookId);
  if (!book) throw ApiError.notFound('Study book not found');

  const allowedFields = ['title', 'description', 'status', 'order', 'gradient'];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      book[field] = updateData[field];
    }
  }

  await book.save();
  return book;
}

/**
 * Admin: Preview original HTML content for any module regardless of publication or assignment.
 */
export async function getAdminModulePreview(moduleId) {
  const moduleDoc = await StudyModule.findById(moduleId).populate('book');
  if (!moduleDoc) throw ApiError.notFound('Study module not found');

  const content = await readSourceHtml(moduleDoc.sourcePath, moduleDoc.fileHash);

  // Previous and next modules within the same book
  const siblings = await StudyModule.find({ book: moduleDoc.book._id }).sort({ order: 1 });
  const currentIndex = siblings.findIndex((s) => s._id.equals(moduleDoc._id));
  const prev = currentIndex > 0 ? { id: siblings[currentIndex - 1]._id.toString(), slug: siblings[currentIndex - 1].slug, title: siblings[currentIndex - 1].title } : null;
  const next = currentIndex < siblings.length - 1 ? { id: siblings[currentIndex + 1]._id.toString(), slug: siblings[currentIndex + 1].slug, title: siblings[currentIndex + 1].title } : null;

  return {
    module: {
      id: moduleDoc._id.toString(),
      slug: moduleDoc.slug,
      title: moduleDoc.title,
      phaseLabel: moduleDoc.phaseLabel,
      originalFilename: moduleDoc.originalFilename,
      status: moduleDoc.status,
      estimatedMinutes: moduleDoc.estimatedMinutes,
      book: {
        id: moduleDoc.book._id.toString(),
        slug: moduleDoc.book.slug,
        title: moduleDoc.book.title,
        category: moduleDoc.book.category,
        gradient: moduleDoc.book.gradient,
      },
    },
    navigation: { prev, next },
    content,
  };
}

/**
 * Student: List all assigned, published study books with progress overview.
 */
export async function getStudentStudyBooks(user) {
  const isTrainer = user.role === 'admin';
  const books = await StudyBook.find({
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  }).sort({ order: 1 });

  let accessMap = new Map();
  if (!isTrainer) {
    const accesses = await StudyAccess.find({ student: user._id, isBookAssigned: true });
    accessMap = new Map(accesses.map((a) => [a.book.toString(), a]));
  }

  const result = [];
  for (const book of books) {
    const bookId = book._id.toString();
    const access = accessMap.get(bookId);

    // If student and book not assigned, skip or show locked depending on requirement
    const isAssigned = isTrainer || Boolean(access);
    const releasedModuleIds = isTrainer
      ? null
      : new Set((access?.releasedModules || []).map((id) => id.toString()));

    const modules = await StudyModule.find({
      book: book._id,
      status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
    }).sort({ order: 1 });

    const totalAvailable = modules.length;
    const releasedCount = isTrainer
      ? totalAvailable
      : modules.filter((m) => releasedModuleIds?.has(m._id.toString())).length;

    result.push({
      id: book._id.toString(),
      slug: book.slug,
      title: book.title,
      category: book.category,
      description: book.description,
      gradient: book.gradient,
      isAssigned,
      totalModules: totalAvailable,
      releasedModulesCount: releasedCount,
      completedModulesCount: 0, // Milestone 4 connects StudyProgress
      overallProgressPercent: 0,
      lastAccessedModule: null,
    });
  }

  return result;
}

/**
 * Student: Get book detail with list of released vs locked modules.
 */
export async function getStudentBookDetail(bookSlug, user) {
  const isTrainer = user.role === 'admin';
  const book = await StudyBook.findOne({
    slug: bookSlug,
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  });
  if (!book) throw ApiError.notFound('Study book not found');

  let releasedModuleSet = null;
  if (!isTrainer) {
    const access = await StudyAccess.findOne({ student: user._id, book: book._id, isBookAssigned: true });
    if (!access) throw ApiError.notFound('Study book not assigned or not found');
    releasedModuleSet = new Set((access.releasedModules || []).map((id) => id.toString()));
  }

  const allModules = await StudyModule.find({
    book: book._id,
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  })
    .sort({ order: 1 })
    .populate('linkedAssignment', 'title dueAt');

  const moduleItems = allModules.map((m) => {
    const isReleased = isTrainer || releasedModuleSet.has(m._id.toString());
    return {
      id: m._id.toString(),
      slug: m.slug,
      title: m.title,
      phaseLabel: m.phaseLabel,
      order: m.order,
      estimatedMinutes: m.estimatedMinutes,
      isReleased,
      lockReason: isReleased ? null : 'Not yet released by trainer',
      linkedAssignment: m.linkedAssignment
        ? { id: m.linkedAssignment._id.toString(), title: m.linkedAssignment.title }
        : null,
      readingProgress: {
        status: 'not_started', // Milestone 4 links StudyProgress
        totalReadingSeconds: 0,
        isCompleted: false,
      },
    };
  });

  return {
    id: book._id.toString(),
    slug: book.slug,
    title: book.title,
    category: book.category,
    description: book.description,
    gradient: book.gradient,
    modules: moduleItems,
    releasedCount: moduleItems.filter((m) => m.isReleased).length,
    totalCount: moduleItems.length,
  };
}

/**
 * Student: Open and stream the HTML content for an assigned, released module.
 */
export async function getStudentModuleContent(bookSlug, moduleSlug, user) {
  const isTrainer = user.role === 'admin';
  const book = await StudyBook.findOne({
    slug: bookSlug,
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  });
  if (!book) throw ApiError.notFound('Study book not found');

  const moduleDoc = await StudyModule.findOne({
    book: book._id,
    slug: moduleSlug,
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  }).populate('linkedAssignment', 'title dueAt instructions');
  if (!moduleDoc) throw ApiError.notFound('Study module not found');

  // Authorization check for students: must have active access to book AND this module
  let releasedModuleSet = null;
  if (!isTrainer) {
    const access = await StudyAccess.findOne({ student: user._id, book: book._id, isBookAssigned: true });
    if (!access) throw ApiError.notFound('Study material not found');
    releasedModuleSet = new Set((access.releasedModules || []).map((id) => id.toString()));
    if (!releasedModuleSet.has(moduleDoc._id.toString())) {
      throw ApiError.notFound('Study module not found');
    }
  }

  const content = await readSourceHtml(moduleDoc.sourcePath, moduleDoc.fileHash);

  // Compute navigation: previous and next released module in this book
  const allModules = await StudyModule.find({
    book: book._id,
    status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
  }).sort({ order: 1 });

  const releasedModules = isTrainer
    ? allModules
    : allModules.filter((m) => releasedModuleSet.has(m._id.toString()));

  const currentIndex = releasedModules.findIndex((m) => m._id.equals(moduleDoc._id));
  const prev =
    currentIndex > 0
      ? {
          slug: releasedModules[currentIndex - 1].slug,
          title: releasedModules[currentIndex - 1].title,
          phaseLabel: releasedModules[currentIndex - 1].phaseLabel,
        }
      : null;
  const next =
    currentIndex < releasedModules.length - 1
      ? {
          slug: releasedModules[currentIndex + 1].slug,
          title: releasedModules[currentIndex + 1].title,
          phaseLabel: releasedModules[currentIndex + 1].phaseLabel,
        }
      : null;

  return {
    book: {
      id: book._id.toString(),
      slug: book.slug,
      title: book.title,
      category: book.category,
      gradient: book.gradient,
    },
    module: {
      id: moduleDoc._id.toString(),
      slug: moduleDoc.slug,
      title: moduleDoc.title,
      phaseLabel: moduleDoc.phaseLabel,
      originalFilename: moduleDoc.originalFilename,
      estimatedMinutes: moduleDoc.estimatedMinutes,
      linkedAssignment: moduleDoc.linkedAssignment
        ? {
            id: moduleDoc.linkedAssignment._id.toString(),
            title: moduleDoc.linkedAssignment.title,
            dueAt: moduleDoc.linkedAssignment.dueAt,
          }
        : null,
    },
    navigation: { prev, next },
    content,
  };
}

/**
 * Admin: List all students with their study books access overview.
 */
export async function getAdminStudentsAccessOverview() {
  const students = await User.find({ role: 'student', isActive: true }).sort({ name: 1 });
  const books = await StudyBook.find().sort({ order: 1 });
  const accesses = await StudyAccess.find({
    student: { $in: students.map((s) => s._id) },
  });

  const accessByKey = new Map();
  for (const acc of accesses) {
    accessByKey.set(`${acc.student.toString()}:${acc.book.toString()}`, acc);
  }

  return students.map((student) => {
    const studentBooks = books.map((book) => {
      const acc = accessByKey.get(`${student._id.toString()}:${book._id.toString()}`);
      return {
        bookId: book._id.toString(),
        slug: book.slug,
        title: book.title,
        isAssigned: Boolean(acc?.isBookAssigned),
        releasedCount: acc?.releasedModules?.length || 0,
        canViewReport: acc?.canViewReport !== false,
      };
    });

    const assignedCount = studentBooks.filter((b) => b.isAssigned).length;
    const canViewAnyReport = studentBooks.every((b) => b.canViewReport);

    return {
      student: {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        avatarUrl: student.avatarUrl,
      },
      assignedBooksCount: assignedCount,
      canViewReport: canViewAnyReport,
      books: studentBooks,
    };
  });
}

/**
 * Admin: Get detailed access configuration for an individual student.
 */
export async function getAdminStudentAccessDetail(studentId) {
  const student = await User.findById(studentId);
  if (!student || student.role !== 'student') {
    throw ApiError.notFound('Student not found');
  }

  const books = await StudyBook.find().sort({ order: 1 });
  const modules = await StudyModule.find().sort({ order: 1 });
  const accesses = await StudyAccess.find({ student: student._id });

  const accessByBook = new Map(accesses.map((a) => [a.book.toString(), a]));
  const modulesByBook = new Map();
  for (const mod of modules) {
    const key = mod.book.toString();
    if (!modulesByBook.has(key)) modulesByBook.set(key, []);
    modulesByBook.get(key).push(mod);
  }

  const bookDetails = books.map((book) => {
    const bookId = book._id.toString();
    const acc = accessByBook.get(bookId);
    const bookModules = modulesByBook.get(bookId) || [];
    const releasedSet = new Set((acc?.releasedModules || []).map((id) => id.toString()));

    return {
      bookId,
      slug: book.slug,
      title: book.title,
      category: book.category,
      isAssigned: Boolean(acc?.isBookAssigned),
      canViewReport: acc ? acc.canViewReport : true,
      modules: bookModules.map((m) => ({
        id: m._id.toString(),
        slug: m.slug,
        title: m.title,
        phaseLabel: m.phaseLabel,
        order: m.order,
        status: m.status,
        isReleased: releasedSet.has(m._id.toString()),
      })),
    };
  });

  return {
    student: {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
    },
    books: bookDetails,
  };
}

/**
 * Admin: Update access for an individual student on a specific book.
 */
export async function updateAdminStudentAccess(studentId, { bookId, isBookAssigned, releasedModuleIds, canViewReport }, adminUser) {
  const student = await User.findById(studentId);
  if (!student || student.role !== 'student') throw ApiError.notFound('Student not found');

  const book = await StudyBook.findById(bookId);
  if (!book) throw ApiError.notFound('Study book not found');

  let access = await StudyAccess.findOne({ student: student._id, book: book._id });
  if (!access) {
    access = new StudyAccess({
      student: student._id,
      book: book._id,
      grantedBy: adminUser._id,
      grantedAt: new Date(),
    });
  }

  if (isBookAssigned !== undefined) access.isBookAssigned = Boolean(isBookAssigned);
  if (canViewReport !== undefined) access.canViewReport = Boolean(canViewReport);
  if (Array.isArray(releasedModuleIds)) {
    // Validate module ids belong to this book
    const validModules = await StudyModule.find({
      book: book._id,
      _id: { $in: releasedModuleIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select('_id');
    access.releasedModules = validModules.map((m) => m._id);
  }

  await access.save();
  return access;
}

/**
 * Admin: Bulk assign books or modules to multiple students.
 */
export async function bulkUpdateAdminStudentAccess({ studentIds, bookId, isBookAssigned, releasedModuleIds }, adminUser) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw ApiError.badRequest('studentIds must be a non-empty array');
  }

  const results = [];
  for (const sId of studentIds) {
    const acc = await updateAdminStudentAccess(
      sId,
      { bookId, isBookAssigned, releasedModuleIds },
      adminUser,
    );
    results.push(acc);
  }
  return { updatedCount: results.length };
}
