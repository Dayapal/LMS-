import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StorageError } from '../src/services/storage/errors.js';
import { createS3Storage } from '../src/services/storage/s3.js';
import { startFakeS3 } from './fake-s3.js';

let fake;
let storage;
const KEY = 'material/0b8f6a6e-1f7e-4c55-9d43-3f4f2a1c9e10.pdf';

beforeAll(async () => {
  fake = await startFakeS3();
});
afterAll(() => fake.close());
beforeEach(() => {
  fake.reset();
  storage = createS3Storage(fake.settings);
});

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('S3 storage driver', () => {
  it('stores, sizes, streams, lists and deletes an object with signed requests', async () => {
    const bytes = Buffer.from('%PDF-1.4 test bytes');
    await storage.put(KEY, bytes, { contentType: 'application/pdf' });
    expect(fake.objects.get(KEY)).toMatchObject({ contentType: 'application/pdf' });
    expect(fake.requests[0]).toEqual({ method: 'PUT', path: `/lms-test/${KEY}` });

    expect(await storage.size(KEY)).toBe(bytes.length);
    const opened = await storage.open(KEY);
    expect(opened.size).toBe(bytes.length);
    expect(await readAll(opened.stream)).toEqual(bytes);

    const listed = [];
    for await (const object of storage.list()) listed.push(object);
    expect(listed).toEqual([
      { key: KEY, size: bytes.length, lastModified: expect.any(Date), foreign: false },
    ]);

    await storage.remove(KEY);
    expect(fake.objects.size).toBe(0);
  });

  it('reports a missing object as null and deleting it as success', async () => {
    expect(await storage.size(KEY)).toBeNull();
    expect(await storage.open(KEY)).toBeNull();
    await expect(storage.remove(KEY)).resolves.toBeUndefined();
  });

  it('refuses keys the server did not generate', async () => {
    for (const key of ['../secret.pdf', 'material/x.pdf', 'material/../../etc/passwd', '']) {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow('Invalid storage key');
      await expect(storage.open(key)).rejects.toThrow('Invalid storage key');
    }
    expect(fake.requests).toEqual([]);
  });

  it('retries a temporary provider failure', async () => {
    fake.failNext('PUT', 503, 2);
    await storage.put(KEY, Buffer.from('x'));
    expect(fake.objects.has(KEY)).toBe(true);
    expect(fake.requests.filter((r) => r.method === 'PUT')).toHaveLength(3);
  });

  it('gives up after three attempts with a StorageError', async () => {
    fake.failNext('GET', 500, 3);
    const error = await storage.open(KEY).catch((e) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toBe('Storage download failed (500 InjectedFailure)');
  });

  it('does not retry a refusal, and never puts keys or credentials in the error', async () => {
    const wrong = createS3Storage({ ...fake.settings, secretAccessKey: 'not-the-secret' });
    const error = await wrong.put(KEY, Buffer.from('x')).catch((e) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toBe('Storage upload failed (403 SignatureDoesNotMatch)');
    expect(fake.requests).toHaveLength(1);
    const text = `${error.message} ${error.stack}`;
    for (const secret of [KEY, 'not-the-secret', fake.settings.accessKeyId, fake.endpoint]) {
      expect(text).not.toContain(secret);
    }
  });

  it('turns network failures and timeouts into StorageErrors', async () => {
    const down = createS3Storage({ ...fake.settings, endpoint: 'http://127.0.0.1:1' });
    await expect(down.size(KEY)).rejects.toThrow('Storage lookup failed (network error)');

    const hanging = createS3Storage({
      ...fake.settings,
      timeoutMs: 20,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    });
    await expect(hanging.remove(KEY)).rejects.toThrow('Storage delete timed out');
  });

  it('can address the bucket as a subdomain (virtual-hosted style)', async () => {
    const calls = [];
    const virtual = createS3Storage({
      ...fake.settings,
      endpoint: 'https://account.r2.cloudflarestorage.com',
      forcePathStyle: false,
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response(null, { status: 404 });
      },
    });
    await virtual.size(KEY);
    expect(calls).toEqual([`https://lms-test.account.r2.cloudflarestorage.com/${KEY}`]);
  });
});
