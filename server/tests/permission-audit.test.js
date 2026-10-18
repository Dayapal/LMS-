import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Notification } from '../src/models/index.js';
import { api, ORIGIN } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { makeAssignment, makeSubmission, uploadSubmissionFile } from './assignment-helpers.js';

/**
 * Spec §10 (Phase 7): every endpoint × role. Each row says what an anonymous
 * caller, a student and the trainer get when they call the endpoint with ids
 * that don't exist and an empty body:
 * - 'pass': the role check lets them through (the answer is then 400 or 404,
 *   or 2xx, but never 401 or 403);
 * - a number: exactly that status.
 * The route list is read from the route files, so a new endpoint without a
 * row here fails the suite.
 */
const ANY = { anon: 401, student: 'pass', admin: 'pass' };
const ADMIN = { anon: 401, student: 403, admin: 'pass' };
const STUDENT = { anon: 401, student: 'pass', admin: 403 };
const PUBLIC = { anon: 'pass', student: 'pass', admin: 'pass' };

const MATRIX = {
  'GET /api/v1/health': PUBLIC,
  // Exists only while PROXY_DIAGNOSTICS=true (a 404 here); see proxy.test.js.
  'GET /api/v1/health/proxy': PUBLIC,

  'POST /api/v1/auth/register': PUBLIC,
  'POST /api/v1/auth/login': PUBLIC,
  // Cookie endpoints: without a refresh cookie there is nothing to refresh.
  'POST /api/v1/auth/refresh': { anon: 401, student: 401, admin: 401 },
  'POST /api/v1/auth/logout': PUBLIC,
  'GET /api/v1/auth/me': ANY,

  'PATCH /api/v1/users/me': ANY,
  'PATCH /api/v1/users/me/password': ANY,

  'GET /api/v1/courses': ANY,
  'POST /api/v1/courses': ADMIN,
  'GET /api/v1/courses/:id': ANY,
  'PATCH /api/v1/courses/:id': ADMIN,
  'DELETE /api/v1/courses/:id': ADMIN,
  'PATCH /api/v1/courses/:id/status': ADMIN,
  'GET /api/v1/courses/:id/roadmap': ANY,
  'GET /api/v1/courses/:id/modules': ANY,
  'POST /api/v1/courses/:id/modules': ADMIN,
  'PATCH /api/v1/courses/:id/modules/reorder': ADMIN,
  'POST /api/v1/courses/:id/enroll': STUDENT,

  'PATCH /api/v1/modules/:id': ADMIN,
  'DELETE /api/v1/modules/:id': ADMIN,
  'GET /api/v1/modules/:id/lessons': ANY,
  'POST /api/v1/modules/:id/lessons': ADMIN,
  'PATCH /api/v1/modules/:id/lessons/reorder': ADMIN,

  'GET /api/v1/lessons/:id': ANY,
  'PATCH /api/v1/lessons/:id': ADMIN,
  'DELETE /api/v1/lessons/:id': ADMIN,
  'GET /api/v1/lessons/:id/navigation': ANY,
  'POST /api/v1/lessons/:id/visit': STUDENT,
  'POST /api/v1/lessons/:id/complete': STUDENT,
  'DELETE /api/v1/lessons/:id/complete': STUDENT,
  'GET /api/v1/lessons/:id/materials': ANY,
  'POST /api/v1/lessons/:id/materials': ADMIN,
  'PATCH /api/v1/lessons/:id/materials/reorder': ADMIN,

  'PATCH /api/v1/materials/:id': ADMIN,
  'DELETE /api/v1/materials/:id': ADMIN,

  'POST /api/v1/files': ADMIN,
  // Without any credentials a file is "not found", like a file the viewer can't see.
  'GET /api/v1/files/:id': { anon: 404, student: 'pass', admin: 'pass' },

  'GET /api/v1/assignments': ANY,
  'POST /api/v1/assignments': ADMIN,
  'GET /api/v1/assignments/:id': ANY,
  'PATCH /api/v1/assignments/:id': ADMIN,
  'DELETE /api/v1/assignments/:id': ADMIN,
  'GET /api/v1/assignments/:id/submissions': ADMIN,
  'GET /api/v1/assignments/:id/submissions/me': STUDENT,
  'POST /api/v1/assignments/:id/submissions': STUDENT,
  'POST /api/v1/assignments/:id/files': STUDENT,

  'GET /api/v1/submissions/:id': ANY,
  'PATCH /api/v1/submissions/:id': STUDENT,
  'POST /api/v1/submissions/:id/review': ADMIN,
  'POST /api/v1/submissions/:id/request-resubmission': ADMIN,

  'GET /api/v1/admin/enrollments': ADMIN,
  'POST /api/v1/admin/enrollments': ADMIN,
  'PATCH /api/v1/admin/enrollments/:id': ADMIN,
  'GET /api/v1/admin/submissions': ADMIN,
  'GET /api/v1/admin/students': ADMIN,
  'GET /api/v1/admin/students/:id': ADMIN,

  'GET /api/v1/me/courses': STUDENT,
  'GET /api/v1/me/assignments': STUDENT,
  'GET /api/v1/dashboard/student': STUDENT,
  'GET /api/v1/dashboard/admin': ADMIN,

  'GET /api/v1/reports/courses': ADMIN,
  'GET /api/v1/reports/courses/:id': ADMIN,
  'GET /api/v1/reports/students/:id': ADMIN,

  'GET /api/v1/notifications': ANY,
  'GET /api/v1/notifications/unread-count': ANY,
  'PATCH /api/v1/notifications/read-all': ANY,
  'PATCH /api/v1/notifications/:id/read': ANY,

  'GET /api/v1/study-materials/admin/catalogue': ADMIN,
  'PATCH /api/v1/study-materials/admin/books/:id': ADMIN,
  'PATCH /api/v1/study-materials/admin/modules/:id': ADMIN,
  'GET /api/v1/study-materials/admin/modules/:id/preview': ADMIN,
  'GET /api/v1/study-materials/admin/access': ADMIN,
  'GET /api/v1/study-materials/admin/access/:id': ADMIN,
  'PUT /api/v1/study-materials/admin/access/:id': ADMIN,
  'POST /api/v1/study-materials/admin/access/bulk': ADMIN,
  'GET /api/v1/study-materials': ANY,
  'GET /api/v1/study-materials/summary': ANY,
  'GET /api/v1/study-materials/:bookSlug': ANY,
  'GET /api/v1/study-materials/:bookSlug/modules/:moduleSlug/content': ANY,
  'POST /api/v1/study-materials/:bookSlug/modules/:moduleSlug/heartbeat': ANY,
  'POST /api/v1/study-materials/:bookSlug/modules/:moduleSlug/complete': ANY,
  'DELETE /api/v1/study-materials/:bookSlug/modules/:moduleSlug/complete': ANY,
};

