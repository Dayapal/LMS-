import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { api, cookieAttributes, createUser, loginAs, ORIGIN, refreshCookie } from './helpers.js';

/**
 * Production routing: Browser → Vercel rewrite → Render → Express. Vercel sets
 * X-Forwarded-For to the visitor's IP; each proxy after it appends the address
 * it received the request from. TRUST_PROXY is the number of those hops.
 */
const saved = {};
beforeEach(() => {
  Object.assign(saved, {
    trustProxy: config.trustProxy,
    authMax: config.rateLimit.authMax,
    proxyDiagnostics: config.proxyDiagnostics,
    cookie: { ...config.auth.cookie },
    origins: config.clientOrigins,
  });
});
afterEach(() => {
  config.trustProxy = saved.trustProxy;
  config.rateLimit.authMax = saved.authMax;
  config.proxyDiagnostics = saved.proxyDiagnostics;
  config.auth.cookie = saved.cookie;
  config.clientOrigins = saved.origins;
});

const login = (app, forwardedFor) => {
  const req = api(app)
    .post('/api/v1/auth/login')
    .send({ email: 'x@example.com', password: 'nope' });
  return forwardedFor ? req.set('X-Forwarded-For', forwardedFor) : req;
};

describe('proxy-aware rate limiting', () => {
  it('keys the limit on the visitor IP that the trusted hops report', async () => {
    config.trustProxy = 2; // Vercel's edge, then one Render proxy (an example count)
    config.rateLimit.authMax = 2;
    const app = createApp();
    // Visitor 203.0.113.7, as set by Vercel; 198.51.100.1 appended by the next proxy.
    const visitor = '203.0.113.7, 198.51.100.1';

    expect((await login(app, visitor)).status).toBe(401);
    expect((await login(app, visitor)).status).toBe(401);
    expect((await login(app, visitor)).status).toBe(429);

    // A forged leftmost entry doesn't give the same visitor a fresh allowance.
    expect((await login(app, `192.0.2.99, ${visitor}`)).status).toBe(429);
    // Another visitor has their own allowance.
    expect((await login(app, '203.0.113.8, 198.51.100.1')).status).toBe(401);
  });

  it('ignores X-Forwarded-For entirely when no proxy is trusted', async () => {
    config.trustProxy = 0;
    config.rateLimit.authMax = 1;
    const app = createApp();
    expect((await login(app, '203.0.113.7')).status).toBe(401);
    // A different claimed address is still the same socket address.
    expect((await login(app, '203.0.113.8')).status).toBe(429);
  });
});

describe('GET /health/proxy (PROXY_DIAGNOSTICS)', () => {
  it('does not exist unless switched on', async () => {
    const res = await api(createApp()).get('/api/v1/health/proxy');
    expect(res.status).toBe(404);
  });

  it('shows which TRUST_PROXY value yields the caller’s own address', async () => {
    config.proxyDiagnostics = true;
    config.trustProxy = 1;
    const res = await api(createApp())
      .get('/api/v1/health/proxy')
      .set('X-Forwarded-For', '203.0.113.7, 198.51.100.1');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toMatchObject({
      trustProxy: 1,
      ip: '198.51.100.1',
      forwardedFor: 2,
      candidates: [
        { trustProxy: 0, ip: expect.stringMatching(/127\.0\.0\.1|::1/) },
        { trustProxy: 1, ip: '198.51.100.1' },
        { trustProxy: 2, ip: '203.0.113.7' },
      ],
    });
  });
});

describe('responses through a CDN', () => {
  it('marks every API response as not storable', async () => {
    const app = createApp();
    for (const url of ['/api/v1/health', '/api/v1/auth/me', '/api/v1/no-such-route']) {
      expect((await api(app).get(url)).headers['cache-control'], url).toBe('no-store');
    }
  });
});

describe('refresh cookie in the production configuration', () => {
  it('is Secure, HttpOnly, SameSite=Lax, host-only and limited to the auth path', async () => {
    config.auth.cookie = { ...config.auth.cookie, secure: true };
    config.trustProxy = 2;
    config.clientOrigins = ['https://training-lms.vercel.app'];
    const app = createApp();
    const user = await createUser();

    const { res, cookie } = await loginAs(app, user);
    expect(res.status).toBe(200);
    const attributes = cookieAttributes(res);
    expect(attributes).toEqual(
      expect.arrayContaining(['secure', 'httponly', 'samesite=lax', 'path=/api/v1/auth']),
    );
    expect(attributes).toContain(`max-age=${7 * 24 * 60 * 60}`);
    expect(attributes.some((a) => a.startsWith('domain='))).toBe(false);

    // The rewrite keeps the browser on the Vercel origin, so that is the Origin it sends.
    const refresh = (origin, value) =>
      api(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('X-Forwarded-For', '203.0.113.7, 198.51.100.1')
        .set('Cookie', value);
    const rotated = await refresh('https://training-lms.vercel.app', cookie);
    expect(rotated.status).toBe(200);
    expect(refreshCookie(rotated)).not.toBe(cookie);
    expect((await refresh(ORIGIN, refreshCookie(rotated))).status).toBe(403);
    expect((await refresh('https://evil.example', refreshCookie(rotated))).status).toBe(403);
  });
});
