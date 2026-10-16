import { fileTypeFromBuffer } from 'file-type';
import { FILE_PURPOSES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const MB = 1024 * 1024;

const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** What each upload purpose accepts (spec §8). Later phases add their purposes here. */
export const UPLOAD_RULES = {
  [FILE_PURPOSES.MATERIAL]: { maxBytes: 20 * MB, extensions: ['pdf', 'docx', 'pptx'] },
  // Trainer handouts attached to an assignment: the same rules as study materials.
  [FILE_PURPOSES.ASSIGNMENT]: { maxBytes: 20 * MB, extensions: ['pdf', 'docx', 'pptx'] },
  // Student work.
  [FILE_PURPOSES.SUBMISSION]: { maxBytes: 10 * MB, extensions: ['pdf'] },
};

/** The largest file any purpose accepts: the parser's hard limit. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(UPLOAD_RULES).map((r) => r.maxBytes));

const formatMb = (bytes) => `${Math.round(bytes / MB)} MB`;

const extensionOf = (name) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * The client's file name, kept only as display metadata: no path, no control or
 * reserved characters, at most 200 characters with the extension preserved.
 */
export function cleanFileName(raw) {
  const base = String(raw ?? '')
    .split(/[\\/]/)
    .pop()
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '')
    .trim();
  if (base.length <= 200) return base;
  const ext = extensionOf(base);
  return `${base.slice(0, 200 - ext.length - 1)}.${ext}`;
}

/**
 * Checks an upload against its purpose's rules. The extension, the MIME type
 * the browser declared and the type detected from the file's magic bytes must
 * all agree. Returns the normalized extension, MIME type and display name.
 */
export async function inspectUpload({ purpose, buffer, originalName, declaredMime }) {
  const rules = UPLOAD_RULES[purpose];
  if (!rules) throw ApiError.fileRejected('This kind of upload is not supported');

  const name = cleanFileName(originalName);
  const allowed = rules.extensions.map((e) => e.toUpperCase()).join(', ');
  if (!buffer?.length) throw ApiError.fileRejected('The file is empty');
  if (buffer.length > rules.maxBytes) {
    throw ApiError.fileRejected(`Files must be ${formatMb(rules.maxBytes)} or smaller`, 413);
  }

  const ext = extensionOf(name);
  if (!rules.extensions.includes(ext)) {
    throw ApiError.fileRejected(`Only ${allowed} files are allowed`);
  }
  const mimeType = MIME_BY_EXTENSION[ext];
  if (declaredMime !== mimeType) {
    throw ApiError.fileRejected(`The file type does not match its .${ext} extension`);
  }
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || detected.ext !== ext || detected.mime !== mimeType) {
    throw ApiError.fileRejected(`The file content is not a valid .${ext} file`);
  }
  return { ext, mimeType, originalName: name };
}
