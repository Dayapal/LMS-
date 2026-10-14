import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { config } from '../src/config/env.js';
// Applies the same global Mongoose settings as the server (sanitizeFilter, strictQuery).
import '../src/config/db.js';
import '../src/models/index.js';

// Each test file gets its own throwaway database on the local MongoDB server
// and its own upload directory.
const runId = `${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const dbName = `lms_test_${runId}`;
config.storage.localDir = path.join(os.tmpdir(), `lms_test_uploads_${runId}`);

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName, serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.syncIndexes();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all([
    ...collections.map((collection) => collection.deleteMany({})),
    fs.rm(config.storage.localDir, { recursive: true, force: true }),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await fs.rm(config.storage.localDir, { recursive: true, force: true });
});
