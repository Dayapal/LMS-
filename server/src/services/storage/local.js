import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { assertValidKey, isValidKey } from './keys.js';

// Read at call time: tests point the driver at a temporary directory.
const rootDir = () => path.resolve(config.storage.localDir);

function resolveKey(key) {
  assertValidKey(key);
  const root = rootDir();
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid storage key');
  return target;
}

async function statOrNull(key) {
  try {
    return await fs.stat(resolveKey(key));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Stores files on the local disk. Development only: PaaS disks are wiped on redeploy. */
export const localStorage = {
  name: 'local',

  async put(key, buffer) {
    const target = resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
  },

  /** Size in bytes, or null when the file is missing. */
  async size(key) {
    return (await statOrNull(key))?.size ?? null;
  },

  /** `{ size, stream }`, or null when the file is missing. */
  async open(key) {
    const stat = await statOrNull(key);
    return stat && { size: stat.size, stream: createReadStream(resolveKey(key)) };
  },

  async remove(key) {
    await fs.rm(resolveKey(key), { force: true });
  },

  /** Every stored file as `{ key, size, lastModified }` (used by the cleanup script). */
  async *list() {
    let entries;
    try {
      entries = await fs.readdir(rootDir(), { recursive: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const key = entry.replaceAll('\\', '/');
      const stat = await fs.stat(path.join(rootDir(), entry));
      if (!stat.isFile()) continue;
      // Anything the server didn't write (stray files) is still reported, under its path.
      yield { key, size: stat.size, lastModified: stat.mtime, foreign: !isValidKey(key) };
    }
  },
};
