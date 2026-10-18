import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { FileAsset } from '../src/models/index.js';
import { storeFile } from '../src/services/file.service.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { makeAssignment, uploadSubmissionFile } from './assignment-helpers.js';
import { attachFile, binary, PDF_MIME, samplePdf, storedFiles, upload } from './file-helpers.js';
import { startFakeS3 } from './fake-s3.js';

/**
 * The file endpoints on the production storage driver (S3 API, as used with
 * Cloudflare R2), against an in-memory S3 endpoint that checks signatures.
 */
let fake;
let app;
let admin;
let student;
let otherStudent;

beforeAll(async () => {
  fake = await startFakeS3();
});
afterAll(() => fake.close());

beforeEach(async () => {
  fake.reset();
  config.storage.driver = 's3';
  config.storage.s3 = fake.settings;
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
});
afterEach(() => {
  config.storage.driver = 'local';
  config.storage.s3 = null;
  vi.restoreAllMocks();
});

async function publishedPdf(bytes = samplePdf('Week 1')) {
  const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
  const res = await upload(app, admin, {
    buffer: bytes,
    filename: 'week1.pdf',
    contentType: PDF_MIME,
    courseId: course.id,
  });
  expect(res.status).toBe(201);
  const lesson = modules[0].lessons[0];
  const material = await attachFile(lesson, res.body.data.id);
  return { course, lesson, material, fileId: res.body.data.id, bytes };
}

const download = (fileId, user) => {
  const req = api(app).get(`/api/v1/files/${fileId}`).buffer(true).parse(binary);
  return user ? req.set(bearer(user)) : req;
};