const ROUTES_DIR = fileURLToPath(new URL('../src/routes/', import.meta.url));

/** Every `METHOD /api/v1/...` declared in the route files. */
function declaredRoutes() {
  const index = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
  const mounts = Object.fromEntries(
    [...index.matchAll(/router\.use\('([^']+)', (\w+)\(/g)].map(([, mount, fn]) => [fn, mount]),
  );
  const routes = [...index.matchAll(/router\.(get|post|patch|put|delete)\('([^']+)'/g)].map(
    ([, method, route]) => `${method.toUpperCase()} /api/v1${route}`,
  );

  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f !== 'index.js')) {
    const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    const factories = source.split(/export function (\w+)\(/).slice(1);
    for (let i = 0; i < factories.length; i += 2) {
      const mount = mounts[factories[i]];
      expect(mount, `${factories[i]} in ${file} is not mounted in routes/index.js`).toBeDefined();
      for (const [, method, route] of factories[i + 1].matchAll(
        /router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g,
      )) {
        routes.push(`${method.toUpperCase()} /api/v1${mount}${route === '/' ? '' : route}`);
      }
    }
  }
  return routes;
}

let app;
let users;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  users = await actors();
});

function call(key, user) {
  const [method, route] = key.split(' ');
  const url = route.replaceAll(':id', new mongoose.Types.ObjectId().toString());
  const req = api(app)[method.toLowerCase()](url).set('Origin', ORIGIN);
  return user ? req.set(bearer(user)) : req;
}

