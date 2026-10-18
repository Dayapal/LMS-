import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Upload paths are relative to server/, regardless of the directory the process started in.
const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);
const flag = z.enum(['true', 'false']).default('false');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),

  CLIENT_ORIGINS: csv.default(['http://localhost:5173']),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  // The number of proxies in front of Express. Required in production (see loadConfig).
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  // Temporarily exposes GET /api/v1/health/proxy to measure TRUST_PROXY on a live deployment.
  PROXY_DIAGNOSTICS: flag,
  // Shared with the Vercel proxy, which adds it to every /api request as
  // `x-origin-secret`. Required in production; the API refuses requests without it
  // (except GET /api/v1/health). The previous value is accepted during a rotation.
  ORIGIN_SECRET: z.string().min(32, 'ORIGIN_SECRET must be at least 32 characters').optional(),
  ORIGIN_SECRET_PREVIOUS: z
    .string()
    .min(32, 'ORIGIN_SECRET_PREVIOUS must be at least 32 characters')
    .optional(),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  // `local` for development; production requires `s3` (Cloudflare R2 or another S3-compatible store).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().optional(),
  S3_ENDPOINT: z.url('S3_ENDPOINT must be a URL').optional(),
  S3_REGION: z.string().min(1).default('auto'),
  S3_BUCKET: z.string().min(3, 'S3_BUCKET must be at least 3 characters').optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  SEED_ADMIN_NAME: z.string().default('Trainer'),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_DEMO_STUDENT_PASSWORD: z.string().optional(),
});

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (url) => LOOPBACK_HOSTS.has(url.hostname);

/** Each browser origin must be a bare origin, and https in production (except localhost). */
function originProblems(origins, isProduction) {
  const problems = [];
  if (origins.length === 0) problems.push('CLIENT_ORIGINS must list at least one origin');
  for (const [index, origin] of origins.entries()) {
    const label = `CLIENT_ORIGINS entry ${index + 1}`;
    let url;
    try {
      url = new URL(origin);
    } catch {
      problems.push(`${label} is not a URL`);
      continue;
    }
    if (url.origin !== origin) {
      problems.push(`${label} must be an origin only, like https://app.example.com (no path)`);
    } else if (isProduction && url.protocol !== 'https:' && !isLoopback(url)) {
      problems.push(`${label} must use https in production`);
    }
  }
  return problems;
}

/** The S3 settings, or null when S3 isn't configured. Problems are collected, never values. */
function s3Settings(env, problems) {
  const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  if (env.STORAGE_DRIVER !== 's3' && !required.some((name) => env[name])) return null;
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    problems.push(`S3 storage needs ${missing.join(', ')}`);
    return null;
  }
  const endpoint = new URL(env.S3_ENDPOINT);
  if (endpoint.protocol !== 'https:' && !isLoopback(endpoint)) {
    problems.push('S3_ENDPOINT must use https (http is only allowed for localhost)');
  }
  if (endpoint.pathname !== '/' || endpoint.search) {
    problems.push('S3_ENDPOINT must not include a path; set the bucket in S3_BUCKET');
  }
  return {
    endpoint: endpoint.origin,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  };
}

function fail(problems) {
  // Variable names and rules only: values (secrets, connection strings) are never echoed.
  throw new Error(
    `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
}

/** Validates `source` (process.env by default) and builds the server configuration. */
export function loadConfig(source = process.env) {
  // A blank line such as `S3_BUCKET=` (copied from .env.example) means "not set".
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction;

  const problems = originProblems(env.CLIENT_ORIGINS, isProduction);
  if (isProduction && !cookieSecure) problems.push('COOKIE_SECURE cannot be false in production');
  if (env.COOKIE_SAMESITE === 'none' && !cookieSecure) {
    problems.push('COOKIE_SAMESITE=none requires secure cookies');
  }
  if (isProduction && env.TRUST_PROXY === undefined) {
    problems.push(
      'TRUST_PROXY must be set in production to the number of proxies in front of the API (docs/deployment.md explains how to measure it)',
    );
  }
  if (isProduction && env.STORAGE_DRIVER === 'local') {
    problems.push(
      'STORAGE_DRIVER=local is not allowed in production (the host disk is wiped on redeploy); use s3',
    );
  }
  if (isProduction && !env.ORIGIN_SECRET) {
    problems.push(
      'ORIGIN_SECRET must be set in production: the same value as the Vercel project variable that the /api route sends as x-origin-secret (docs/deployment.md)',
    );
  }
  if (env.ORIGIN_SECRET_PREVIOUS && !env.ORIGIN_SECRET) {
    problems.push('ORIGIN_SECRET_PREVIOUS is only used together with ORIGIN_SECRET');
  }
  if (env.ORIGIN_SECRET && env.ORIGIN_SECRET === env.ORIGIN_SECRET_PREVIOUS) {
    problems.push('ORIGIN_SECRET_PREVIOUS must differ from ORIGIN_SECRET');
  }
  const s3 = s3Settings(env, problems);
  if (problems.length > 0) fail(problems);

  return {
    env: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongoUri: env.MONGODB_URI,
    clientOrigins: env.CLIENT_ORIGINS,
    trustProxy: env.TRUST_PROXY ?? 0,
    proxyDiagnostics: env.PROXY_DIAGNOSTICS === 'true',
    // Accepted values of `x-origin-secret`: the current one, then the previous during a rotation.
    // Empty means the check is off (development and tests only; production requires it).
    originSecrets: [env.ORIGIN_SECRET, env.ORIGIN_SECRET_PREVIOUS].filter(Boolean),
    logLevel: env.LOG_LEVEL,
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTokenTtl: env.ACCESS_TOKEN_TTL,
      refreshTokenTtlMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      refreshReuseGraceMs: env.REFRESH_REUSE_GRACE_SECONDS * 1000,
      bcryptRounds: env.BCRYPT_ROUNDS,
      cookie: {
        name: 'lms_rt',
        path: '/api/v1/auth',
        secure: cookieSecure,
        sameSite: env.COOKIE_SAMESITE,
      },
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      max: env.RATE_LIMIT_MAX,
      authMax: env.AUTH_RATE_LIMIT_MAX,
      refreshMax: env.REFRESH_RATE_LIMIT_MAX,
      uploadWindowMs: 60 * 60 * 1000,
      uploadMax: env.UPLOAD_RATE_LIMIT_MAX,
    },
    notifications: {
      // "Due soon" reminders cover assignments due within this many hours.
      deadlineSoonHours: 24,
      // How often one student's reminders are worked out (they poll every 60 s).
      deadlineCheckIntervalMs: 5 * 60 * 1000,
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: path.resolve(SERVER_DIR, env.UPLOAD_DIR ?? 'uploads'),
      s3,
    },
    seed: {
      adminName: env.SEED_ADMIN_NAME,
      adminEmail: env.SEED_ADMIN_EMAIL,
      adminPassword: env.SEED_ADMIN_PASSWORD,
      demoStudentPassword: env.SEED_DEMO_STUDENT_PASSWORD,
    },
  };
}

// Mutable on purpose: tests adjust limits and timings before building an app.
export const config = loadConfig();

/** Replaces configured secrets and connection-string credentials in `text` (for logs). */
export function redactSecrets(text) {
  let result = String(text).replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, '$1***@');
  const secrets = [
    config.auth.accessSecret,
    ...config.originSecrets,
    config.storage.s3?.secretAccessKey,
    config.storage.s3?.accessKeyId,
  ];
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, '***');
  return result;
}
