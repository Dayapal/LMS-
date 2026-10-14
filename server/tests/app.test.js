import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { User } from '../src/models/index.js';
import { seedAdmin } from '../src/seeds/admin.seed.js';
import { api, ORIGIN, PASSWORD, uniqueEmail } from './helpers.js';

describe('app infrastructure', () => {
  it('reports health', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/does-not-exist not found' },
    });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects bodies over 1 MB with 413', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(1_100_000) });
    expect(res.status).toBe(413);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('allows credentialed CORS only for configured origins', async () => {
    const allowed = await api().options('/api/v1/auth/login').set('Origin', ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await api().options('/api/v1/auth/login').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  const original = config.rateLimit.authMax;
  afterEach(() => {
    config.rateLimit.authMax = original;
  });

  it('limits credential endpoints per IP', async () => {
    config.rateLimit.authMax = 3;
    const app = createApp();
    const attempt = () =>
      api(app).post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'nope' });

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('seedAdmin', () => {
  it('creates the trainer once and never overwrites it', async () => {
    const email = uniqueEmail('trainer');
    const first = await seedAdmin({ name: 'Trainer', email, password: PASSWORD });
    const second = await seedAdmin({ name: 'Other', email, password: 'Different1' });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await User.countDocuments({ email })).toBe(1);
    expect((await User.findOne({ email })).name).toBe('Trainer');
    expect(first.user.role).toBe('admin');
  });

  it('refuses a weak password or missing credentials', async () => {
    await expect(
      seedAdmin({ name: 'T', email: 'a@example.com', password: 'weak' }),
    ).rejects.toThrow(/too weak/);
    await expect(seedAdmin({ name: 'T' })).rejects.toThrow(/SEED_ADMIN_EMAIL/);
  });

  it('refuses to promote an existing student', async () => {
    const email = uniqueEmail();
    await api().post('/api/v1/auth/register').send({ name: 'Student', email, password: PASSWORD });
    await expect(seedAdmin({ name: 'T', email, password: PASSWORD })).rejects.toThrow(/student/);
  });
});
