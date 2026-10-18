import crypto from 'node:crypto';

/**
 * AWS Signature Version 4 for S3-compatible APIs (Cloudflare R2, AWS S3, MinIO).
 * Small on purpose: the driver only needs header-signed requests, so this
 * avoids pulling in the AWS SDK. Checked against AWS's published examples in
 * tests/storage-sigv4.test.js.
 */

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone). */
export const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** S3 canonical URI: each path segment encoded once, slashes kept. */
const canonicalUri = (pathname) =>
  pathname
    .split('/')
    .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
    .join('/') || '/';

const canonicalQuery = (searchParams) =>
  [...searchParams.entries()]
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)])
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

/** `20130524T000000Z` */
export const amzDate = (date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '');

/**
 * Returns the headers to send: the given ones plus `x-amz-date`,
 * `x-amz-content-sha256` and `authorization`. Every given header is signed,
 * along with `host` (taken from the URL, as `fetch` sends it).
 */
export function signRequest({
  method,
  url,
  headers = {},
  payloadHash = EMPTY_SHA256,
  accessKeyId,
  secretAccessKey,
  region,
  service = 's3',
  date = new Date(),
}) {
  const target = new URL(url);
  const timestamp = amzDate(date);
  const day = timestamp.slice(0, 8);

  const all = {
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])),
    host: target.host,
    'x-amz-date': timestamp,
    'x-amz-content-sha256': payloadHash,
  };
  const names = Object.keys(all).sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${all[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(target.pathname),
    canonicalQuery(target.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, sha256Hex(canonicalRequest)].join(
    '\n',
  );
  const dateKey = hmac(`AWS4${secretAccessKey}`, day);
  const signingKey = hmac(hmac(hmac(dateKey, region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const { host: _host, ...toSend } = all;
  return {
    ...toSend,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
