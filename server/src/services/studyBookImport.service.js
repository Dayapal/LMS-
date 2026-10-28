import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CONTENT_STATUS, StudyBook, StudyModule } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_MATERIALS_ROOT = path.resolve(__dirname, '../../../content/study-materials');

const MAX_TOTAL_UNCOMPRESSED_BYTES = 120 * 1024 * 1024; // 120 MB max
const MAX_COMPRESSION_RATIO = 100; // max 100:1 ratio for files > 100KB

/**
 * Validates an archive relative path against Zip Slip attacks.
 */
export function validateSafeZipPath(entryPath) {
  if (!entryPath || typeof entryPath !== 'string') {
    throw new Error('Invalid archive entry: missing path');
  }

  // Reject drive letters like C: or D:
  if (/^[a-zA-Z]:/.test(entryPath)) {
    throw new Error(`Zip traversal attack detected: entry has drive prefix (${entryPath})`);
  }

  // Reject absolute paths
  if (path.isAbsolute(entryPath) || entryPath.startsWith('/') || entryPath.startsWith('\\')) {
    throw new Error(`Zip traversal attack detected: entry has absolute path (${entryPath})`);
  }

  // Normalize path and check for traversal
  const normalized = path.normalize(entryPath).replace(/\\/g, '/');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Zip traversal attack detected: entry contains path traversal (${entryPath})`);
  }

  return normalized;
}

/**
 * Pure Node.js zero-dependency secure ZIP parser.
 * Implements strict Zip Slip protection, Decompression Bomb guards,
 * and unsafe symlink rejection.
 */
export function parseZipBuffer(zipBuffer, { maxTotalBytes = MAX_TOTAL_UNCOMPRESSED_BYTES } = {}) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) {
    throw new Error('Invalid zip file: buffer is too small or corrupt');
  }

  // 1. Locate End of Central Directory (EOCD) record
  // Signature 0x06054b50 (PK\x05\x06)
  let eocdOffset = -1;
  const maxScan = Math.min(zipBuffer.length, 65535 + 22);
  const startScan = zipBuffer.length - 22;

  for (let i = startScan; i >= zipBuffer.length - maxScan; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid zip file: End of Central Directory (EOCD) record not found');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (cdOffset + cdSize > zipBuffer.length) {
    throw new Error('Invalid zip file: Central Directory offset out of bounds');
  }

  const entries = [];
  let currentOffset = cdOffset;
  let cumulativeUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    const signature = zipBuffer.readUInt32LE(currentOffset);
    if (signature !== 0x02014b50) {
      throw new Error(`Corrupt zip file: invalid Central Directory signature at offset ${currentOffset}`);
    }

    const compressionMethod = zipBuffer.readUInt16LE(currentOffset + 10);
    const compressedSize = zipBuffer.readUInt32LE(currentOffset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(currentOffset + 24);
    const filenameLen = zipBuffer.readUInt16LE(currentOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(currentOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(currentOffset + 32);
    const externalAttr = zipBuffer.readUInt32LE(currentOffset + 38);
    const localHeaderOffset = zipBuffer.readUInt32LE(currentOffset + 42);

    const rawFilename = zipBuffer.toString('utf8', currentOffset + 46, currentOffset + 46 + filenameLen);
    const safePath = validateSafeZipPath(rawFilename);

    // Symlink rejection: Unix file type in upper 16 bits: 0o120000 = symlink
    const unixMode = (externalAttr >>> 16) & 0xffff;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new Error(`Unsafe archive entry: symbolic link detected for ${safePath}`);
    }

    const isDirectory = safePath.endsWith('/') || (unixMode & 0o040000) === 0o040000;

    // Decompression bomb detection
    cumulativeUncompressedBytes += uncompressedSize;
    if (cumulativeUncompressedBytes > maxTotalBytes) {
      throw new Error(
        `Decompression bomb rejected: total uncompressed size exceeds limit of ${maxTotalBytes} bytes`,
      );
    }

    if (uncompressedSize > 100 * 1024 && compressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > MAX_COMPRESSION_RATIO) {
        throw new Error(
          `Decompression bomb rejected: compression ratio of ${ratio.toFixed(1)}:1 exceeds safety limit for ${safePath}`,
        );
      }
    }

    let fileBuffer = null;
    if (!isDirectory) {
      // Read local file header to find exact start of compressed data
      if (localHeaderOffset + 30 > zipBuffer.length) {
        throw new Error(`Corrupt zip file: local header offset out of bounds for ${safePath}`);
      }

      const localSig = zipBuffer.readUInt32LE(localHeaderOffset);
      if (localSig !== 0x04034b50) {
        throw new Error(`Corrupt zip file: invalid local header signature for ${safePath}`);
      }

      const localFilenameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFilenameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > zipBuffer.length) {
        throw new Error(`Corrupt zip file: compressed payload out of bounds for ${safePath}`);
      }

      const compressedData = zipBuffer.subarray(dataStart, dataEnd);

      if (compressionMethod === 0) {
        // STORED (no compression)
        fileBuffer = Buffer.from(compressedData);
      } else if (compressionMethod === 8) {
        // DEFLATE
        try {
          fileBuffer = zlib.inflateRawSync(compressedData);
        } catch (inflateErr) {
          throw new Error(`Failed to decompress ${safePath}: ${inflateErr.message}`);
        }
      } else {
        throw new Error(`Unsupported compression method ${compressionMethod} in ${safePath}`);
      }

      if (fileBuffer.length !== uncompressedSize) {
        throw new Error(
          `Size mismatch for ${safePath}: expected ${uncompressedSize} bytes, got ${fileBuffer.length}`,
        );
      }
    }

    const fileHash = fileBuffer ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : null;

    entries.push({
      path: safePath,
      isDirectory,
      size: fileBuffer ? fileBuffer.length : 0,
      hash: fileHash,
      buffer: fileBuffer,
    });

    currentOffset += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Scans an existing uncompressed folder on disk and returns its file inventory.
 */
export async function inventorySourceFolder(folderPath) {
  const entries = [];

  async function walk(currentDir, relativeBase = '') {
    const items = await fs.readdir(currentDir, { withFileTypes: true });
    for (const item of items) {
      const relPath = relativeBase ? `${relativeBase}/${item.name}` : item.name;
      const fullPath = path.join(currentDir, item.name);

      if (item.isDirectory()) {
        entries.push({
          path: relPath,
          isDirectory: true,
          size: 0,
          hash: null,
          buffer: null,
        });
        await walk(fullPath, relPath);
      } else if (item.isFile()) {
        const buf = await fs.readFile(fullPath);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        entries.push({
          path: relPath,
          isDirectory: false,
          size: buf.length,
          hash,
          buffer: buf,
        });
      }
    }
  }

  await walk(folderPath);
  return entries;
}

/**
 * Analyzes parsed HTML entries and infers book groupings, phase labels,
 * display titles, and duplicate mirrors.
 */
export function classifyBookEntries(rawEntries) {
  const htmlFiles = rawEntries.filter((e) => !e.isDirectory && e.path.toLowerCase().endsWith('.html'));
  const booksMap = new Map();

  for (const entry of htmlFiles) {
    const parts = entry.path.split('/');
    let folder = parts.length > 1 ? parts[0] : 'General';
    let filename = parts[parts.length - 1];

    // Infer category and canonical book slug
    let category = 'javascript';
    let bookSlug = 'javascript';
    let bookTitle = 'JavaScript Mastery';
    let gradient = 'linear-gradient(135deg, #F8DE22 0%, #F45B26 100%)';

    const lowerFolder = folder.toLowerCase();
    if (lowerFolder.includes('dsa')) {
      category = 'dsa';
      bookSlug = 'dsa-javascript';
      bookTitle = 'DSA in JavaScript';
      gradient = 'linear-gradient(135deg, #03AED2 0%, #02879F 100%)';
    } else if (lowerFolder.includes('react')) {
      category = 'react';
      bookSlug = 'react-js';
      bookTitle = 'React JS';
      gradient = 'linear-gradient(135deg, #03AED2 0%, #D12052 100%)';
    }

    if (!booksMap.has(bookSlug)) {
      booksMap.set(bookSlug, {
        slug: bookSlug,
        title: bookTitle,
        category,
        gradient,
        folder,
        modules: [],
      });
    }

    // Extract title from <title> tag if available
    const htmlText = entry.buffer ? entry.buffer.toString('utf8') : '';
    const titleMatch = htmlText.match(/<title>([^<]*)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.html$/i, '');

    // Extract phase label
    let phaseLabel = '';
    const phaseMatch = filename.match(/phase-?(\d+)/i) || filename.match(/module-?(\d+)/i);
    if (phaseMatch) {
      const num = parseInt(phaseMatch[1], 10);
      phaseLabel = filename.toLowerCase().includes('module') ? `Module ${num}` : `Phase ${num}`;
    }

    // Canonical module slug
    const cleanSlug = filename
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    booksMap.get(bookSlug).modules.push({
      originalFilename: filename,
      sourcePath: entry.path,
      slug: cleanSlug,
      title,
      phaseLabel,
      fileBytes: entry.size,
      fileHash: entry.hash,
      buffer: entry.buffer,
    });
  }

  // Detect duplicate hashes within each book
  const books = Array.from(booksMap.values());
  for (const book of books) {
    const seenHashes = new Set();
    book.modules.forEach((mod, idx) => {
      mod.order = idx + 1;
      if (seenHashes.has(mod.fileHash)) {
        mod.isDuplicateMirror = true;
        mod.status = CONTENT_STATUS.DRAFT;
      } else {
        seenHashes.add(mod.fileHash);
        mod.isDuplicateMirror = false;
        mod.status = CONTENT_STATUS.PUBLISHED;
      }
    });
  }

  return books;
}

/**
 * High-level book import runner.
 * Supports:
 *  - .zip file buffer or path
 *  - Directory path
 *  - dryRun mode
 *  - Idempotency & version conflict protection
 */
export async function importStudyBooks({
  archivePath = null,
  archiveBuffer = null,
  directoryPath = null,
  targetRootDir = DEFAULT_MATERIALS_ROOT,
  dryRun = false,
  force = false,
  createdBy = null,
} = {}) {
  let rawEntries = [];

  if (archiveBuffer) {
    rawEntries = parseZipBuffer(archiveBuffer);
  } else if (archivePath) {
    const buf = await fs.readFile(archivePath);
    rawEntries = parseZipBuffer(buf);
  } else if (directoryPath) {
    rawEntries = await inventorySourceFolder(directoryPath);
  } else {
    throw ApiError.badRequest('Must provide either archivePath, archiveBuffer, or directoryPath');
  }

  const classifiedBooks = classifyBookEntries(rawEntries);

  const report = {
    dryRun,
    totalFiles: rawEntries.filter((e) => !e.isDirectory).length,
    htmlCount: rawEntries.filter((e) => !e.isDirectory && e.path.endsWith('.html')).length,
    totalBytes: rawEntries.reduce((sum, e) => sum + e.size, 0),
    booksCount: classifiedBooks.length,
    books: [],
    warnings: [],
    errors: [],
    success: true,
  };

  for (const b of classifiedBooks) {
    const bookReport = {
      slug: b.slug,
      title: b.title,
      category: b.category,
      modulesCount: b.modules.length,
      publishedCount: b.modules.filter((m) => m.status === CONTENT_STATUS.PUBLISHED).length,
      duplicateCount: b.modules.filter((m) => m.isDuplicateMirror).length,
      modules: b.modules.map((m) => ({
        originalFilename: m.originalFilename,
        slug: m.slug,
        title: m.title,
        phaseLabel: m.phaseLabel,
        bytes: m.fileBytes,
        hash: m.fileHash,
        status: m.status,
        isDuplicate: m.isDuplicateMirror,
      })),
    };
    report.books.push(bookReport);

    if (b.modules.some((m) => m.isDuplicateMirror)) {
      report.warnings.push(
        `Book "${b.title}" contains ${bookReport.duplicateCount} duplicate mirror module(s) marked draft by default.`,
      );
    }
  }

  // If dry-run, stop here and return report
  if (dryRun) {
    return report;
  }

  // Persist files to disk / private storage if not already there
  for (const raw of rawEntries) {
    if (raw.isDirectory || !raw.buffer) continue;
    const destPath = path.resolve(targetRootDir, raw.path);
    const destDir = path.dirname(destPath);

    // Path traversal guard
    if (!destPath.startsWith(path.resolve(targetRootDir))) {
      throw new Error(`Security violation: attempted to write file outside storage root: ${destPath}`);
    }

    await fs.mkdir(destDir, { recursive: true });

    // Check if file already exists with identical hash (idempotency)
    let exists = false;
    try {
      const existingBuf = await fs.readFile(destPath);
      const existingHash = crypto.createHash('sha256').update(existingBuf).digest('hex');
      if (existingHash === raw.hash) {
        exists = true;
      } else if (!force) {
        report.warnings.push(
          `File conflict: ${raw.path} already exists with different hash. Skipped overwrite (use force to overwrite).`,
        );
        continue;
      }
    } catch {
      // File does not exist, proceed to write
    }

    if (!exists) {
      await fs.writeFile(destPath, raw.buffer);
    }
  }

  // Ingest or update metadata in database if Mongoose is connected
  try {
    for (const b of classifiedBooks) {
      let bookDoc = await StudyBook.findOne({ slug: b.slug });
      if (!bookDoc) {
        bookDoc = await StudyBook.create({
          title: b.title,
          slug: b.slug,
          category: b.category,
          gradient: b.gradient,
          order: b.slug === 'dsa-javascript' ? 0 : b.slug === 'javascript' ? 1 : 2,
          status: CONTENT_STATUS.PUBLISHED,
          createdBy,
        });
      }

      for (const m of b.modules) {
        let modDoc = await StudyModule.findOne({ book: bookDoc._id, slug: m.slug });
        if (!modDoc) {
          await StudyModule.create({
            book: bookDoc._id,
            title: m.title,
            slug: m.slug,
            phaseLabel: m.phaseLabel,
            originalFilename: m.originalFilename,
            sourcePath: m.sourcePath,
            fileHash: m.fileHash,
            fileBytes: m.fileBytes,
            order: m.order,
            status: m.status,
          });
        } else if (modDoc.fileHash !== m.fileHash && force) {
          modDoc.fileHash = m.fileHash;
          modDoc.fileBytes = m.fileBytes;
          modDoc.title = m.title;
          await modDoc.save();
        }
      }
    }
  } catch (dbErr) {
    logger.warn(`Database metadata synchronization skipped: ${dbErr.message}`);
  }

  return report;
}

