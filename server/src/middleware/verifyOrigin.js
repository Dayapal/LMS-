import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * CSRF guard for endpoints authenticated by the refresh cookie. Browsers send
 * `Origin` on cross-site POSTs, so a foreign origin is rejected outright.
 * Requests without `Origin` (same-origin GETs, curl, server tools) carry no
 * ambient cross-site risk because SameSite=Lax withholds the cookie anyway.
 */
export function verifyOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !config.clientOrigins.includes(origin)) {
    throw ApiError.forbidden('Request origin not allowed');
  }
  next();
}
