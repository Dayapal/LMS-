import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
      JWT_ACCESS_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars',
      BCRYPT_ROUNDS: '4',
      CLIENT_ORIGINS: 'http://localhost:5173',
      RATE_LIMIT_MAX: '10000',
      AUTH_RATE_LIMIT_MAX: '10000',
      REFRESH_RATE_LIMIT_MAX: '10000',
    },
  },
});
