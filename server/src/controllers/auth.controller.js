import { config } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { ok, created, noContent } from '../utils/respond.js';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.auth.cookie.secure,
  sameSite: config.auth.cookie.sameSite,
  path: config.auth.cookie.path,
});

const requestMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

export function setRefreshCookie(res, token) {
  res.cookie(config.auth.cookie.name, token, {
    ...cookieOptions(),
    maxAge: config.auth.refreshTokenTtlMs,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(config.auth.cookie.name, cookieOptions());
}

const readRefreshCookie = (req) => req.cookies?.[config.auth.cookie.name];

function sendSession(res, { user, accessToken, refreshToken }, status = 200) {
  setRefreshCookie(res, refreshToken);
  const data = { user: user.toPublicJSON(), accessToken };
  return status === 201 ? created(res, data) : ok(res, data);
}

export async function register(req, res) {
  sendSession(res, await authService.register(req.body, requestMeta(req)), 201);
}

export async function login(req, res) {
  sendSession(res, await authService.login(req.body, requestMeta(req)));
}

export async function refresh(req, res) {
  try {
    sendSession(res, await authService.refresh(readRefreshCookie(req), requestMeta(req)));
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req, res) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  noContent(res);
}

export function me(req, res) {
  ok(res, { user: req.user.toPublicJSON() });
}
