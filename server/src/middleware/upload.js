import multer from 'multer';
import { MAX_UPLOAD_BYTES, UPLOAD_RULES } from '../services/fileRules.js';
import { FILE_PURPOSES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

// Files are held in memory only long enough to be checked and handed to storage.
function createParser(maxBytes) {
  const parser = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 5,
      fieldSize: 1024,
      parts: 6,
      headerPairs: 50,
    },
  }).single('file');

  const toApiError = (error) => {
    if (!(error instanceof multer.MulterError)) {
      return ApiError.badRequest('The upload could not be read. Please try again.');
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return ApiError.fileRejected(
        `Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`,
        413,
      );
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
      return ApiError.fileRejected('Send exactly one file, in the "file" field');
    }
    return ApiError.badRequest('The upload form has too many or too large fields');
  };

  return (req, res, next) =>
    parser(req, res, (error) => next(error ? toApiError(error) : undefined));
}

/**
 * Parses a multipart body with a single `file` part. The file's type and content
 * are checked afterwards by `inspectUpload`, once the purpose is known.
 */
export const parseUpload = createParser(MAX_UPLOAD_BYTES);

/** The same for a student's submission file, which has a lower size limit. */
export const parseSubmissionUpload = createParser(UPLOAD_RULES[FILE_PURPOSES.SUBMISSION].maxBytes);
