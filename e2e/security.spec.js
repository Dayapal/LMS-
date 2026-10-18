import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as playwrightRequest } from '@playwright/test';
import { apiAs, expect, newStudent, test } from './support/fixtures.js';
import { API_DIRECT_URL, BASE_URL, ORIGIN_SECRET, TRAINER } from './support/env.js';
import { makePdf } from './support/pdf.js';

const MB = 1024 * 1024;
/** A valid PDF padded to about `bytes` bytes. */
const pdfOfSize = (bytes) => {
  const pdf = makePdf('Large file');
  return Buffer.concat([pdf, Buffer.alloc(bytes - pdf.length, 0x20)]);
};

// API-level checks through the production routing (preview proxy = Vercel
// rewrite) against the API in production mode with S3 storage.
test.describe.configure({ mode: 'serial' });

test('student PDFs are private to their owner and the trainer', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'chromium', 'API-level: the browser engine is irrelevant');
  const trainer = await apiAs(TRAINER);
  const owner = await apiAs(newStudent(testInfo, 'owner'));
  const other = await apiAs(newStudent(testInfo, 'other'));
  const anonymous = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });

  const dsa = (await trainer.get('/courses?limit=100')).body.data.find(
    (c) => c.slug === 'dsa-with-javascript',
  );
  for (const student of [owner, other]) {
    expect(
      (await trainer.post('/admin/enrollments', { courseId: dsa.id, email: student.user.email }))
        .status,
    ).toBe(201);
  }
  const assignments = (await owner.get(`/assignments?course=${dsa.id}`)).body.data;
  const worksheet = assignments.find((a) => a.title === 'Big-O Analysis Worksheet');

  const pdf = makePdf('Private answers');
  const uploaded = await owner.upload(`/assignments/${worksheet.id}/files`, {
    name: 'answers.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });
  expect(uploaded.status).toBe(201);
  expect(uploaded.body.data).not.toHaveProperty('storageKey');
  const fileUrl = `/files/${uploaded.body.data.id}`;

  const mine = await owner.get(fileUrl);
  expect(mine.status).toBe(200);
  expect(Buffer.compare(mine.body, pdf)).toBe(0);
  expect(mine.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
  expect(mine.headers['x-content-type-options']).toBe('nosniff');
  expect((await trainer.get(fileUrl)).status).toBe(200);
  const denied = await other.get(fileUrl);
  expect(denied.status).toBe(404);
  expect((await anonymous.get(`/api/v1${fileUrl}`)).status()).toBe(404);

  // A spoofed "PDF" is refused and never stored.
  const spoofed = await owner.upload(`/assignments/${worksheet.id}/files`, {
    name: 'answers.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('<html><script>alert(1)</script></html>'),
  });
  expect(spoofed.status).toBe(400);
  expect(spoofed.body.error.code).toBe('FILE_REJECTED');

  // Students can't use the trainer's upload endpoint at all.
  const trainerOnly = await owner.upload(
    '/files',
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf },
    {
      purpose: 'material',
      courseId: dsa.id,
    },
  );
  expect(trainerOnly.status).toBe(403);

  await Promise.all([trainer.dispose(), owner.dispose(), other.dispose(), anonymous.dispose()]);
});

test('cookie endpoints refuse foreign origins, and every API response is uncacheable', async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'API-level: the browser engine is irrelevant');
  const refresh = await request.post('/api/v1/auth/refresh', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(refresh.status()).toBe(403);
  const logout = await request.post('/api/v1/auth/logout', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(logout.status()).toBe(403);

  for (const url of ['/api/v1/health', '/api/v1/auth/me', '/api/v1/courses', '/api/v1/nope']) {
    const res = await request.get(url);
    expect(res.headers()['cache-control'], url).toBe('no-store');
    expect(res.headers()['x-powered-by'], url).toBeUndefined();
  }
  const missing = await request.get('/api/v1/nope');
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
});

