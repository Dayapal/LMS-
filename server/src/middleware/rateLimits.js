import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';

const handler = (_req, res, _next, options) =>
  res.status(options.statusCode).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  });

const limiter = (limit) =>
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
  });

// Built per app instance so tests can configure limits before creating the app.
export function createRateLimiters() {
  return {
    general: limiter(config.rateLimit.max),
    credentials: limiter(config.rateLimit.authMax),
    refresh: limiter(config.rateLimit.refreshMax),
  };
}
