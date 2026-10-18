import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { FileAsset } from '../models/index.js';
import { deleteFilesIfUnused, filesInUse } from './file.service.js';
import { getStorage } from './storage/index.js';

/**
 * Operator tools behind `npm run files -- <command>` (src/scripts/files.js).
 * Every command is a dry run unless `apply` is set, never deletes a record
 * whose bytes are merely unreachable, and never overwrites stored bytes.
 */

const { trusted } = mongoose;
const HOUR = 60 * 60 * 1000;

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** The providers worth inspecting: the configured one plus any that records use. */
async function providersInUse() {
  const names = new Set([config.storage.driver, ...(await FileAsset.distinct('provider'))]);
  return [...names];
}

/**
 * Finds (and with `apply`, removes):
 * - unattached files: records older than `olderThanHours` that no material,
 *   assignment or submission uses (an upload whose save then failed);
 * - stray objects: stored bytes older than that with no record at all (a
 *   delete whose storage call failed).
 * Reports, but never touches: records whose bytes are missing, objects whose
 * key the server didn't create, and copies superseded by a migration.
 */
export async function cleanupFiles({ apply = false, olderThanHours = 24, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - olderThanHours * HOUR);
  const report = {
    apply,
    olderThanHours,
    unattached: [],
    missingBytes: [],
    unreachable: [],
    strayObjects: [],
    supersededCopies: 0,
    foreignObjects: 0,
    deleted: { unattached: 0, strayObjects: 0 },
  };

  const old = await FileAsset.find({ createdAt: trusted({ $lt: cutoff }) })
    .select('_id purpose size provider createdAt')
    .lean();
  const used = await filesInUse(old.map((f) => f._id));
  report.unattached = old
    .filter((f) => !used.has(String(f._id)))
    .map((f) => ({ id: String(f._id), purpose: f.purpose, size: f.size, createdAt: f.createdAt }));

  const records = await FileAsset.find().select('_id provider storageKey').lean();
  const keysByProvider = new Map();
  const allKeys = new Set();
  for (const record of records) {
    allKeys.add(record.storageKey);
    if (!keysByProvider.has(record.provider)) keysByProvider.set(record.provider, new Set());
    keysByProvider.get(record.provider).add(record.storageKey);
  }

  for (const provider of await providersInUse()) {
    let storage;
    try {
      storage = getStorage(provider);
    } catch {
      report.unreachable.push({ provider, reason: 'not configured' });
      continue;
    }
    const known = keysByProvider.get(provider) ?? new Set();
    const listed = new Set();
    for await (const object of storage.list()) {
      listed.add(object.key);
      if (object.foreign) report.foreignObjects += 1;
      else if (known.has(object.key)) continue;
      else if (allKeys.has(object.key)) report.supersededCopies += 1;
      else if (object.lastModified < cutoff) {
        report.strayObjects.push({ provider, key: object.key, size: object.size });
      }
    }
    for (const record of records) {
      if (record.provider === provider && !listed.has(record.storageKey)) {
        report.missingBytes.push({ id: String(record._id), provider });
      }
    }
  }

  if (apply) {
    const before = await FileAsset.countDocuments();
    // Usage is checked again at deletion time.
    await deleteFilesIfUnused(report.unattached.map((f) => f.id));
    report.deleted.unattached = before - (await FileAsset.countDocuments());
    for (const object of report.strayObjects) {
      // Re-check: a record may have been created since the listing.
      if (await FileAsset.exists({ storageKey: object.key })) continue;
      await getStorage(object.provider).remove(object.key);
      report.deleted.strayObjects += 1;
    }
  }
  return report;
}

/**
 * Copies every file whose record names another provider into `to` and then
 * points the record at it. The source bytes are kept, so rolling back is
 * running the same command towards the old provider. Bytes are checked
 * against the record's SHA-256 before and after copying.
 */
export async function migrateFiles({ to, apply = false }) {
  const target = getStorage(to);
  const files = await FileAsset.find({ provider: trusted({ $ne: to }) })
    .select('_id provider storageKey mimeType size checksum')
    .lean();
  const report = { to, apply, total: files.length, migrated: 0, alreadyCopied: 0, problems: [] };
  if (!apply) return report;

  for (const file of files) {
    const problem = (reason) => report.problems.push({ id: String(file._id), reason });
    try {
      const opened = await getStorage(file.provider).open(file.storageKey);
      if (!opened) {
        problem(`missing in ${file.provider}`);
        continue;
      }
      const bytes = await readAll(opened.stream);
      if (sha256(bytes) !== file.checksum) {
        problem('checksum mismatch at the source');
        continue;
      }
      const existing = await target.size(file.storageKey);
      if (existing === null) {
        await target.put(file.storageKey, bytes, { contentType: file.mimeType });
      } else if (existing !== bytes.length) {
        problem(`a different object already exists in ${to}`);
        continue;
      } else {
        report.alreadyCopied += 1;
      }
      const copy = await target.open(file.storageKey);
      if (!copy || sha256(await readAll(copy.stream)) !== file.checksum) {
        problem(`the copy in ${to} does not match`);
        continue;
      }
      await FileAsset.updateOne({ _id: file._id, provider: file.provider }, { provider: to });
      report.migrated += 1;
    } catch (error) {
      problem(`${error.name}: ${error.message}`);
    }
  }
  return report;
}

/**
 * Round trip against the configured provider with a tiny temporary object:
 * write, size, read back, delete, confirm it's gone. Touches no existing file.
 */
export async function checkStorage() {
  const storage = getStorage();
  const key = `storagecheck/${crypto.randomUUID()}.txt`;
  const body = Buffer.from(`Training LMS storage check ${new Date().toISOString()}`);
  const steps = [];
  const step = async (name, run) => {
    await run();
    steps.push(name);
  };
  try {
    await step('write', () => storage.put(key, body, { contentType: 'text/plain' }));
    await step('size', async () => {
      if ((await storage.size(key)) !== body.length) throw new Error('size does not match');
    });
    await step('read', async () => {
      const opened = await storage.open(key);
      if (!opened || !(await readAll(opened.stream)).equals(body)) {
        throw new Error('content does not match');
      }
    });
  } finally {
    await storage.remove(key).catch(() => {});
  }
  await step('delete', async () => {
    if ((await storage.size(key)) !== null) throw new Error('object still exists');
  });
  return { provider: storage.name, steps };
}
