import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { config } from '../src/config/env.js';
import '../src/models/index.js';

// Each test file gets its own throwaway database on the local MongoDB server.
const dbName = `lms_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName, serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.syncIndexes();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
