import { describe, expect, it } from 'vitest';
import { encodeRfc3986, sha256Hex, signRequest } from '../src/services/storage/sigv4.js';

// The worked examples in AWS's "Signature Calculations for the Authorization
// Header" (Amazon S3 API reference), signed with AWS's example credentials.
const credentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  date: new Date('2013-05-24T00:00:00Z'),
};
const signatureOf = (headers) => headers.authorization.match(/Signature=([0-9a-f]{64})$/)[1];

describe('SigV4 signer (AWS published examples)', () => {
  it('GET Object with a Range header', () => {
    const headers = signRequest({
      ...credentials,
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      headers: { Range: 'bytes=0-9' },
    });
    expect(headers.authorization).toContain(
      'Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
    );
    expect(headers.authorization).toContain(
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date',
    );
    expect(signatureOf(headers)).toBe(
      'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
    expect(headers['x-amz-date']).toBe('20130524T000000Z');
  });

  it('PUT Object with a key that needs encoding and extra signed headers', () => {
    const body = 'Welcome to Amazon S3.';
    const headers = signRequest({
      ...credentials,
      method: 'PUT',
      url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
      headers: {
        Date: 'Fri, 24 May 2013 00:00:00 GMT',
        'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      },
      payloadHash: sha256Hex(body),
    });
    expect(headers['x-amz-content-sha256']).toBe(
      '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    );
    expect(signatureOf(headers)).toBe(
      '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
    );
  });

  it('GET Bucket lifecycle (a query parameter without a value)', () => {
    const headers = signRequest({
      ...credentials,
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/?lifecycle',
    });
    expect(signatureOf(headers)).toBe(
      'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543',
    );
  });

  it('GET Bucket (list objects, sorted query parameters)', () => {
    const headers = signRequest({
      ...credentials,
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J',
    });
    expect(signatureOf(headers)).toBe(
      '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
    );
  });

  it('signs query parameters in sorted order, whatever order the URL has', () => {
    const headers = signRequest({
      ...credentials,
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2',
    });
    expect(signatureOf(headers)).toBe(
      '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
    );
  });

  it('does not send the host header itself (fetch sets it from the URL)', () => {
    const headers = signRequest({
      ...credentials,
      method: 'GET',
      url: 'http://127.0.0.1:9000/b/k',
    });
    expect(headers).not.toHaveProperty('host');
    expect(headers.authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date');
  });

  it('encodes reserved characters the RFC 3986 way', () => {
    expect(encodeRfc3986("a b!'()*~")).toBe('a%20b%21%27%28%29%2A~');
  });
});
