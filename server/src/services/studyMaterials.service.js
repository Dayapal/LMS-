import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  ACTIVITY_TYPES,
  CONTENT_STATUS,
  StudyAccess,
  StudyBook,
  StudyModule,
  StudyProgress,
  User,
} from '../models/index.js';
import { recordActivity } from './activity.service.js';
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
  let progressList = [];
  if (!isTrainer) {
    const [accesses, progresses] = await Promise.all([
      StudyAccess.find({ student: user._id, isBookAssigned: true }),
      StudyProgress.find({ student: user._id }),
    ]);
    accessMap = new Map(accesses.map((a) => [a.book.toString(), a]));
    progressList = progresses;
  }

  const result = [];
  for (const book of books) {
    const bookId = book._id.toString();
    const access = accessMap.get(bookId);

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

    const bookProgresses = progressList.filter((p) => p.book.toString() === bookId);
    const completedCount = isTrainer
      ? 0
      : bookProgresses.filter((p) => p.isCompleted).length;
    const totalReadingSeconds = isTrainer
      ? 0
      : bookProgresses.reduce((acc, p) => acc + (p.totalReadingSeconds || 0), 0);
    const overallProgressPercent = releasedCount > 0
      ? Math.min(100, Math.round((completedCount / releasedCount) * 100))
      : 0;

    // Last accessed module for resume action
    let lastAccessedModule = null;
    if (bookProgresses.length > 0) {
      bookProgresses.sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt));
      const targetMod = modules.find((m) => m._id.toString() === bookProgresses[0].module.toString());
      if (targetMod && (isTrainer || releasedModuleIds?.has(targetMod._id.toString()))) {
        lastAccessedModule = {
          slug: targetMod.slug,
          title: targetMod.title,
          phaseLabel: targetMod.phaseLabel,
        };
      }
    }
    if (!lastAccessedModule && releasedCount > 0) {
      const firstReleased = modules.find((m) => isTrainer || releasedModuleIds?.has(m._id.toString()));
      if (firstReleased) {
        lastAccessedModule = {
          slug: firstReleased.slug,
          title: firstReleased.title,
          phaseLabel: firstReleased.phaseLabel,
        };
      }
    }

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
      completedModulesCount: completedCount,
      totalReadingSeconds,
      overallProgressPercent,
      lastAccessedModule,
    });
  }

  return result;
}

/**
 * Student: Get book detail with list of released vs locked modules and reading progress.
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

  const [allModules, progressList] = await Promise.all([
    StudyModule.find({
      book: book._id,
      status: isTrainer ? { $ne: 'archived' } : CONTENT_STATUS.PUBLISHED,
    })
      .sort({ order: 1 })
      .populate('linkedAssignment', 'title dueAt'),
    !isTrainer ? StudyProgress.find({ student: user._id, book: book._id }) : Promise.resolve([]),
  ]);

  const progressByModule = new Map(progressList.map((p) => [p.module.toString(), p]));

  const moduleItems = allModules.map((m) => {
    const isReleased = isTrainer || releasedModuleSet.has(m._id.toString());
    const prog = progressByModule.get(m._id.toString());
    const isCompleted = Boolean(prog?.isCompleted);
    const readingSeconds = prog?.totalReadingSeconds || 0;
    const status = isCompleted ? 'completed' : readingSeconds > 0 ? 'in_progress' : 'not_started';

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
        status,
        totalReadingSeconds: readingSeconds,
        isCompleted,
        completedAt: prog?.completedAt || null,
        lastScrollPosition: prog?.lastScrollPosition || 0,
      },
    };
  });

  const releasedCount = moduleItems.filter((m) => m.isReleased).length;
  const completedCount = moduleItems.filter((m) => m.readingProgress.isCompleted).length;
  const overallPercent = releasedCount > 0 ? Math.round((completedCount / releasedCount) * 100) : 0;

  return {
    id: book._id.toString(),
    slug: book.slug,
    title: book.title,
    category: book.category,
    description: book.description,
    gradient: book.gradient,
    modules: moduleItems,
    releasedCount,
    completedCount,
    overallPercent,
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

  let readingProgress = {
    isCompleted: false,
    totalReadingSeconds: 0,
    lastScrollPosition: 0,
    completedAt: null,
  };

  if (!isTrainer) {
    let prog = await StudyProgress.findOne({ student: user._id, module: moduleDoc._id });
    if (!prog) {
      prog = await StudyProgress.create({
        student: user._id,
        book: book._id,
        module: moduleDoc._id,
        firstOpenedAt: new Date(),
        lastAccessedAt: new Date(),
      });
    } else {
      prog.lastAccessedAt = new Date();
      await prog.save();
    }
    readingProgress = {
      isCompleted: prog.isCompleted,
      totalReadingSeconds: prog.totalReadingSeconds,
      lastScrollPosition: prog.lastScrollPosition,
      completedAt: prog.completedAt,
    };
  }

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
    readingProgress,
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

/**
 * Student: Record reading duration heartbeat and scroll position.
 */
