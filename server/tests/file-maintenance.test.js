import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { FileAsset } from '../src/models/index.js';
import { checkStorage, cleanupFiles, migrateFiles } from '../src/services/fileMaintenance.js';
import { getStorage } from '../src/services/storage/index.js';
import { api } from './helpers.js';
import { actors, bearer, enroll, makeCourse } from './content-helpers.js';
import { attachFile, binary, PDF_MIME, samplePdf, storedFiles, upload } from './file-helpers.js';
import { startFakeS3 } from './fake-s3.js';

let fake;
let app;
let admin;
let student;
const HOUR = 60 * 60 * 1000;
const later = (hours) => new Date(Date.now() + hours * HOUR);

beforeAll(async () => {
  fake = await startFakeS3();
});
afterAll(() => fake.close());
beforeEach(async () => {
  fake.reset();
  config.storage.driver = 'local';
  config.storage.s3 = fake.settings;
  app = createApp();
  ({ admin, student } = await actors());
});
afterEach(() => {
  config.storage.driver = 'local';
  config.storage.s3 = null;
});

async function uploadTo(course) {
  const res = await upload(app, admin, {
    buffer: samplePdf(),
    filename: 'a.pdf',
    contentType: PDF_MIME,
    courseId: course.id,
  });
  expect(res.status).toBe(201);
  return FileAsset.findById(res.body.data.id);
}

describe('files cleanup', () => {
  it('reports unattached uploads older than the cutoff, and removes them only with apply', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const orphan = await uploadTo(course);
    const attached = await uploadTo(course);
    await attachFile(modules[0].lessons[0], attached._id);

    // Too recent: a save may still be on its way.
    expect((await cleanupFiles()).unattached).toEqual([]);

    const dryRun = await cleanupFiles({ now: later(25) });
    expect(dryRun.unattached.map((f) => f.id)).toEqual([orphan.id]);
    expect(dryRun.deleted).toEqual({ unattached: 0, strayObjects: 0 });
    expect(await FileAsset.countDocuments()).toBe(2);

    const applied = await cleanupFiles({ now: later(25), apply: true });
    expect(applied.deleted.unattached).toBe(1);
    expect((await FileAsset.find()).map((f) => f.id)).toEqual([attached.id]);
    expect(await storedFiles()).toEqual([attached.storageKey]);
  });

  it('removes stored bytes that have no record, but never unknown files or superseded copies', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const kept = await uploadTo(course);
    await attachFile(modules[0].lessons[0], kept._id);
    const stray = 'material/0b8f6a6e-1f7e-4c55-9d43-3f4f2a1c9e10.pdf';
    await getStorage('local').put(stray, Buffer.from('left behind'));
    await fs.writeFile(path.join(config.storage.localDir, 'notes.txt'), 'not ours');
    // A record migrated to s3 whose local copy is kept for rollback.
    const migrated = await uploadTo(course);
    await attachFile(modules[0].lessons[0], migrated._id, { order: 1 });
    await fake.objects.set(migrated.storageKey, {
      body: Buffer.from('x'),
      lastModified: new Date(),
    });
    await FileAsset.updateOne({ _id: migrated._id }, { provider: 's3', createdAt: new Date() });

    const report = await cleanupFiles({ now: later(25), apply: true });
    expect(report.strayObjects).toEqual([{ provider: 'local', key: stray, size: 11 }]);
    expect(report.deleted.strayObjects).toBe(1);
    expect(report.foreignObjects).toBe(1);
    expect(report.supersededCopies).toBe(1);
    expect((await storedFiles()).sort()).toEqual(
      [kept.storageKey, migrated.storageKey, 'notes.txt'].sort(),
    );
  });

  it('reports records whose bytes are missing without deleting them', async () => {
    const { course } = await makeCourse();
    const file = await uploadTo(course);
    await getStorage('local').remove(file.storageKey);
    const report = await cleanupFiles({ apply: true });
    expect(report.missingBytes).toEqual([{ id: file.id, provider: 'local' }]);
    expect(await FileAsset.exists({ _id: file._id })).not.toBeNull();
  });

  it('reports a provider that records use but this process cannot reach', async () => {
    const { course } = await makeCourse();
    const file = await uploadTo(course);
    await FileAsset.updateOne({ _id: file._id }, { provider: 's3' });
    config.storage.s3 = null;
    const report = await cleanupFiles();
    expect(report.unreachable).toEqual([{ provider: 's3', reason: 'not configured' }]);
  });
});

