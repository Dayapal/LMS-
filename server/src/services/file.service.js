import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  Assignment,
  Course,
  FILE_PURPOSES,
  FileAsset,
  Material,
  Submission,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { getFileForViewer } from './access.service.js';
import { inspectUpload } from './fileRules.js';
import { toFileDTO } from './serializers.js';
import { getStorage } from './storage/index.js';

const { trusted } = mongoose;

/**
 * Stores bytes that already passed `inspectUpload` and records their metadata.
 * The stored name is a random key; the client's file name is metadata only.
 */
export async function storeFile({
  buffer,
  ext,
  mimeType,
  originalName,
  purpose,
  course,
  assignment,
  user,
}) {
  const storage = getStorage();
  const storageKey = `${purpose}/${crypto.randomUUID()}.${ext}`;
  await storage.put(storageKey, buffer, { contentType: mimeType });
  try {
    return await FileAsset.create({
      provider: storage.name,
      storageKey,
      originalName,
      mimeType,
      size: buffer.length,
      checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
      purpose,
      course,
      assignment,
      uploadedBy: user._id,
    });
  } catch (error) {
    // The bytes are stored but the record isn't: remove them, and keep the original error.
    await removeBytes(storage.name, storageKey, 'Could not remove an upload whose record failed');
    throw error;
  }
}

/**
 * Deletes stored bytes without failing the caller. A failure leaves an
 * unreferenced object, which `npm run files -- cleanup` reports and removes.
 */
async function removeBytes(provider, storageKey, message) {
  try {
    await getStorage(provider).remove(storageKey);
    return true;
  } catch (error) {
    logger.warn({ provider, err: { name: error.name, message: error.message } }, message);
    return false;
  }
}

/** POST /files: a trainer uploads a study material or assignment handout for one course. */
export async function uploadFile(user, { purpose, courseId }, upload) {
  if (!upload) throw ApiError.fileRejected('Choose a file to upload');
  const course = await Course.findById(courseId).select('_id');
  if (!course) throw ApiError.validation([{ path: 'courseId', message: 'Course not found' }]);
  const checked = await inspectUpload({
    purpose,
    buffer: upload.buffer,
    originalName: upload.originalname,
    declaredMime: upload.mimetype,
  });
  const file = await storeFile({
    ...checked,
    buffer: upload.buffer,
    purpose,
    course: course._id,
    user,
  });
  return toFileDTO(file);
}

/**
 * Everything needed to stream a file to `user`, after the access check.
 * `attachment` is true only when a download was asked for and is allowed.
 */
export async function openFileForViewer(user, fileId, { download }) {
  const { file, downloadable } = await getFileForViewer(user, fileId);
  // Opened only after the access check: the bytes are never reachable another way.
  const opened = await getStorage(file.provider).open(file.storageKey);
  if (!opened) {
    logger.warn({ fileId: file.id, provider: file.provider }, 'Stored file is missing');
    throw ApiError.notFound('File not found');
  }
  return { file, ...opened, attachment: Boolean(download) && downloadable };
}

/**
 * Deletes the records first, then the bytes. If storage fails, nothing points
 * at the leftover bytes (invisible, reported by the cleanup script) instead of
 * records pointing at missing bytes, and the caller's delete still succeeds.
 */
async function removeAssets(files) {
  if (files.length === 0) return;
  await FileAsset.deleteMany({ _id: trusted({ $in: files.map((f) => f._id) }) });
  for (const file of files) {
    await removeBytes(file.provider, file.storageKey, 'Could not delete stored file');
  }
}

// Unattached submission uploads older than this are removed when the student uploads again.
const ORPHAN_SUBMISSION_FILE_MS = 60 * 60 * 1000;

/**
 * POST /assignments/:id/files: a student uploads a PDF for their own
 * submission. The caller has already checked that they may submit to
 * `assignment`. The file belongs to the student and this assignment, and is
 * attached when the submission is saved.
 */
export async function uploadSubmissionFile(student, assignment, upload) {
  if (!upload) throw ApiError.fileRejected('Choose a file to upload');
  const purpose = FILE_PURPOSES.SUBMISSION;
  const checked = await inspectUpload({
    purpose,
    buffer: upload.buffer,
    originalName: upload.originalname,
    declaredMime: upload.mimetype,
  });

  // Uploads that never made it into a submission don't pile up.
  const stale = await FileAsset.find({
    purpose,
    assignment: assignment._id,
    uploadedBy: student._id,
    createdAt: trusted({ $lt: new Date(Date.now() - ORPHAN_SUBMISSION_FILE_MS) }),
  }).select('_id');
  await deleteFilesIfUnused(stale.map((f) => f._id));

  const file = await storeFile({
    ...checked,
    buffer: upload.buffer,
    purpose,
    course: assignment.course,
    assignment: assignment._id,
    user: student,
  });
  return toFileDTO(file);
}

/** Ids among `ids` that a material, an assignment or a submission still uses. */
export async function filesInUse(ids) {
  const anyOf = () => trusted({ $in: ids });
  const [materials, attachments, submitted] = await Promise.all([
    Material.distinct('file', { file: anyOf() }),
    Assignment.distinct('attachments', { attachments: anyOf() }),
    Submission.distinct('items.file', { 'items.file': anyOf() }),
  ]);
  return new Set([...materials, ...attachments, ...submitted].map(String));
}

/** Deletes the given files, keeping any that a material, assignment or submission still uses. */
export async function deleteFilesIfUnused(fileIds) {
  const ids = fileIds.filter(Boolean);
  if (ids.length === 0) return;
  const usedIds = await filesInUse(ids);
  const unused = await FileAsset.find({
    _id: trusted({ $in: ids.filter((fileId) => !usedIds.has(String(fileId))) }),
  });
  await removeAssets(unused);
}

/** Deletes every file matching `filter` and its stored bytes. */
export async function deleteFilesWhere(filter) {
  await removeAssets(await FileAsset.find(filter));
}
