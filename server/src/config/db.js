import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// Reject query filters containing `$` operators that came from user input.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

export async function connectDatabase(uri) {
  // Mongoose builds any missing index at startup (autoIndex). It never drops
  // indexes, so an existing Atlas database keeps its data and indexes.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, appName: 'training-lms-api' });
  const { connection } = mongoose;
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  connection.on('error', (error) => logger.error({ name: error.name }, 'MongoDB connection error'));
  logger.info({ db: connection.name }, 'MongoDB connected');
  return connection;
}

/**
 * Waits for every model's indexes. A failed build (for example a unique index
 * over duplicate data) is logged by model name instead of passing silently.
 */
export async function ensureIndexes() {
  const results = await Promise.allSettled(
    Object.values(mongoose.models).map((model) => model.init().then(() => model.modelName)),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  for (const { reason } of failed) {
    logger.error({ name: reason?.name, code: reason?.code }, 'Index build failed');
  }
  return { built: results.length - failed.length, failed: failed.length };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