export async function recordReadingHeartbeat({ user, bookSlug, moduleSlug, activeSeconds, scrollPosition }) {
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
  });
  if (!moduleDoc) throw ApiError.notFound('Study module not found');

  if (!isTrainer) {
    const access = await StudyAccess.findOne({ student: user._id, book: book._id, isBookAssigned: true });
    if (!access) throw ApiError.notFound('Study module not found');
    const releasedSet = new Set((access.releasedModules || []).map((id) => id.toString()));
    if (!releasedSet.has(moduleDoc._id.toString())) {
      throw ApiError.notFound('Study module not found');
    }
  }

  // Cap active seconds to max 120 per heartbeat
  const increment = Math.max(0, Math.min(Number(activeSeconds) || 0, 120));

  let progress = await StudyProgress.findOne({ student: user._id, module: moduleDoc._id });
  if (!progress) {
    progress = new StudyProgress({
      student: user._id,
      book: book._id,
      module: moduleDoc._id,
      firstOpenedAt: new Date(),
      lastAccessedAt: new Date(),
      totalReadingSeconds: increment,
    });
  } else {
    progress.totalReadingSeconds += increment;
    progress.lastAccessedAt = new Date();
  }

  if (typeof scrollPosition === 'number') {
    progress.lastScrollPosition = Math.max(0, Math.min(100, Math.round(scrollPosition)));
  }

  await progress.save();

  return {
    totalReadingSeconds: progress.totalReadingSeconds,
    lastScrollPosition: progress.lastScrollPosition,
    isCompleted: progress.isCompleted,
    completedAt: progress.completedAt,
  };
}

/**
 * Student: Mark or unmark module complete.
 */
export async function setModuleCompletion({ user, bookSlug, moduleSlug, isCompleted }) {
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
  });
  if (!moduleDoc) throw ApiError.notFound('Study module not found');

  if (!isTrainer) {
    const access = await StudyAccess.findOne({ student: user._id, book: book._id, isBookAssigned: true });
    if (!access) throw ApiError.notFound('Study module not found');
    const releasedSet = new Set((access.releasedModules || []).map((id) => id.toString()));
    if (!releasedSet.has(moduleDoc._id.toString())) {
      throw ApiError.notFound('Study module not found');
    }
  }

  let progress = await StudyProgress.findOne({ student: user._id, module: moduleDoc._id });
  if (!progress) {
    progress = new StudyProgress({
      student: user._id,
      book: book._id,
      module: moduleDoc._id,
      firstOpenedAt: new Date(),
    });
  }

  progress.isCompleted = Boolean(isCompleted);
  progress.completedAt = isCompleted ? new Date() : null;
  progress.lastAccessedAt = new Date();

  await progress.save();

  if (isCompleted) {
    await recordActivity({
      user: user._id,
      type: ACTIVITY_TYPES.STUDY_MODULE_COMPLETED,
    });
  }

  return {
    moduleSlug: moduleDoc.slug,
    isCompleted: progress.isCompleted,
    completedAt: progress.completedAt,
    totalReadingSeconds: progress.totalReadingSeconds,
  };
}

/**
 * Student: Summary stats for Student Dashboard integration.
 */
export async function getStudentStudySummary(user) {
  const books = await getStudentStudyBooks(user);
  const totalAssignedBooks = books.filter((b) => b.isAssigned).length;
  const totalReleasedModules = books.reduce((acc, b) => acc + (b.isAssigned ? b.releasedModulesCount : 0), 0);
  const totalCompletedModules = books.reduce((acc, b) => acc + (b.isAssigned ? b.completedModulesCount : 0), 0);
  const totalReadingSeconds = books.reduce((acc, b) => acc + (b.isAssigned ? (b.totalReadingSeconds || 0) : 0), 0);

  const overallPercent = totalReleasedModules > 0
    ? Math.round((totalCompletedModules / totalReleasedModules) * 100)
    : 0;

  // Find continue point: first incomplete released module in assigned books
  let continueModule = null;
  for (const b of books) {
    if (b.isAssigned && b.lastAccessedModule && b.completedModulesCount < b.releasedModulesCount) {
      continueModule = {
        bookSlug: b.slug,
        bookTitle: b.title,
        ...b.lastAccessedModule,
      };
      break;
    }
  }

  return {
    totalAssignedBooks,
    totalReleasedModules,
    totalCompletedModules,
    totalReadingSeconds,
    overallPercent,
    continueModule,
    books,
  };
}

