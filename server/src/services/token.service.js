import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Session } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const JWT_ALGORITHM = 'HS256';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, tv: user.tokenVersion },
    config.auth.accessSecret,
    { algorithm: JWT_ALGORITHM, expiresIn: config.auth.accessTokenTtl },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.auth.accessSecret, { algorithms: [JWT_ALGORITHM] });
  } catch {
    throw ApiError.unauthenticated('Session expired or invalid');
  }
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueRefreshToken({ userId, family, meta }) {
  const token = crypto.randomBytes(32).toString('base64url');
  await Session.create({
    user: userId,
    family,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.auth.refreshTokenTtlMs),
    userAgent: meta.userAgent?.slice(0, 512),
    ip: meta.ip,
  });
  return token;
}

export function startSession(userId, meta) {
  return issueRefreshToken({ userId, family: crypto.randomUUID(), meta });
}

/**
 * Exchanges a refresh token for a new one in the same family.
 * Returns { userId, refreshToken } or throws 401.
 */
export async function rotateRefreshToken(token, meta) {
  if (!token) throw ApiError.unauthenticated('No active session');

  const now = new Date();
  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (!session || session.expiresAt <= now) {
    throw ApiError.unauthenticated('Session expired, please sign in again');
  }

  if (session.revokedAt) {
    const rotatedRecently =
      session.replacedAt && now - session.replacedAt < config.auth.refreshReuseGraceMs;
    // Within the grace window a reused token is a benign race (e.g. two tabs
    // refreshing at once), but only while the family is still alive: a family
    // ended by logout, theft detection or a password change must stay ended.
    // Ending a family revokes its sessions without `replacedAt`, which is what
    // is checked here. (Checking for a live session instead refused the second
    // of two simultaneous refreshes when it arrived before the first had
    // stored its replacement.)
    const familyAlive =
      rotatedRecently &&
      !(await Session.exists({
        family: session.family,
        revokedAt: mongoose.trusted({ $ne: null }),
        replacedAt: null,
      }));
    if (!familyAlive) {
      if (!rotatedRecently) await revokeFamily(session.family);
      throw ApiError.unauthenticated('Session expired, please sign in again');
    }
  } else {
    const claimed = await Session.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: now, replacedAt: now } },
    );
    if (claimed.modifiedCount === 0 && !config.auth.refreshReuseGraceMs) {
      throw ApiError.unauthenticated('Session expired, please sign in again');
    }
  }

  const refreshToken = await issueRefreshToken({
    userId: session.user,
    family: session.family,
    meta,
  });
  return { userId: session.user, refreshToken };
}

export async function revokeFamily(family) {
  await Session.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeByToken(token) {
  if (!token) return;
  const session = await Session.findOne({ tokenHash: hashToken(token) }).select('family');
  if (session) await revokeFamily(session.family);
}

export async function revokeAllForUser(userId) {
  await Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
