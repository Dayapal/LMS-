import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { FileAsset } from '../src/models/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import {
  attachFile,
  binary,
  DOCX_MIME,
  PDF_MIME,
  PPTX_MIME,
  sampleDocx,
  samplePdf,
  samplePptx,
  storedFiles,
  upload,
  uploadPdf,
} from './file-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('POST /files', () => {
  it('stores a PDF under a random key and returns its metadata', async () => {
    const { course } = await makeCourse();
    const pdf = samplePdf();
    const res = await upload(app, admin, {
      buffer: pdf,
      filename: 'Week 1 handout.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      originalName: 'Week 1 handout.pdf',
      mimeType: PDF_MIME,
      size: pdf.length,
      purpose: 'material',
      courseId: course.id,
    });
    expect(res.body.data).not.toHaveProperty('storageKey');

    const asset = await FileAsset.findById(res.body.data.id);
    expect(asset.storageKey).toMatch(/^material\/[0-9a-f-]{36}\.pdf$/);
    expect(asset.storageKey).not.toContain('Week');
    expect(asset.uploadedBy.equals(admin._id)).toBe(true);
    expect(asset.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(await storedFiles()).toEqual([asset.storageKey]);
    const onDisk = await fs.readFile(path.join(config.storage.localDir, asset.storageKey));
    expect(onDisk.equals(pdf)).toBe(true);
  });

  it.each([
    ['DOCX', 'notes.docx', DOCX_MIME, sampleDocx],
    ['PPTX', 'slides.pptx', PPTX_MIME, samplePptx],
  ])('accepts a real %s file', async (_label, filename, contentType, make) => {
    const { course } = await makeCourse();
    const res = await upload(app, admin, {
      buffer: make(),
      filename,
      contentType,
      courseId: course.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.mimeType).toBe(contentType);
  });

  it('keeps only a clean display name from the client file name', async () => {
    const { course } = await makeCourse();
    const res = await upload(app, admin, {
      buffer: samplePdf(),
      filename: 'नोट्स <draft>?.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.originalName).toBe('नोट्स draft.pdf');
  });

  describe('rejects spoofed and disallowed files', () => {
    const cases = [
      [
        'HTML disguised as a PDF',
        Buffer.from('<html><script>alert(1)</script></html>'),
        'a.pdf',
        PDF_MIME,
      ],
      ['a PNG renamed to .pdf', PNG, 'image.pdf', PDF_MIME],
      ['a PDF renamed to .docx', samplePdf(), 'notes.docx', DOCX_MIME],
      ['a DOCX renamed to .pptx', sampleDocx(), 'slides.pptx', PPTX_MIME],
      ['a PDF declared as text/html', samplePdf(), 'notes.pdf', 'text/html'],
      ['a PDF declared as octet-stream', samplePdf(), 'notes.pdf', 'application/octet-stream'],
      ['an executable extension', samplePdf(), 'setup.exe', 'application/x-msdownload'],
      ['a file without an extension', samplePdf(), 'notes', PDF_MIME],
      ['an image (not allowed for materials)', PNG, 'diagram.png', 'image/png'],
      ['an empty file', Buffer.alloc(0), 'empty.pdf', PDF_MIME],
    ];

    it.each(cases)('%s', async (_label, buffer, filename, contentType) => {
      const { course } = await makeCourse();
      const res = await upload(app, admin, { buffer, filename, contentType, courseId: course.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_REJECTED');
      expect(await FileAsset.countDocuments()).toBe(0);
      expect(await storedFiles()).toEqual([]);
    });
  });

  it('rejects files over 20 MB with 413', async () => {
    const { course } = await makeCourse();
    const big = Buffer.concat([samplePdf(), Buffer.alloc(20 * 1024 * 1024)]);
    const res = await upload(app, admin, {
      buffer: big,
      filename: 'big.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
    });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_REJECTED');
    expect(await storedFiles()).toEqual([]);
  });

  it('requires a file, a known purpose and an existing course', async () => {
    const { course } = await makeCourse();
    const noFile = await upload(app, admin, { courseId: course.id });
    expect(noFile.status).toBe(400);
    expect(noFile.body.error.code).toBe('FILE_REJECTED');

    const file = { buffer: samplePdf(), filename: 'a.pdf', contentType: PDF_MIME };
    const badPurpose = await upload(app, admin, {
      ...file,
      courseId: course.id,
      purpose: 'avatar',
    });
    expect(badPurpose.status).toBe(400);
    expect(badPurpose.body.error.details[0].path).toBe('purpose');

    const missingCourse = await upload(app, admin, {
      ...file,
      courseId: '0123456789abcdef01234567',
    });
    expect(missingCourse.status).toBe(400);
    expect(missingCourse.body.error.details[0].path).toBe('courseId');
    expect(await storedFiles()).toEqual([]);
  });

  it('accepts exactly one file in the "file" field', async () => {
    const { course } = await makeCourse();
    const two = await api(app)
      .post('/api/v1/files')
      .set(bearer(admin))
      .field('purpose', 'material')
      .field('courseId', course.id)
      .attach('file', samplePdf(), { filename: 'a.pdf', contentType: PDF_MIME })
      .attach('file', samplePdf(), { filename: 'b.pdf', contentType: PDF_MIME });
    expect(two.status).toBe(400);
    expect(two.body.error.code).toBe('FILE_REJECTED');

    const wrongField = await api(app)
      .post('/api/v1/files')
      .set(bearer(admin))
      .field('purpose', 'material')
      .field('courseId', course.id)
      .attach('document', samplePdf(), { filename: 'a.pdf', contentType: PDF_MIME });
    expect(wrongField.status).toBe(400);
  });

  it('is trainer-only', async () => {
    const { course } = await makeCourse();
    const file = { buffer: samplePdf(), filename: 'a.pdf', contentType: PDF_MIME };
    expect((await upload(app, student, { ...file, courseId: course.id })).status).toBe(403);
    const anonymous = await api(app)
      .post('/api/v1/files')
      .field('purpose', 'material')
      .attach('file', samplePdf(), { filename: 'a.pdf', contentType: PDF_MIME });
    expect(anonymous.status).toBe(401);
    expect(await storedFiles()).toEqual([]);
  });

  describe('upload rate limit', () => {
    const original = config.rateLimit.uploadMax;
    afterEach(() => {
      config.rateLimit.uploadMax = original;
    });

    it('allows a limited number of uploads per trainer per hour', async () => {
      config.rateLimit.uploadMax = 2;
      const limitedApp = createApp();
      const { course } = await makeCourse();
      const file = { buffer: samplePdf(), filename: 'a.pdf', contentType: PDF_MIME };
      expect((await upload(limitedApp, admin, { ...file, courseId: course.id })).status).toBe(201);
      expect((await upload(limitedApp, admin, { ...file, courseId: course.id })).status).toBe(201);
      const third = await upload(limitedApp, admin, { ...file, courseId: course.id });
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('RATE_LIMITED');
    });
  });
});

describe('GET /files/:id', () => {
  /** A published course and lesson with one published, downloadable PDF material. */
  async function publishedPdf(materialOverrides) {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const lesson = modules[0].lessons[0];
    const file = await uploadPdf(app, admin, course, 'Cheat sheet.pdf');
    const material = await attachFile(lesson, file.id, materialOverrides);
    return { course, module: modules[0].module, lesson, file, material };
  }

  const fetchFile = (id, user, query = '') => {
    const req = api(app).get(`/api/v1/files/${id}${query}`);
    if (user) req.set(bearer(user));
    return req.buffer(true).parse(binary);
  };

  it('streams the file to an enrolled student, inline and uncached', async () => {
    const { course, file } = await publishedPdf();
    await enroll(student, course);
    const res = await fetchFile(file.id, student);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(PDF_MIME);
    expect(res.headers['content-disposition']).toMatch(/^inline; filename="Cheat sheet\.pdf"/);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBe(file.size);
  });

  it('sends an attachment header only when downloads are allowed', async () => {
    const { course, file, material } = await publishedPdf();
    await enroll(student, course);
    const allowed = await fetchFile(file.id, student, '?download=1');
    expect(allowed.headers['content-disposition']).toMatch(/^attachment;/);

    material.downloadable = false;
    await material.save();
    const viewOnly = await fetchFile(file.id, student, '?download=1');
    expect(viewOnly.status).toBe(200);
    expect(viewOnly.headers['content-disposition']).toMatch(/^inline;/);
  });

  it('encodes non-ASCII names for the download header', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const file = await uploadPdf(app, admin, course, 'नोट्स.pdf');
    await attachFile(modules[0].lessons[0], file.id);
    const res = await fetchFile(file.id, admin, '?download=1');
    expect(res.headers['content-disposition']).toContain(
      `filename*=UTF-8''${encodeURIComponent('नोट्स.pdf')}`,
    );
  });

  it('returns 404 to anonymous requests and 401 to an invalid token', async () => {
    const { file } = await publishedPdf();
    const anonymous = await fetchFile(file.id);
    expect(anonymous.status).toBe(404);
    const missing = await fetchFile('0123456789abcdef01234567');
    expect(missing.status).toBe(404);

    const badToken = await api(app)
      .get(`/api/v1/files/${file.id}`)
      .set('Authorization', 'Bearer not-a-token');
    expect(badToken.status).toBe(401);
  });

  it.each([
    ['not enrolled', null],
    ['with a pending request', 'pending'],
    ['after removal', 'removed'],
  ])('returns 404 to a student %s', async (_label, status) => {
    const { course, file } = await publishedPdf();
    if (status) await enroll(student, course, status);
    const res = await fetchFile(file.id, student);
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body.toString()).error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when the material, lesson, module or course is not published', async () => {
    for (const hide of ['material', 'lesson', 'module', 'course']) {
      const setup = await publishedPdf();
      await enroll(student, setup.course);
      expect((await fetchFile(setup.file.id, student)).status, hide).toBe(200);
      setup[hide].status = hide === 'course' ? 'archived' : 'draft';
      await setup[hide].save();
      expect((await fetchFile(setup.file.id, student)).status, hide).toBe(404);
      expect((await fetchFile(setup.file.id, admin)).status, `admin ${hide}`).toBe(200);
    }
  });

  it('never serves a file through another course enrollment', async () => {
    const { file } = await publishedPdf();
    const { course: otherCourse } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, otherCourse);
    expect((await fetchFile(file.id, student)).status).toBe(404);
  });

  it('keeps unattached files trainer-only', async () => {
    const { course } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await enroll(student, course);
    const file = await uploadPdf(app, admin, course);
    expect((await fetchFile(file.id, student)).status).toBe(404);
    expect((await fetchFile(file.id, admin)).status).toBe(200);
  });

  it('serves a file to one student but not another', async () => {
    const { course, file } = await publishedPdf();
    await enroll(student, course);
    expect((await fetchFile(file.id, student)).status).toBe(200);
    expect((await fetchFile(file.id, otherStudent)).status).toBe(404);
  });

  it('returns 404 when the stored bytes are missing', async () => {
    const { file } = await publishedPdf();
    await fs.rm(config.storage.localDir, { recursive: true, force: true });
    expect((await fetchFile(file.id, admin)).status).toBe(404);
  });

  it('validates the id', async () => {
    expect((await fetchFile('not-an-id', admin)).status).toBe(400);
  });
});
