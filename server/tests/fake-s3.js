import crypto from 'node:crypto';
import http from 'node:http';
import { signRequest } from '../src/services/storage/sigv4.js';

/**
 * A tiny in-memory S3 endpoint (path-style) for tests and the E2E stack.
 * It re-signs every request from what actually arrived on the wire and rejects
 * mismatches, so the driver's URLs, headers and payload hashes are checked
 * end to end. `failNext(method, status)` injects provider errors.
 */
export async function startFakeS3({
  bucket = 'lms-test',
  accessKeyId = 'test-access-key',
  secretAccessKey = 'test-secret-key',
  region = 'auto',
  port = 0,
} = {}) {
  const objects = new Map(); // key -> { body, contentType, lastModified }
  const failures = [];
  const requests = [];

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, `http://${req.headers.host}`);
    requests.push({ method: req.method, path: url.pathname });

    const reply = (status, xml = '', headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/xml', ...headers });
      res.end(req.method === 'HEAD' ? undefined : xml);
    };
    const error = (status, code) =>
      reply(status, `<?xml version="1.0"?><Error><Code>${code}</Code></Error>`);

    const failure = failures.findIndex((f) => f.method === req.method || f.method === '*');
    if (failure !== -1) return error(failures.splice(failure, 1)[0].status, 'InjectedFailure');

    // Signature check: rebuild the signed headers from the received request.
    const auth = req.headers.authorization ?? '';
    const match = auth.match(
      /Credential=([^/]+)\/(\d{8})\/[^,]+, SignedHeaders=([^,]+), Signature=(\w+)/,
    );
    if (!match || match[1] !== accessKeyId) return error(403, 'InvalidAccessKeyId');
    const signed = Object.fromEntries(
      match[3]
        .split(';')
        .filter((name) => !['host', 'x-amz-date', 'x-amz-content-sha256'].includes(name))
        .map((name) => [name, req.headers[name]]),
    );
    const payloadHash = req.headers['x-amz-content-sha256'];
    const amzDate = req.headers['x-amz-date'];
    const date = new Date(
      `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`,
    );
    const expected = signRequest({
      method: req.method,
      url: url.href,
      headers: signed,
      payloadHash,
      accessKeyId,
      secretAccessKey,
      region,
      date,
    });
    if (expected.authorization !== auth) return error(403, 'SignatureDoesNotMatch');
    if (
      req.method === 'PUT' &&
      crypto.createHash('sha256').update(body).digest('hex') !== payloadHash
    ) {
      return error(400, 'XAmzContentSHA256Mismatch');
    }

    const [, bucketName, ...rest] = url.pathname.split('/');
    if (bucketName !== bucket) return error(404, 'NoSuchBucket');
    const key = decodeURIComponent(rest.join('/'));

    if (!key && req.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const contents = [...objects.entries()]
        .map(
          ([k, o]) =>
            `<Contents><Key>${k}</Key><LastModified>${o.lastModified.toISOString()}</LastModified><Size>${o.body.length}</Size></Contents>`,
        )
        .join('');
      return reply(
        200,
        `<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`,
      );
    }
    if (req.method === 'PUT') {
      objects.set(key, {
        body,
        contentType: req.headers['content-type'],
        lastModified: new Date(),
      });
      return reply(200);
    }
    const object = objects.get(key);
    if (req.method === 'DELETE') {
      objects.delete(key);
      return reply(204);
    }
    if (!object) return error(404, 'NoSuchKey');
    res.writeHead(200, {
      'content-type': object.contentType ?? 'application/octet-stream',
      'content-length': object.body.length,
    });
    return res.end(req.method === 'HEAD' ? undefined : object.body);
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;

  return {
    endpoint,
    objects,
    requests,
    settings: { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle: true },
    failNext(method, status = 503, times = 1) {
      for (let i = 0; i < times; i += 1) failures.push({ method, status });
    },
    reset() {
      objects.clear();
      failures.length = 0;
      requests.length = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
