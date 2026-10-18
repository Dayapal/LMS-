// Creates a throwaway self-signed certificate for https://localhost, so the
// E2E build is served over HTTPS like production. WebKit doesn't keep a
// `Secure` cookie on plain http://localhost (Chromium and Firefox do), and the
// API in production mode always sets the refresh cookie as Secure.
// Uses OpenSSL (on PATH, in Git for Windows, or set OPENSSL=path).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { TLS_DIR } from './env.js';

const candidates = [
  process.env.OPENSSL,
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
].filter(Boolean);

function findOpenssl() {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error('OpenSSL not found. Install it or set OPENSSL to its path (see e2e/README.md).');
}

mkdirSync(TLS_DIR, { recursive: true });
const key = path.join(TLS_DIR, 'key.pem');
const cert = path.join(TLS_DIR, 'cert.pem');
execFileSync(
  findOpenssl(),
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-keyout',
    key,
    '-out',
    cert,
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ],
  { stdio: 'ignore' },
);
if (!existsSync(cert)) throw new Error('Certificate was not created');
console.log(`[e2e] TLS certificate for localhost in ${TLS_DIR}`);
