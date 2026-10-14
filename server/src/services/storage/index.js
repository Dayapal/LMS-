import { config } from '../../config/env.js';
import { localStorage } from './local.js';

/**
 * StorageProvider interface:
 *   name                     identifier stored on each FileAsset (`provider`)
 *   put(key, buffer)         stores new bytes; never overwrites
 *   size(key)                byte size, or null when missing
 *   createReadStream(key)    readable stream of the bytes
 *   remove(key)              deletes; a missing file is not an error
 *
 * Phase 8 adds an S3-compatible driver behind the same interface.
 */
const DRIVERS = { local: localStorage };

export function getStorage(name = config.storage.driver) {
  const driver = DRIVERS[name];
  if (!driver) throw new Error(`Unknown storage driver: ${name}`);
  return driver;
}
