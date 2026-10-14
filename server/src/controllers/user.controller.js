import * as authService from '../services/auth.service.js';
import { setRefreshCookie } from './auth.controller.js';
import { ok } from '../utils/respond.js';

export async function updateMe(req, res) {
  const { name, bio, avatarUrl } = req.body;
  if (name !== undefined) req.user.name = name;
  if (bio !== undefined) req.user.bio = bio;
  if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl || undefined;
  await req.user.save();
  ok(res, { user: req.user.toPublicJSON() });
}

/** Changing the password signs out every other device and re-issues this one's session. */
export async function changePassword(req, res) {
  const result = await authService.changePassword(req.user._id, req.body, {
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  ok(res, { user: result.user.toPublicJSON(), accessToken: result.accessToken });
}
