import { config } from '../../config/env.js';
import { localStorage } from './local.js';
import { createS3Storage } from './s3.js';

/**
 * StorageProvider interface:
 *   name                       identifier stored on each FileAsset (`provider`)
 *   put(key, buffer, {contentType})  stores new bytes under a fresh random key
 *   size(key)                  byte size, or null when missing
 *   open(key)                  { size, stream }, or null when missing
 *   remove(key)                deletes; a missing object is not an error
 *   list()                     async iterable of { key, size, lastModified, foreign }
 *
 * Drivers: `local` (development and tests) and `s3` (Cloudflare R2 or any
 * S3-compatible private bucket; required in production). A failing provider
 * throws `StorageError`.
 */
export function getStorage(name = config.storage.driver) {
  if (name === 'local') return localStorage;
  if (name === 's3') {
    // Built per call from the current config: cheap, and tests can repoint it.
    if (!config.storage.s3) throw new Error('The s3 storage driver is not configured');
    return createS3Storage(config.storage.s3);
  }
  throw new Error(`Unknown storage driver: ${name}`);
}
