import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../services/fileRules.js';
import { ApiError } from '../utils/ApiError.js';

// Files are held in memory only long enough to be checked and handed to storage.
const parser = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 5,
    fieldSize: 1024,
    parts: 6,
    headerPairs: 50,
  },
}).single('file');

function toApiError(error) {
  if (!(error instanceof multer.MulterError)) {
    return ApiError.badRequest('The upload could not be read. Please try again.');
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return ApiError.fileRejected(
      `Files must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller`,
      413,
    );
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
    return ApiError.fileRejected('Send exactly one file, in the "file" field');
  }
  return ApiError.badRequest('The upload form has too many or too large fields');
}

/**
 * Parses a multipart body with a single `file` part. The file's type and content
 * are checked afterwards by `inspectUpload`, once the purpose is known.
 */
export function parseUpload(req, res, next) {
  parser(req, res, (error) => next(error ? toApiError(error) : undefined));
}
