import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`));
}

function normalize(err) {
  if (err instanceof ApiError) return err;
  if (err.type === 'entity.parse.failed')
    return ApiError.badRequest('Request body is not valid JSON');
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  if (err.name === 'CastError') return ApiError.badRequest(`Invalid ${err.path}`);
  if (err.code === 11000) return ApiError.conflict('A record with these details already exists');
  return null;
}

export function errorHandler(err, req, res, _next) {
  const apiError = normalize(err);
  if (!apiError) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        ...(!config.isProduction && { details: err.message }),
      },
    });
  }
  return res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && { details: apiError.details }),
    },
  });
}
