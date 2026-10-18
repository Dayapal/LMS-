import os from 'node:os';
import path from 'node:path';

// The isolated end-to-end environment. Nothing here touches the development
// database, server/.env or real storage: the API runs against its own
// `lms_e2e` database and an in-memory S3 endpoint, both reset on every run.

export const API_PORT = 5055;
export const S3_PORT = 9055;
export const WEB_PORT = 4174;
// HTTPS like production (see cert.js); the certificate is self-signed and throwaway.
export const BASE_URL = `https://localhost:${WEB_PORT}`;
export const TLS_DIR = path.join(os.tmpdir(), 'lms-e2e-tls');
export const E2E_DB_URI = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/lms_e2e';

export const TRAINER = { email: 'trainer.e2e@example.com', password: 'E2eTrainer123' };
export const DEMO_PASSWORD = 'E2eStudent123';
export const DEMO = {
  aarav: { email: 'aarav.demo@example.com', password: DEMO_PASSWORD, name: 'Aarav Mehta' },
  neha: { email: 'neha.demo@example.com', password: DEMO_PASSWORD },
  kabir: { email: 'kabir.demo@example.com', password: DEMO_PASSWORD },
};

const S3 = {
  bucket: 'lms-e2e',
  accessKeyId: 'e2e-access-key',
  secretAccessKey: 'e2e-secret-key-not-a-real-credential',
};
export const FAKE_S3 = { ...S3, port: S3_PORT, region: 'auto' };

// Plays the Vercel project variable: the preview proxy adds it as x-origin-secret,
// like the /api route in client/vercel.json. A throwaway test value, not a credential.
export const ORIGIN_SECRET = 'e2e-only-origin-secret-0123456789-abcdefghijklmnop';
export const API_DIRECT_URL = `http://127.0.0.1:${API_PORT}`;

/** Environment for the API and the seed: production mode, as deployed on Render. */
export const apiEnv = () => ({
  NODE_ENV: 'production',
  PORT: String(API_PORT),
  MONGODB_URI: E2E_DB_URI,
  JWT_ACCESS_SECRET: 'e2e-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
  CLIENT_ORIGINS: BASE_URL,
  // Vite's preview proxy adds no X-Forwarded-For: the API sees the proxy's socket.
  TRUST_PROXY: '0',
  ORIGIN_SECRET,
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: `http://127.0.0.1:${S3_PORT}`,
  S3_REGION: 'auto',
  S3_BUCKET: S3.bucket,
  S3_ACCESS_KEY_ID: S3.accessKeyId,
  S3_SECRET_ACCESS_KEY: S3.secretAccessKey,
  // Every test signs in several times from one address.
  AUTH_RATE_LIMIT_MAX: '10000',
  REFRESH_RATE_LIMIT_MAX: '10000',
  RATE_LIMIT_MAX: '100000',
  UPLOAD_RATE_LIMIT_MAX: '10000',
  BCRYPT_ROUNDS: '4',
  LOG_LEVEL: 'warn',
  SEED_ADMIN_NAME: 'E2E Trainer',
  SEED_ADMIN_EMAIL: TRAINER.email,
  SEED_ADMIN_PASSWORD: TRAINER.password,
  SEED_DEMO_STUDENT_PASSWORD: DEMO_PASSWORD,
});
