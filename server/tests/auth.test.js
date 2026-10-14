import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { Session, User, ROLES } from '../src/models/index.js';
import {
  api,
  cookieAttributes,
  createUser,
  loginAs,
  ORIGIN,
  PASSWORD,
  refreshCookie,
  registerStudent,
} from './helpers.js';

let app;
beforeEach(() => {
  app = createApp();
});

const refresh = (cookie, origin = ORIGIN) => {
  const req = api(app).post('/api/v1/auth/refresh').set('Origin', origin);
  return cookie ? req.set('Cookie', cookie) : req;
};

const logout = (cookie, origin = ORIGIN) => {
  const req = api(app).post('/api/v1/auth/logout').set('Origin', origin);
  return cookie ? req.set('Cookie', cookie) : req;
};

describe('POST /auth/register', () => {
  it('creates a student, returns an access token and sets a hardened refresh cookie', async () => {
    const { res, body } = await registerStudent(app);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: body.email, role: 'student' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.data.accessToken).toBe('string');

    const attributes = cookieAttributes(res);
    expect(attributes).toContain('httponly');
    expect(attributes).toContain('path=/api/v1/auth');
    expect(attributes).toContain('samesite=lax');
    expect(attributes.some((a) => a.startsWith('domain='))).toBe(false);
  });

  it('ignores a client-supplied role and other privileged fields', async () => {
    const { res, body } = await registerStudent(app, {
      role: 'admin',
      isActive: false,
      tokenVersion: 99,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('student');
    const stored = await User.findOne({ email: body.email });
    expect(stored.role).toBe(ROLES.STUDENT);
    expect(stored.isActive).toBe(true);
    expect(stored.tokenVersion).toBe(0);
  });

  it('stores a bcrypt hash, never the password', async () => {
    const { body } = await registerStudent(app);
    const stored = await User.findOne({ email: body.email }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);
  });

  it('normalizes email case and rejects duplicates with 409', async () => {
    await registerStudent(app, { email: 'Dup@Example.com' });
    const { res } = await registerStudent(app, { email: 'dup@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['too short', { password: 'short1' }, 'password'],
    ['no digit', { password: 'lettersonly' }, 'password'],
    ['over 72 bytes', { password: 'a1'.repeat(40) }, 'password'],
    ['bad email', { email: 'not-an-email' }, 'email'],
    ['short name', { name: 'A' }, 'name'],
  ])('rejects invalid input: %s', async (_label, override, field) => {
    const { res } = await registerStudent(app, override);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and records lastLoginAt', async () => {
    const user = await createUser();
    const { res } = await loginAs(app, user);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(refreshCookie(res)).toBeDefined();
    expect((await User.findById(user.id)).lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrongPassword = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Wrong-pass1' });
    const unknown = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(unknown.body.error);
    expect(refreshCookie(wrongPassword)).toBeUndefined();
  });

  it('refuses a disabled account', async () => {
    const user = await createUser({ isActive: false });
    const { res } = await loginAs(app, user);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('treats operator objects in the body as invalid input, not queries', async () => {
    await createUser();
    const res = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('requires a bearer token', async () => {
    const res = await api(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed or forged token', async () => {
    const forged = await api(app).get('/api/v1/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    const badScheme = await api(app).get('/api/v1/auth/me').set('Authorization', 'Token abc');
    expect(forged.status).toBe(401);
    expect(badScheme.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const { token, body } = await registerStudent(app);
    const res = await api(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(body.email);
  });

  it('rejects a still-valid token once the account is disabled', async () => {
    const { token, body } = await registerStudent(app);
    await User.updateOne({ email: body.email }, { isActive: false });
    const res = await api(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh (rotation)', () => {
  it('returns 401 without a cookie', async () => {
    const res = await refresh();
    expect(res.status).toBe(401);
  });

  it('issues a new access token and rotates the refresh token', async () => {
    const { cookie, body } = await registerStudent(app);
    const res = await refresh(cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(body.email);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(res)).toBeDefined();
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('allows a reused token inside the grace window (concurrent tabs)', async () => {
    const { cookie } = await registerStudent(app);
    const [first, second] = await Promise.all([refresh(cookie), refresh(cookie)]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  describe('outside the grace window', () => {
    let grace;
    beforeEach(() => {
      grace = config.auth.refreshReuseGraceMs;
      config.auth.refreshReuseGraceMs = 0;
    });
    afterEach(() => {
      config.auth.refreshReuseGraceMs = grace;
    });

    it('treats reuse of a rotated token as theft and revokes the whole family', async () => {
      const { cookie: original } = await registerStudent(app);
      const rotated = refreshCookie(await refresh(original));

      const replay = await refresh(original);
      expect(replay.status).toBe(401);
      expect(refreshCookie(replay)).toBe('lms_rt=');

      const legitimate = await refresh(rotated);
      expect(legitimate.status).toBe(401);
    });

    it('does not affect other sessions of the same user', async () => {
      const user = await createUser();
      const laptop = await loginAs(app, user);
      const phone = await loginAs(app, user);

      await refresh(laptop.cookie);
      await refresh(laptop.cookie); // replay on the laptop family

      expect((await refresh(phone.cookie)).status).toBe(200);
    });
  });

  it('rejects an expired session', async () => {
    const { cookie } = await registerStudent(app);
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await refresh(cookie);
    expect(res.status).toBe(401);
  });

  it('rejects requests from an origin that is not allowed (CSRF)', async () => {
    const { cookie } = await registerStudent(app);
    const res = await refresh(cookie, 'https://evil.example');
    expect(res.status).toBe(403);
  });

  it('does not refresh sessions of a disabled account', async () => {
    const { cookie, body } = await registerStudent(app);
    await User.updateOne({ email: body.email }, { isActive: false });
    const res = await refresh(cookie);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session family and clears the cookie', async () => {
    const { cookie } = await registerStudent(app);
    const rotated = refreshCookie(await refresh(cookie));

    const res = await logout(rotated);
    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toBe('lms_rt=');

    // Neither the current token nor the just-rotated one (still inside grace) can revive it.
    expect((await refresh(rotated)).status).toBe(401);
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('succeeds without a cookie', async () => {
    const res = await logout();
    expect(res.status).toBe(204);
  });

  it('rejects a foreign origin', async () => {
    const res = await logout(undefined, 'https://evil.example');
    expect(res.status).toBe(403);
  });
});
