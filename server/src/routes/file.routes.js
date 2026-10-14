import { Router } from 'express';
import * as files from '../controllers/file.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { parseUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { idParams } from '../validators/content.validators.js';
import { fileQuery, uploadFileSchema } from '../validators/material.validators.js';

/**
 * Spec §10: a request without any credentials gets the same 404 as a file the
 * viewer may not see. A token that is present but expired still gets 401 from
 * `authenticate`, so the client can refresh it and retry.
 */
function anonymousIsNotFound(req, _res, next) {
  if (!req.get('authorization')) throw ApiError.notFound('File not found');
  next();
}

export function fileRoutes(limiters) {
  const router = Router();

  // Role and rate limit are checked before the body is read, so refused
  // uploads are never buffered.
  router.post(
    '/',
    authenticate,
    requireRole(ROLES.ADMIN),
    limiters.uploads,
    parseUpload,
    validate({ body: uploadFileSchema }),
    files.upload,
  );
  router.get(
    '/:id',
    anonymousIsNotFound,
    authenticate,
    validate({ params: idParams, query: fileQuery }),
    files.download,
  );
  return router;
}
