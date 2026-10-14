import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { password as passwordSchema } from '../validators/common.js';
import { seedAdmin } from './admin.seed.js';
import {
  removeDemoStudents,
  resetCourseData,
  seedCourses,
  seedDemoStudents,
} from './course.seed.js';

const reset = process.argv.includes('--reset');

async function main() {
  if (reset && config.isProduction) {
    throw new Error('Refusing to run --reset with NODE_ENV=production');
  }
  await connectDatabase(config.mongoUri);

  const admin = await seedAdmin({
    name: config.seed.adminName,
    email: config.seed.adminEmail,
    password: config.seed.adminPassword,
  });
  logger.info(
    `Trainer account ${admin.created ? 'created' : 'already exists'}: ${admin.user.email}`,
  );

  if (reset) {
    await Promise.all([resetCourseData(), removeDemoStudents()]);
    logger.warn('Removed all courses, modules, lessons, enrollments and demo students (--reset)');
  }

  for (const course of await seedCourses({ createdBy: admin.user._id })) {
    logger.info(`Course ${course.slug}: ${course.created ? 'created' : 'already exists, kept'}`);
  }

  const demoPassword = config.seed.demoStudentPassword;
  if (!demoPassword) {
    logger.info('Skipping demo students (set SEED_DEMO_STUDENT_PASSWORD to create them)');
    return;
  }
  const check = passwordSchema.safeParse(demoPassword);
  if (!check.success) {
    throw new Error(`SEED_DEMO_STUDENT_PASSWORD is too weak: ${check.error.issues[0].message}`);
  }
  for (const student of await seedDemoStudents({
    password: demoPassword,
    enrolledBy: admin.user._id,
  })) {
    logger.info(`Demo student ${student.email}: ${student.created ? 'created' : 'already exists'}`);
  }
}

main()
  .catch((error) => {
    logger.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
