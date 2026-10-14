import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'Passw0rd!';

export const api = (app = createApp()) => request(app);

function findRefreshHeader(res) {
  return [res.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith('lms_rt='));
}

/** Returns the raw `lms_rt=<token>` pair from a response, or undefined. */
export function refreshCookie(res) {
  return findRefreshHeader(res)?.split(';')[0];
}

export function cookieAttributes(res) {
  return (
    findRefreshHeader(res)
      ?.split(';')
      .map((part) => part.trim().toLowerCase()) ?? []
  );
}

let counter = 0;
export const uniqueEmail = (prefix = 'student') => `${prefix}${++counter}@example.com`;

export async function registerStudent(app, overrides = {}) {
  const body = { name: 'Asha Student', email: uniqueEmail(), password: PASSWORD, ...overrides };
  const res = await request(app).post('/api/v1/auth/register').send(body);
  return { res, body, token: res.body.data?.accessToken, cookie: refreshCookie(res) };
}

export async function createUser({ role = ROLES.STUDENT, isActive = true, ...rest } = {}) {
  return User.create({
    name: role === ROLES.ADMIN ? 'Trainer' : 'Student',
    email: uniqueEmail(role),
    passwordHash: await hashPassword(PASSWORD),
    role,
    isActive,
    ...rest,
  });
}

export async function loginAs(app, user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: PASSWORD });
  return { res, token: res.body.data?.accessToken, cookie: refreshCookie(res) };
}
