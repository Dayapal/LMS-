import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { requireOriginSecret } from '../src/middleware/proxy.js';
import { FileAsset } from '../src/models/index.js';
import { LOG_REDACT } from '../src/utils/logger.js';
import { api, ORIGIN, refreshCookie, registerStudent } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { makeAssignment } from './assignment-helpers.js';
import { attachFile, binary, PDF_MIME, samplePdf, storedFiles } from './file-helpers.js';

/**
 * Production: Browser → Vercel /api route (adds x-origin-secret from a Vercel
 * environment variable at the edge) → Render → Express. Anything that reaches
 * Render without that header, such as a request to the onrender.com URL, is
 * refused. These are example secrets, not credentials.
 */
const SECRET = 'test-origin-secret-0123456789-abcdefghijklmnopqrstuv';
const PREVIOUS = 'test-previous-origin-secret-9876543210-zyxwvutsrqpon';
const HEADER = 'x-origin-secret';
const MB = 1024 * 1024;

let app;
beforeEach(() => {
  config.originSecrets = [SECRET];
  app = createApp();
});
afterEach(() => {
  config.originSecrets = [];
  config.proxyDiagnostics = false;
});

/** As the Vercel proxy sends it. */
const viaProxy = (req) => req.set(HEADER, SECRET);

/** A PDF of about `bytes` bytes (valid header, padded body). */
const pdfOfSize = (bytes) => {
  const pdf = samplePdf();
  return Buffer.concat([pdf, Buffer.alloc(bytes - pdf.length, 0x20)]);
};

const expectRefused = (res, label) => {
  expect(res.status, label).toBe(403);
  expect(res.body, label).toEqual({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Requests must go through the application URL' },
  });
  expect(res.headers['cache-control'], label).toBe('no-store');
};