test('the app is served with the production security headers', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Headers: the browser engine is irrelevant');
  for (const path of ['/', '/login', '/app/courses']) {
    const headers = (await request.get(path)).headers();
    expect(headers['content-security-policy'], path).toContain("script-src 'self'");
    expect(headers['content-security-policy'], path).toContain("frame-ancestors 'self'");
    expect(headers['content-security-policy'], path).not.toContain('unsafe-eval');
    expect(headers['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
  }
});

test('the API refuses direct requests; the same requests through the proxy work', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'chromium', 'API-level: the browser engine is irrelevant');
  // Through the proxy (the Vercel route's stand-in): sign in and keep the cookie.
  const proxied = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });
  const login = await proxied.post('/api/v1/auth/login', { data: TRAINER });
  expect(login.status()).toBe(200);
  const token = (await login.json()).data.accessToken;
  const cookie = login.headers()['set-cookie'].split(';')[0];
  const bearer = { Authorization: `Bearer ${token}` };
  expect((await proxied.get('/api/v1/courses', { headers: bearer })).status()).toBe(200);

  // Straight to the API's own address (the onrender.com URL in production).
  const direct = await playwrightRequest.newContext({ baseURL: API_DIRECT_URL });
  const refused = [
    ['GET /courses with a valid token', direct.get('/api/v1/courses', { headers: bearer })],
    ['POST /auth/login', direct.post('/api/v1/auth/login', { data: TRAINER })],
    [
      'POST /auth/refresh with the real cookie',
      direct.post('/api/v1/auth/refresh', { headers: { Origin: BASE_URL, Cookie: cookie } }),
    ],
    [
      'a guessed secret',
      direct.get('/api/v1/courses', {
        headers: { ...bearer, 'x-origin-secret': 'guess-1234567890' },
      }),
    ],
    ['an unknown route', direct.get('/api/v1/no-such-route')],
  ];
  for (const [label, pending] of refused) {
    const res = await pending;
    expect(res.status(), label).toBe(403);
    expect(await res.json(), label).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(await res.text(), label).not.toContain(ORIGIN_SECRET);
  }
  // Only the health check answers directly (Render's health checks need it).
  expect((await direct.get('/api/v1/health')).status()).toBe(200);

  // The refused refresh didn't use up the cookie: through the proxy it still rotates.
  const refreshed = await proxied.post('/api/v1/auth/refresh', { headers: { Origin: BASE_URL } });
  expect(refreshed.status()).toBe(200);

  // A visitor can't supply the header: the proxy replaces it with its own.
  const forged = await proxied.get('/api/v1/courses', {
    headers: { ...bearer, 'x-origin-secret': 'visitor-supplied-value-000000000000' },
  });
  expect(forged.status()).toBe(200);

  await Promise.all([proxied.dispose(), direct.dispose()]);
});

test('uploads of the supported sizes pass through the proxy (20 MB trainer, 10 MB student)', async () => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'chromium', 'API-level: the browser engine is irrelevant');
  test.setTimeout(120_000);
  const trainer = await apiAs(TRAINER);
  const student = await apiAs(newStudent(testInfo, 'large'));
  const dsa = (await trainer.get('/courses?limit=100')).body.data.find(
    (c) => c.slug === 'dsa-with-javascript',
  );
  await trainer.post('/admin/enrollments', { courseId: dsa.id, email: student.user.email });
  const worksheet = (await student.get(`/assignments?course=${dsa.id}`)).body.data.find(
    (a) => a.title === 'Big-O Analysis Worksheet',
  );

  const handout = pdfOfSize(20 * MB - 1024);
  const material = await trainer.upload(
    '/files',
    { name: 'handout.pdf', mimeType: 'application/pdf', buffer: handout },
    { purpose: 'material', courseId: dsa.id },
  );
  expect(material.status).toBe(201);
  expect(material.body.data.size).toBe(handout.length);

  const answers = pdfOfSize(10 * MB - 1024);
  const submission = await student.upload(`/assignments/${worksheet.id}/files`, {
    name: 'answers.pdf',
    mimeType: 'application/pdf',
    buffer: answers,
  });
  expect(submission.status).toBe(201);
  const back = await student.get(`/files/${submission.body.data.id}`);
  expect(back.status).toBe(200);
  expect(back.body.length).toBe(answers.length);

  await Promise.all([trainer.dispose(), student.dispose()]);
});

test('the proxy secret is in no file or response the browser can load', async ({ request }) => {
  const testInfo = test.info();
  test.skip(testInfo.project.name !== 'chromium', 'Build output: the browser engine is irrelevant');
  // Every file of the build being served (client/dist), lazy chunks included.
  const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
  expect(files.length).toBeGreaterThan(10);
  for (const file of files) {
    expect(readFileSync(file).includes(ORIGIN_SECRET), file).toBe(false);
  }
  // And what the server sends: the page, a script, API responses.
  const index = await request.get('/');
  const script = (await index.text()).match(/src="(\/assets\/[^"]+\.js)"/)[1];
  for (const res of [index, await request.get(script), await request.get('/api/v1/courses')]) {
    expect(await res.text()).not.toContain(ORIGIN_SECRET);
    expect(JSON.stringify(res.headers())).not.toContain(ORIGIN_SECRET);
  }
});