describe('files migrate', () => {
  it('copies local files to s3, verifies them, keeps the originals and can be rolled back', async () => {
    const { course, modules } = await makeCourse({ shape: [{ lessons: ['published'] }] });
    const file = await uploadTo(course);
    await attachFile(modules[0].lessons[0], file._id);
    await enroll(student, course);
    const original = await fs.readFile(path.join(config.storage.localDir, file.storageKey));

    const dryRun = await migrateFiles({ to: 's3' });
    expect(dryRun).toMatchObject({ total: 1, migrated: 0 });
    expect(fake.objects.size).toBe(0);
    expect((await FileAsset.findById(file._id)).provider).toBe('local');

    const applied = await migrateFiles({ to: 's3', apply: true });
    expect(applied).toMatchObject({ total: 1, migrated: 1, problems: [] });
    expect(fake.objects.get(file.storageKey).body).toEqual(original);
    expect((await FileAsset.findById(file._id)).provider).toBe('s3');
    expect(await storedFiles()).toEqual([file.storageKey]); // the source is kept

    // The student still gets the file, now from the bucket.
    config.storage.driver = 's3';
    const res = await api(app)
      .get(`/api/v1/files/${file.id}`)
      .set(bearer(student))
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(original);

    expect(await migrateFiles({ to: 's3', apply: true })).toMatchObject({ total: 0 });

    // Rollback: the local copy is still there, so nothing is overwritten.
    const back = await migrateFiles({ to: 'local', apply: true });
    expect(back).toMatchObject({ total: 1, migrated: 1, alreadyCopied: 1, problems: [] });
    expect((await FileAsset.findById(file._id)).provider).toBe('local');
  });

  it('skips files whose bytes are missing or do not match their checksum', async () => {
    const { course } = await makeCourse();
    const missing = await uploadTo(course);
    const corrupt = await uploadTo(course);
    await getStorage('local').remove(missing.storageKey);
    await fs.writeFile(path.join(config.storage.localDir, corrupt.storageKey), 'tampered');

    const report = await migrateFiles({ to: 's3', apply: true });
    expect(report.migrated).toBe(0);
    expect(report.problems).toEqual(
      expect.arrayContaining([
        { id: missing.id, reason: 'missing in local' },
        { id: corrupt.id, reason: 'checksum mismatch at the source' },
      ]),
    );
    expect(fake.objects.size).toBe(0);
    expect(await FileAsset.countDocuments({ provider: 'local' })).toBe(2);
  });

  it('never overwrites a different object already in the target', async () => {
    const { course } = await makeCourse();
    const file = await uploadTo(course);
    fake.objects.set(file.storageKey, { body: Buffer.from('other'), lastModified: new Date() });
    const report = await migrateFiles({ to: 's3', apply: true });
    expect(report.problems).toEqual([
      { id: file.id, reason: 'a different object already exists in s3' },
    ]);
    expect(fake.objects.get(file.storageKey).body.toString()).toBe('other');
    expect((await FileAsset.findById(file._id)).provider).toBe('local');
  });

  it('records a storage failure as a problem and leaves the record alone', async () => {
    const { course } = await makeCourse();
    const file = await uploadTo(course);
    fake.failNext('PUT', 503, 3);
    const report = await migrateFiles({ to: 's3', apply: true });
    expect(report.problems).toEqual([
      { id: file.id, reason: 'StorageError: Storage upload failed (503 InjectedFailure)' },
    ]);
    expect((await FileAsset.findById(file._id)).provider).toBe('local');
  });
});

describe('storage check', () => {
  it('writes, reads and deletes one temporary object', async () => {
    config.storage.driver = 's3';
    expect(await checkStorage()).toEqual({
      provider: 's3',
      steps: ['write', 'size', 'read', 'delete'],
    });
    expect(fake.objects.size).toBe(0);
  });

  it('fails clearly when the bucket refuses the credentials', async () => {
    config.storage.driver = 's3';
    config.storage.s3 = { ...fake.settings, secretAccessKey: 'wrong' };
    await expect(checkStorage()).rejects.toThrow(
      'Storage upload failed (403 SignatureDoesNotMatch)',
    );
  });
});