describe('files on S3-compatible storage', () => {
  it('stores trainer uploads in the bucket, not on disk, and records the provider', async () => {
    const { fileId, bytes } = await publishedPdf();
    const asset = await FileAsset.findById(fileId);
    expect(asset.provider).toBe('s3');
    expect(fake.objects.get(asset.storageKey).body).toEqual(bytes);
    expect(fake.objects.get(asset.storageKey).contentType).toBe(PDF_MIME);
    expect(await storedFiles()).toEqual([]);
  });

  it('streams a file only after the access check', async () => {
    const { course, fileId, bytes } = await publishedPdf();
    await enroll(student, course);

    const res = await download(fileId, student);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(bytes);
    expect(res.headers['content-type']).toBe(PDF_MIME);
    expect(res.headers['content-length']).toBe(String(bytes.length));
    expect(res.headers['cache-control']).toBe('private, no-store');

    const before = fake.requests.length;
    expect((await download(fileId, otherStudent)).status).toBe(404);
    expect((await download(fileId)).status).toBe(404);
    // Refused requests never reach the bucket.
    expect(fake.requests.length).toBe(before);
  });

  it('keeps student PDFs private to their owner and the trainer', async () => {
    const { course } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    await Promise.all([enroll(student, course), enroll(otherStudent, course)]);
    const assignment = await makeAssignment(course);
    const res = await uploadSubmissionFile(app, student, assignment);
    expect(res.status).toBe(201);
    const asset = await FileAsset.findById(res.body.data.id);
    expect(asset.provider).toBe('s3');
    expect(fake.objects.has(asset.storageKey)).toBe(true);

    expect((await download(asset.id, student)).status).toBe(200);
    expect((await download(asset.id, admin)).status).toBe(200);
    expect((await download(asset.id, otherStudent)).status).toBe(404);
  });

  it('stores nothing for a rejected (spoofed) upload', async () => {
    const { course } = await makeCourse();
    const res = await upload(app, admin, {
      buffer: Buffer.from('<html><script>alert(1)</script></html>'),
      filename: 'notes.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
    });
    expect(res.status).toBe(400);
    expect(fake.requests).toEqual([]);
    expect(await FileAsset.countDocuments()).toBe(0);
  });

  it('answers 503 without details when the bucket is unavailable during an upload', async () => {
    const { course } = await makeCourse();
    fake.failNext('PUT', 503, 3);
    const res = await upload(app, admin, {
      buffer: samplePdf(),
      filename: 'a.pdf',
      contentType: PDF_MIME,
      courseId: course.id,
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'File storage is unavailable. Please try again.',
      },
    });
    expect(await FileAsset.countDocuments()).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it('answers 503 without the key, bucket or endpoint when a download fails', async () => {
    const { course, fileId } = await publishedPdf();
    await enroll(student, course);
    fake.failNext('GET', 500, 3);
    const res = await api(app).get(`/api/v1/files/${fileId}`).set(bearer(student));
    expect(res.status).toBe(503);
    const text = JSON.stringify(res.body);
    const asset = await FileAsset.findById(fileId);
    for (const secret of [asset.storageKey, fake.endpoint, fake.settings.bucket]) {
      expect(text).not.toContain(secret);
    }
  });

  it('returns 404 when the object has disappeared from the bucket', async () => {
    const { course, fileId } = await publishedPdf();
    await enroll(student, course);
    fake.objects.clear();
    expect((await download(fileId, student)).status).toBe(404);
  });

  it('keeps serving files recorded on the local disk before the switch', async () => {
    config.storage.driver = 'local';
    const { course, fileId, bytes } = await publishedPdf();
    config.storage.driver = 's3';
    await enroll(student, course);

    const res = await download(fileId, student);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(bytes);
    expect((await FileAsset.findById(fileId)).provider).toBe('local');
  });
});

describe('orphaned bytes and failed storage calls', () => {
  it('removes the stored bytes when the record cannot be created', async () => {
    vi.spyOn(FileAsset, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      storeFile({
        buffer: samplePdf(),
        ext: 'pdf',
        mimeType: PDF_MIME,
        originalName: 'a.pdf',
        purpose: 'material',
        user: admin,
      }),
    ).rejects.toThrow('database unavailable');
    expect(fake.objects.size).toBe(0);
  });

  it('keeps the original error when removing those bytes also fails', async () => {
    vi.spyOn(FileAsset, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    fake.failNext('DELETE', 500, 3);
    await expect(
      storeFile({
        buffer: samplePdf(),
        ext: 'pdf',
        mimeType: PDF_MIME,
        originalName: 'a.pdf',
        purpose: 'material',
        user: admin,
      }),
    ).rejects.toThrow('database unavailable');
    // Left for `npm run files -- cleanup` (see file-maintenance.test.js).
    expect(fake.objects.size).toBe(1);
  });

  it('still deletes a material when the bucket fails, leaving only unreferenced bytes', async () => {
    const { material, fileId } = await publishedPdf();
    material.status = 'draft';
    await material.save();
    const asset = await FileAsset.findById(fileId);

    fake.failNext('DELETE', 500, 3);
    const res = await api(app).delete(`/api/v1/materials/${material.id}`).set(bearer(admin));
    expect(res.status).toBe(204);
    expect(await FileAsset.exists({ _id: fileId })).toBeNull();
    expect(fake.objects.has(asset.storageKey)).toBe(true);
  });
});

describe('local driver', () => {
  it('lists stored files and flags files the server did not write', async () => {
    config.storage.driver = 'local';
    const { fileId } = await publishedPdf();
    await fs.writeFile(path.join(config.storage.localDir, 'README.txt'), 'stray');
    const { getStorage } = await import('../src/services/storage/index.js');
    const listed = [];
    for await (const object of getStorage('local').list()) listed.push(object);
    const asset = await FileAsset.findById(fileId);
    expect(
      listed.map(({ key, foreign }) => ({ key, foreign })).sort((a, b) => (a.key < b.key ? -1 : 1)),
    ).toEqual([
      { key: 'README.txt', foreign: true },
      { key: asset.storageKey, foreign: false },
    ]);
  });
});
