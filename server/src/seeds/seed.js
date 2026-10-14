import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { seedAdmin } from './admin.seed.js';

async function main() {
  await connectDatabase(config.mongoUri);

  const admin = await seedAdmin({
    name: config.seed.adminName,
    email: config.seed.adminEmail,
    password: config.seed.adminPassword,
  });
  logger.info(
    `Trainer account ${admin.created ? 'created' : 'already exists'}: ${admin.user.email}`,
  );

  // Course, roadmap and demo data seeds are added in later phases.
}

main()
  .catch((error) => {
    logger.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
