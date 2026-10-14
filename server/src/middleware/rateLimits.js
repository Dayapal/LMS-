import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';

const handler = (_req, res, _next, options) =>
  res.status(options.statusCode).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  });

const limiter = (limit, options = {}) =>
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
    ...options,
  });

// Built per app instance so tests can configure limits before creating the app.
export function createRateLimiters() {
  return {
    general: limiter(config.rateLimit.max),
    credentials: limiter(config.rateLimit.authMax),
    refresh: limiter(config.rateLimit.refreshMax),
    // Per user, so it must run after `authenticate`.
    uploads: limiter(config.rateLimit.uploadMax, {
      windowMs: config.rateLimit.uploadWindowMs,
      keyGenerator: (req) => `user:${req.user.id}`,
    }),
  };
}
