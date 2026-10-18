import { describe, expect, it } from 'vitest';
import { config, loadConfig, redactSecrets } from '../src/config/env.js';

const JWT = 'a-production-secret-that-is-long-enough-1234567890';
const S3_SECRET = 'r2-secret-access-key-value-0123456789abcdef';
const DB_PASSWORD = 'atlas-pa55word';
const ORIGIN = 'example-origin-secret-for-tests-0123456789abcdef';
const ORIGIN_OLD = 'example-previous-origin-secret-9876543210fedcba';

/** A complete production environment (Vercel + Render + Atlas + R2), placeholders only. */
const production = (overrides = {}) => ({
  NODE_ENV: 'production',
  MONGODB_URI: `mongodb+srv://lms-api:${DB_PASSWORD}@cluster0.example.mongodb.net/lms`,
  JWT_ACCESS_SECRET: JWT,
  CLIENT_ORIGINS: 'https://training-lms.vercel.app',
  TRUST_PROXY: '2',
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://0123456789abcdef.r2.cloudflarestorage.com',
  S3_BUCKET: 'training-lms-files',
  S3_ACCESS_KEY_ID: 'r2-access-key-id',
  S3_SECRET_ACCESS_KEY: S3_SECRET,
  ORIGIN_SECRET: ORIGIN,
  ...overrides,
});

const problemsOf = (env) => {
  try {
    loadConfig(env);
  } catch (error) {
    return error.message;
  }
  throw new Error('expected the configuration to be refused');
};

