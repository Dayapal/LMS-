import bcrypt from 'bcrypt';
import { config } from '../config/env.js';
import { User, ROLES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import * as tokens from './token.service.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

// Compared against when the email is unknown so response time doesn't reveal it.
let dummyHashPromise;
const dummyHash = () =>
  (dummyHashPromise ??= bcrypt.hash('not-a-real-password-1', config.auth.bcryptRounds));

export const hashPassword = (plain) => bcrypt.hash(plain, config.auth.bcryptRounds);

async function buildAuthResult(user, meta) {
  const refreshToken = await tokens.startSession(user._id, meta);
  return { user, accessToken: tokens.signAccessToken(user), refreshToken };
}

export async function register({ name, email, password }, meta) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists');
  }
  let user;
  try {
    user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: ROLES.STUDENT,
      lastLoginAt: new Date(),
    });
  } catch (error) {
    if (error.code === 11000) throw ApiError.conflict('An account with this email already exists');
    throw error;
  }
  return buildAuthResult(user, meta);
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !matches) throw ApiError.unauthenticated(INVALID_CREDENTIALS);
  if (!user.isActive) {
    throw new ApiError(
      403,
      'ACCOUNT_DISABLED',
      'This account has been disabled. Contact your trainer.',
    );
  }
  user.lastLoginAt = new Date();
  await user.save();
  return buildAuthResult(user, meta);
}

export async function refresh(refreshToken, meta) {
  const { userId, refreshToken: nextToken } = await tokens.rotateRefreshToken(refreshToken, meta);
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    await tokens.revokeAllForUser(userId);
    throw ApiError.unauthenticated('Session expired, please sign in again');
  }
  return { user, accessToken: tokens.signAccessToken(user), refreshToken: nextToken };
}

export async function logout(refreshToken) {
  await tokens.revokeByToken(refreshToken);
}

export async function changePassword(userId, { currentPassword, newPassword }, meta) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthenticated();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.validation([
      { path: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  await tokens.revokeAllForUser(user._id);
  return buildAuthResult(user, meta);
}
