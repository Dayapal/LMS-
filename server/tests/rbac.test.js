import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { config } from '../src/config/env.js';
import { ROLES } from '../src/models/index.js';
import { signAccessToken } from '../src/services/token.service.js';
import { createUser } from './helpers.js';

// A minimal app exercising the same middleware the real routers use.
let app;
beforeAll(() => {
  app = express();
  app.get('/admin-only', authenticate, requireRole(ROLES.ADMIN), (_req, res) =>
    res.json({ ok: 1 }),
  );
  app.get('/student-only', authenticate, requireRole(ROLES.STUDENT), (_req, res) =>
    res.json({ ok: 1 }),
  );
  app.get('/any-user', authenticate, requireRole(ROLES.ADMIN, ROLES.STUDENT), (_req, res) =>
    res.json({ ok: 1 }),
  );
  app.use(errorHandler);
});

const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('requireRole', () => {
  it('returns 401 without a token', async () => {
    expect((await get('/admin-only')).status).toBe(401);
  });

  it('lets an admin through admin routes and blocks students with 403', async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    const student = await createUser({ role: ROLES.STUDENT });

    expect((await get('/admin-only', signAccessToken(admin))).status).toBe(200);
    const denied = await get('/admin-only', signAccessToken(student));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('lets students through student routes and blocks admins', async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    const student = await createUser({ role: ROLES.STUDENT });
    expect((await get('/student-only', signAccessToken(student))).status).toBe(200);
    expect((await get('/student-only', signAccessToken(admin))).status).toBe(403);
  });

  it('accepts any of several roles', async () => {
    const student = await createUser({ role: ROLES.STUDENT });
    expect((await get('/any-user', signAccessToken(student))).status).toBe(200);
  });

  it('trusts the role in the database, not a role claim in the token', async () => {
    const student = await createUser({ role: ROLES.STUDENT });
    const tampered = jwt.sign(
      { sub: student.id, role: ROLES.ADMIN, tv: student.tokenVersion },
      config.auth.accessSecret,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    expect((await get('/admin-only', tampered)).status).toBe(403);
  });

  it('rejects tokens signed with another secret or algorithm', async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    const wrongSecret = jwt.sign({ sub: admin.id, role: 'admin', tv: 0 }, 'x'.repeat(40));
    const unsigned = jwt.sign({ sub: admin.id, role: 'admin', tv: 0 }, null, { algorithm: 'none' });
    expect((await get('/admin-only', wrongSecret)).status).toBe(401);
    expect((await get('/admin-only', unsigned)).status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    const expired = jwt.sign(
      { sub: admin.id, role: 'admin', tv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
      config.auth.accessSecret,
    );
    expect((await get('/admin-only', expired)).status).toBe(401);
  });

  it('applies role changes immediately', async () => {
    const user = await createUser({ role: ROLES.ADMIN });
    const token = signAccessToken(user);
    user.role = ROLES.STUDENT;
    await user.save();
    expect((await get('/admin-only', token)).status).toBe(403);
  });
});
