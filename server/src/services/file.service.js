import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Course, FileAsset, Material } from '../models/index.js';
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
export async function storeFile({ buffer, ext, mimeType, originalName, purpose, course, user }) {
  const storage = getStorage();
  const storageKey = `${purpose}/${crypto.randomUUID()}.${ext}`;
  await storage.put(storageKey, buffer);
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
      uploadedBy: user._id,
    });
  } catch (error) {
    await storage.remove(storageKey);
    throw error;
  }
}

/** POST /files: a trainer uploads a study material for one course. */
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
  const storage = getStorage(file.provider);
  const size = await storage.size(file.storageKey);
  if (size === null) {
    logger.warn({ fileId: file.id, storageKey: file.storageKey }, 'Stored file is missing');
    throw ApiError.notFound('File not found');
  }
  return {
    file,
    size,
    attachment: Boolean(download) && downloadable,
    stream: () => storage.createReadStream(file.storageKey),
  };
}

async function removeAssets(files) {
  for (const file of files) await getStorage(file.provider).remove(file.storageKey);
  await FileAsset.deleteMany({ _id: trusted({ $in: files.map((f) => f._id) }) });
}

/** Deletes the given files, keeping any that a material still uses. */
export async function deleteFilesIfUnused(fileIds) {
  const ids = fileIds.filter(Boolean);
  if (ids.length === 0) return;
  const used = await Material.distinct('file', { file: trusted({ $in: ids }) });
  const usedIds = new Set(used.map(String));
  const unused = await FileAsset.find({
    _id: trusted({ $in: ids.filter((fileId) => !usedIds.has(String(fileId))) }),
  });
  await removeAssets(unused);
}

/** Deletes every file matching `filter` and its stored bytes. */
export async function deleteFilesWhere(filter) {
  await removeAssets(await FileAsset.find(filter));
}