describe('direct requests (no valid x-origin-secret)', () => {
  it('are refused on every route, before authentication, validation or routing', async () => {
    const { admin, student } = await actors();
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);
    const upload = await viaProxy(api(app).post('/api/v1/files'))
      .set(bearer(admin))
      .field('purpose', 'material')
      .field('courseId', course.id)
      .attach('file', samplePdf(), { filename: 'a.pdf', contentType: PDF_MIME });
    expect(upload.status).toBe(201);
    await attachFile(modules[0].lessons[0], upload.body.data.id);
    const { cookie } = await viaProxy(api(app).post('/api/v1/auth/register'))
      .send({ name: 'Asha', email: 'asha@example.com', password: 'Passw0rd!' })
      .then((res) => ({ cookie: refreshCookie(res) }));

    const direct = [
      ['GET /courses', api(app).get('/api/v1/courses').set(bearer(student))],
      ['GET /auth/me', api(app).get('/api/v1/auth/me').set(bearer(student))],
      [
        'POST /auth/login',
        api(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Passw0rd!' }),
      ],
      [
        'POST /auth/register',
        api(app)
          .post('/api/v1/auth/register')
          .send({ name: 'B', email: 'b@example.com', password: 'Passw0rd!' }),
      ],
      [
        'POST /auth/refresh with a valid cookie',
        api(app).post('/api/v1/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie),
      ],
      [
        'GET /files/:id with a valid token',
        api(app).get(`/api/v1/files/${upload.body.data.id}`).set(bearer(student)),
      ],
      [
        'GET /admin/students as the trainer',
        api(app).get('/api/v1/admin/students').set(bearer(admin)),
      ],
      ['an unknown API route', api(app).get('/api/v1/no-such-route')],
      ['outside the API', api(app).get('/')],
      ['a CORS preflight', api(app).options('/api/v1/courses').set('Origin', ORIGIN)],
    ];
    for (const [label, request] of direct) expectRefused(await request, label);

    // The refused refresh didn't consume the token: through the proxy it still rotates.
    const viaVercel = await viaProxy(api(app).post('/api/v1/auth/refresh'))
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
    expect(viaVercel.status).toBe(200);
  });

  it('are refused for a wrong, partial, extended, re-cased, repeated or empty secret', async () => {
    for (const value of [
      'wrong',
      SECRET.slice(0, -1),
      `${SECRET}x`,
      SECRET.toUpperCase(),
      `${SECRET},${SECRET}`,
      '',
    ]) {
      expectRefused(
        await api(app).get('/api/v1/courses').set(HEADER, value),
        JSON.stringify(value),
      );
    }
  });

  it('are checked before CORS, body parsing and every route', () => {
    const names = app.router.stack.map((layer) => layer.name);
    const at = (name) => names.indexOf(name);
    expect(at('requireOriginSecret')).toBeGreaterThan(-1);
    for (const later of [
      'corsMiddleware',
      'jsonParser',
      'urlencodedParser',
      'cookieParser',
      'router',
    ]) {
      expect(at('requireOriginSecret'), later).toBeLessThan(at(later));
    }
  });

  it('are refused before an upload body is read', async () => {
    const { admin } = await actors();
    const { course } = await makeCourse();
    // Over the 20 MB limit: through the proxy this would be a 413 after parsing.
    const res = await api(app)
      .post('/api/v1/files')
      .set(bearer(admin))
      .field('purpose', 'material')
      .field('courseId', course.id)
      .attach('file', pdfOfSize(21 * MB), { filename: 'big.pdf', contentType: PDF_MIME })
      .catch((error) => error.response ?? { status: 'connection closed' });
    // The server answers 403 and closes the connection without reading the body;
    // depending on timing the client sees the 403 or a closed connection.
    expect([403, 'connection closed']).toContain(res.status);
    expect(await FileAsset.countDocuments()).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it('leave only the health check open (Render calls it directly)', async () => {
    const health = await api(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data).toEqual({ status: 'ok', db: 'up' });

    config.proxyDiagnostics = true;
    const withDiagnostics = createApp();
    expectRefused(await api(withDiagnostics).get('/api/v1/health/proxy'), 'diagnostics direct');
    expect((await viaProxy(api(withDiagnostics).get('/api/v1/health/proxy'))).status).toBe(200);
  });
});

describe('requests through the proxy', () => {
  it('sign in, refresh, read and sign out exactly as before', async () => {
    const register = await viaProxy(api(app).post('/api/v1/auth/register')).send({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'Passw0rd!',
    });
    expect(register.status).toBe(201);
    const cookie = refreshCookie(register);

    const refreshed = await viaProxy(api(app).post('/api/v1/auth/refresh'))
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
    expect(refreshed.status).toBe(200);
    const token = refreshed.body.data.accessToken;

    const me = await viaProxy(api(app).get('/api/v1/auth/me')).set(
      'Authorization',
      `Bearer ${token}`,
    );
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('asha@example.com');

    // The CSRF origin check still applies behind the proxy.
    const foreign = await viaProxy(api(app).post('/api/v1/auth/refresh'))
      .set('Origin', 'https://evil.example')
      .set('Cookie', refreshCookie(refreshed));
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.message).toBe('Request origin not allowed');

    const out = await viaProxy(api(app).post('/api/v1/auth/logout'))
      .set('Origin', ORIGIN)
      .set('Cookie', refreshCookie(refreshed));
    expect(out.status).toBe(204);
  });

  it('carry a trainer file just under 20 MB and a student PDF just under 10 MB both ways', async () => {
    const { admin, student, otherStudent } = await actors();
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);

    const handout = pdfOfSize(20 * MB - 1024);
    const trainerUpload = await viaProxy(api(app).post('/api/v1/files'))
      .set(bearer(admin))
      .field('purpose', 'material')
      .field('courseId', course.id)
      .attach('file', handout, { filename: 'handout.pdf', contentType: PDF_MIME });
    expect(trainerUpload.status).toBe(201);
    await attachFile(modules[0].lessons[0], trainerUpload.body.data.id);
    const read = await viaProxy(api(app).get(`/api/v1/files/${trainerUpload.body.data.id}`))
      .set(bearer(student))
      .buffer(true)
      .parse(binary);
    expect(read.status).toBe(200);
    expect(read.body.length).toBe(handout.length);

    const assignment = await makeAssignment(course);
    const answers = pdfOfSize(10 * MB - 1024);
    const studentUpload = await viaProxy(
      api(app).post(`/api/v1/assignments/${assignment.id}/files`),
    )
      .set(bearer(student))
      .attach('file', answers, { filename: 'answers.pdf', contentType: PDF_MIME });
    expect(studentUpload.status).toBe(201);
    const own = await viaProxy(api(app).get(`/api/v1/files/${studentUpload.body.data.id}`))
      .set(bearer(student))
      .buffer(true)
      .parse(binary);
    expect(own.body.length).toBe(answers.length);
    // The usual access rules still apply behind the proxy.
    const other = await viaProxy(api(app).get(`/api/v1/files/${studentUpload.body.data.id}`)).set(
      bearer(otherStudent),
    );
    expect(other.status).toBe(404);
  });

  it('accept the previous secret during a rotation, and only the two configured', async () => {
    config.originSecrets = [SECRET, PREVIOUS];
    const rotating = createApp();
    for (const value of [SECRET, PREVIOUS]) {
      const res = await api(rotating).get('/api/v1/auth/me').set(HEADER, value);
      expect(res.status).toBe(401); // past the origin check, at authentication
    }
    expectRefused(
      await api(rotating).get('/api/v1/auth/me').set(HEADER, 'something-else'),
      'other',
    );
  });
});

describe('the secret stays on the server', () => {
  it('is never in a response, refused or served', async () => {
    const { student } = await registerStudent(app).then(async ({ res }) => ({ student: res }));
    const responses = [
      await api(app).get('/api/v1/courses'),
      await viaProxy(api(app).get('/api/v1/health')),
      await viaProxy(api(app).get('/api/v1/courses')),
      student,
    ];
    for (const res of responses) {
      const text = JSON.stringify({ headers: res.headers, body: res.body });
      expect(text).not.toContain(SECRET);
    }
  });

  it('is redacted from the request logs', async () => {
    const lines = [];
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logged = express();
    logged.use(pinoHttp({ logger: pino({ redact: LOG_REDACT }, sink) }));
    logged.use(requireOriginSecret);
    logged.get('/api/v1/x', (_req, res) => res.json({ ok: true }));
    logged.use((err, _req, res, _next) => res.status(err.status ?? 500).end());

    expect((await api(logged).get('/api/v1/x').set(HEADER, SECRET)).status).toBe(200);
    expect((await api(logged).get('/api/v1/x').set(HEADER, `${SECRET}-guess`)).status).toBe(403);
    const output = lines.join('\n');
    expect(lines.length).toBe(2);
    expect(output).not.toContain(SECRET);
    expect(output).toContain('"x-origin-secret":"[Redacted]"');
  });
});