describe('production environment validation', () => {
  it('accepts a complete production environment with secure defaults', () => {
    const result = loadConfig(production());
    expect(result.isProduction).toBe(true);
    expect(result.trustProxy).toBe(2);
    expect(result.auth.cookie).toEqual({
      name: 'lms_rt',
      path: '/api/v1/auth',
      secure: true,
      sameSite: 'lax',
    });
    expect(result.storage.s3).toEqual({
      endpoint: 'https://0123456789abcdef.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'training-lms-files',
      accessKeyId: 'r2-access-key-id',
      secretAccessKey: S3_SECRET,
      forcePathStyle: true,
    });
    expect(result.proxyDiagnostics).toBe(false);
    expect(result.originSecrets).toEqual([ORIGIN]);
  });

  it('requires ORIGIN_SECRET in production, so only the Vercel proxy can reach the API', () => {
    expect(problemsOf(production({ ORIGIN_SECRET: undefined }))).toContain(
      'ORIGIN_SECRET must be set in production',
    );
    expect(problemsOf(production({ ORIGIN_SECRET: '' }))).toContain(
      'ORIGIN_SECRET must be set in production',
    );
    expect(problemsOf(production({ ORIGIN_SECRET: 'short' }))).toContain(
      'ORIGIN_SECRET must be at least 32 characters',
    );
    // Development and tests may run without it (the check is then off).
    const development = { MONGODB_URI: 'mongodb://127.0.0.1/lms', JWT_ACCESS_SECRET: JWT };
    expect(loadConfig(development).originSecrets).toEqual([]);
  });

  it('accepts a previous ORIGIN_SECRET during a rotation, never on its own or equal', () => {
    expect(loadConfig(production({ ORIGIN_SECRET_PREVIOUS: ORIGIN_OLD })).originSecrets).toEqual([
      ORIGIN,
      ORIGIN_OLD,
    ]);
    expect(
      problemsOf(production({ ORIGIN_SECRET: undefined, ORIGIN_SECRET_PREVIOUS: ORIGIN_OLD })),
    ).toContain('ORIGIN_SECRET_PREVIOUS is only used together with ORIGIN_SECRET');
    expect(problemsOf(production({ ORIGIN_SECRET_PREVIOUS: ORIGIN }))).toContain(
      'ORIGIN_SECRET_PREVIOUS must differ from ORIGIN_SECRET',
    );
  });

  it('requires TRUST_PROXY to be set explicitly in production (0 is allowed)', () => {
    expect(problemsOf(production({ TRUST_PROXY: undefined }))).toContain(
      'TRUST_PROXY must be set in production',
    );
    expect(loadConfig(production({ TRUST_PROXY: '0' })).trustProxy).toBe(0);
    expect(problemsOf(production({ TRUST_PROXY: 'true' }))).toContain('TRUST_PROXY');
  });

  it('refuses local disk storage in production', () => {
    expect(problemsOf(production({ STORAGE_DRIVER: 'local' }))).toContain(
      'STORAGE_DRIVER=local is not allowed in production',
    );
  });

  it('names every missing S3 setting', () => {
    const message = problemsOf(production({ S3_BUCKET: undefined, S3_SECRET_ACCESS_KEY: '' }));
    expect(message).toContain('S3 storage needs S3_BUCKET, S3_SECRET_ACCESS_KEY');
  });

  it('requires an https storage endpoint without a path (http only for localhost)', () => {
    expect(problemsOf(production({ S3_ENDPOINT: 'http://files.example.com' }))).toContain(
      'S3_ENDPOINT must use https',
    );
    expect(problemsOf(production({ S3_ENDPOINT: 'https://x.example.com/bucket' }))).toContain(
      'S3_ENDPOINT must not include a path',
    );
    expect(
      loadConfig(production({ S3_ENDPOINT: 'http://127.0.0.1:9000' })).storage.s3.endpoint,
    ).toBe('http://127.0.0.1:9000');
  });

  it('requires bare https browser origins in production', () => {
    expect(problemsOf(production({ CLIENT_ORIGINS: 'http://training-lms.vercel.app' }))).toContain(
      'must use https in production',
    );
    expect(
      problemsOf(production({ CLIENT_ORIGINS: 'https://training-lms.vercel.app/' })),
    ).toContain('must be an origin only');
    expect(problemsOf(production({ CLIENT_ORIGINS: '*' }))).toContain('is not a URL');
    expect(problemsOf(production({ CLIENT_ORIGINS: ' , ' }))).toContain(
      'CLIENT_ORIGINS must list at least one origin',
    );
  });

  it('refuses insecure cookies in production and SameSite=None without Secure', () => {
    expect(problemsOf(production({ COOKIE_SECURE: 'false' }))).toContain(
      'COOKIE_SECURE cannot be false in production',
    );
    const development = { MONGODB_URI: 'mongodb://127.0.0.1/lms', JWT_ACCESS_SECRET: JWT };
    expect(problemsOf({ ...development, COOKIE_SAMESITE: 'none' })).toContain(
      'COOKIE_SAMESITE=none requires secure cookies',
    );
  });

  it('reports every problem at once', () => {
    const message = problemsOf(
      production({ TRUST_PROXY: undefined, STORAGE_DRIVER: 'local', COOKIE_SECURE: 'false' }),
    );
    expect(message.split('\n').filter((line) => line.startsWith('  - '))).toHaveLength(3);
  });

  it('never echoes secret values in its errors', () => {
    const messages = [
      problemsOf(production({ JWT_ACCESS_SECRET: 'short-secret-value' })),
      problemsOf(production({ MONGODB_URI: `postgres://user:${DB_PASSWORD}@db` })),
      problemsOf(production({ S3_ENDPOINT: `not a url ${S3_SECRET}` })),
      problemsOf(production({ ORIGIN_SECRET: 'too-short-origin-secret' })),
      problemsOf(production({ TRUST_PROXY: undefined })),
      problemsOf(production({ ORIGIN_SECRET_PREVIOUS: ORIGIN })),
    ];
    for (const message of messages) {
      for (const secret of [
        'short-secret-value',
        DB_PASSWORD,
        S3_SECRET,
        'too-short-origin-secret',
        JWT,
        ORIGIN,
      ]) {
        expect(message).not.toContain(secret);
      }
    }
  });
});

describe('redactSecrets', () => {
  it('masks connection-string credentials and configured secrets', () => {
    const text = redactSecrets(
      `connect mongodb+srv://lms-api:${DB_PASSWORD}@cluster0.example.net failed; key ${config.auth.accessSecret}`,
    );
    expect(text).toBe('connect mongodb+srv://***@cluster0.example.net failed; key ***');
  });

  it('masks the origin secrets', () => {
    const saved = config.originSecrets;
    config.originSecrets = [ORIGIN, ORIGIN_OLD];
    try {
      expect(redactSecrets(`header ${ORIGIN} or ${ORIGIN_OLD}`)).toBe('header *** or ***');
    } finally {
      config.originSecrets = saved;
    }
  });
});
