import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { StorageError } from './errors.js';
import { assertValidKey, isValidKey } from './keys.js';
import { EMPTY_SHA256, sha256Hex, signRequest } from './sigv4.js';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

const xmlDecode = (text) =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

const xmlValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? xmlDecode(match[1]) : undefined;
};

/**
 * Private object storage over the S3 API (Cloudflare R2 in production).
 * Objects are only ever read by the API after its access checks; nothing here
 * creates public or pre-signed URLs, and the credentials never leave the server.
 */
export function createS3Storage({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  forcePathStyle = true,
  timeoutMs = 30_000,
  fetchImpl = globalThis.fetch,
}) {
  const base = new URL(endpoint.replace(/\/+$/, ''));

  const urlFor = (key = '', query) => {
    const url = new URL(base);
    if (forcePathStyle) {
      url.pathname = `${base.pathname.replace(/\/$/, '')}/${bucket}${key ? `/${key}` : ''}`;
    } else {
      url.hostname = `${bucket}.${base.hostname}`;
      url.pathname = `/${key}`;
    }
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, value);
    }
    return url;
  };

  /**
   * One signed request, retried on network errors and 5xx/429. The timeout
   * covers the wait for the response headers, not a body being streamed.
   */
  async function send(operation, method, url, { body, headers = {}, okStatuses = [200] } = {}) {
    const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;
    let lastError;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const signed = signRequest({
          method,
          url: url.href,
          headers,
          payloadHash,
          accessKeyId,
          secretAccessKey,
          region,
        });
        const res = await fetchImpl(url, {
          method,
          headers: signed,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (okStatuses.includes(res.status)) return res;
        const text = await res.text().catch(() => '');
        const code = xmlValue(text, 'Code');
        lastError = new StorageError(
          `Storage ${operation} failed (${res.status}${code ? ` ${code}` : ''})`,
          {
            status: res.status,
            code,
          },
        );
        if (!RETRYABLE.has(res.status)) throw lastError;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof StorageError && !RETRYABLE.has(error.status)) throw error;
        if (!(error instanceof StorageError)) {
          lastError = new StorageError(
            controller.signal.aborted
              ? `Storage ${operation} timed out`
              : `Storage ${operation} failed (network error)`,
            { cause: error },
          );
        }
      }
      if (attempt < ATTEMPTS) await delay(200 * 2 ** (attempt - 1));
    }
    throw lastError;
  }

  return {
    name: 's3',

    async put(key, buffer, { contentType = 'application/octet-stream' } = {}) {
      assertValidKey(key);
      await send('upload', 'PUT', urlFor(key), {
        body: buffer,
        headers: { 'content-type': contentType },
      });
    },

    /** Size in bytes, or null when the object is missing. */
    async size(key) {
      assertValidKey(key);
      const res = await send('lookup', 'HEAD', urlFor(key), { okStatuses: [200, 404] });
      return res.status === 404 ? null : Number(res.headers.get('content-length'));
    },

    /** `{ size, stream }`, or null when the object is missing. */
    async open(key) {
      assertValidKey(key);
      const res = await send('download', 'GET', urlFor(key), { okStatuses: [200, 404] });
      if (res.status === 404) {
        await res.body?.cancel();
        return null;
      }
      return {
        size: Number(res.headers.get('content-length')),
        stream: Readable.fromWeb(res.body),
      };
    },

    /** Deletes the object. A missing object is not an error. */
    async remove(key) {
      assertValidKey(key);
      await send('delete', 'DELETE', urlFor(key), { okStatuses: [200, 204, 404] });
    },

    /** Every stored object as `{ key, size, lastModified }` (used by the cleanup script). */
    async *list() {
      let token;
      do {
        const res = await send(
          'list',
          'GET',
          urlFor('', { 'list-type': '2', 'continuation-token': token }),
        );
        const xml = await res.text();
        for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = xmlValue(entry, 'Key');
          yield {
            key,
            size: Number(xmlValue(entry, 'Size')),
            lastModified: new Date(xmlValue(entry, 'LastModified')),
            foreign: !isValidKey(key),
          };
        }
        token =
          xmlValue(xml, 'IsTruncated') === 'true'
            ? xmlValue(xml, 'NextContinuationToken')
            : undefined;
      } while (token);
    },
  };
}
