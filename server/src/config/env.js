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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),

  CLIENT_ORIGINS: csv.default(['http://localhost:5173']),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  // Phase 8 adds the S3-compatible driver for production.
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  SEED_ADMIN_NAME: z.string().default('Trainer'),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_DEMO_STUDENT_PASSWORD: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && env.COOKIE_SECURE === 'false') {
    throw new Error('COOKIE_SECURE cannot be false in production');
  }
  if (env.COOKIE_SAMESITE === 'none' && env.COOKIE_SECURE === 'false') {
    throw new Error('COOKIE_SAMESITE=none requires secure cookies');
  }

  return {
    env: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongoUri: env.MONGODB_URI,
    clientOrigins: env.CLIENT_ORIGINS,
    trustProxy: env.TRUST_PROXY,
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
        secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction,
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