function expectOutcome(res, expected, label) {
  const message = `${label} → ${res.status} ${JSON.stringify(res.body?.error ?? '')}`;
  expect(res.status, message).toBeLessThan(500);
  if (expected === 'pass') expect([401, 403], message).not.toContain(res.status);
  else expect(res.status, message).toBe(expected);
}

describe('permission audit: every endpoint × role', () => {
  it('has a row for every declared endpoint, and no row for one that is gone', () => {
    const declared = declaredRoutes().sort();
    expect(new Set(declared).size, 'an endpoint is declared twice').toBe(declared.length);
    expect(declared).toEqual(Object.keys(MATRIX).sort());
  });

  it.each(Object.entries(MATRIX))('%s', async (key, expected) => {
    expectOutcome(await call(key), expected.anon, `${key} anonymous`);
    expectOutcome(await call(key, users.student), expected.student, `${key} as student`);
    expectOutcome(await call(key, users.admin), expected.admin, `${key} as trainer`);
  });

  it('treats a deactivated account like no account', async () => {
    users.student.isActive = false;
    await users.student.save();
    for (const key of ['GET /api/v1/auth/me', 'GET /api/v1/notifications/unread-count']) {
      expect((await call(key, users.student)).status).toBe(401);
    }
  });
});

describe('permission audit: one student never reaches another student’s data', () => {
  it('answers 404 for another student’s submission, its PDF and their notifications', async () => {
    const { student, otherStudent } = users;
    const { course } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    const assignment = await makeAssignment(course);
    const upload = await uploadSubmissionFile(app, student, assignment);
    expect(upload.status).toBe(201);
    const submission = await makeSubmission(assignment, student, {
      items: [{ type: 'pdf', file: upload.body.data.id }],
    });
    const notification = await Notification.create({
      user: student._id,
      type: 'submission_reviewed',
      key: 'k',
      title: 'Yours',
    });

    const as = (method, url) => api(app)[method](url).set(bearer(otherStudent));
    expect((await as('get', `/api/v1/submissions/${submission.id}`)).status).toBe(404);
    expect(
      (await as('patch', `/api/v1/submissions/${submission.id}`).send({ note: 'x' })).status,
    ).toBe(404);
    expect((await as('get', `/api/v1/files/${upload.body.data.id}`)).status).toBe(404);
    expect((await as('patch', `/api/v1/notifications/${notification.id}/read`)).status).toBe(404);

    const mine = await as('get', `/api/v1/assignments/${assignment.id}/submissions/me`);
    expect(mine.body.data).toEqual([]);
    expect((await as('get', '/api/v1/notifications')).body.data).toEqual([]);
  });
});

describe('page numbers on every list', () => {
  it.each([
    ['/api/v1/courses', 'student'],
    ['/api/v1/assignments', 'student'],
    ['/api/v1/me/assignments', 'student'],
    ['/api/v1/notifications', 'student'],
    ['/api/v1/admin/enrollments', 'admin'],
    ['/api/v1/admin/submissions', 'admin'],
    ['/api/v1/admin/students', 'admin'],
    ['/api/v1/reports/courses', 'admin'],
  ])('%s refuses a page past 10,000 with a 400, not a 500', async (url, role) => {
    for (const page of ['10001', '1e15']) {
      const res = await api(app).get(url).query({ page }).set(bearer(users[role]));
      expect(res.status, `page=${page}`).toBe(400);
    }
    const last = await api(app).get(url).query({ page: 10_000 }).set(bearer(users[role]));
    expect(last.status).toBe(200);
  });
});
