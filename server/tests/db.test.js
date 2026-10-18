import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ensureIndexes } from '../src/config/db.js';

describe('ensureIndexes (run at startup)', () => {
  it('waits for every model’s indexes and reports none failed', async () => {
    const result = await ensureIndexes();
    expect(result).toEqual({ built: Object.keys(mongoose.models).length, failed: 0 });
    const indexes = await mongoose.connection.db.collection('fileassets').indexes();
    expect(indexes.map((i) => i.name)).toContain('storageKey_1');
  });
});
