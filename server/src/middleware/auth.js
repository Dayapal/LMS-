import { User } from '../models/index.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Requires a valid bearer access token. The user is re-loaded on every request
 * so deactivation, role changes and password changes apply immediately.
 */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthenticated();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthenticated('Session expired or invalid');
  }
  req.user = user;
  next();
}

/** Must run after `authenticate`. Uses the role stored in the database, not the token. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw ApiError.unauthenticated();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
