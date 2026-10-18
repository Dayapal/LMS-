import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { password as passwordSchema } from '../validators/common.js';
import { seedAdmin } from './admin.seed.js';
import {
  removeDemoStudents,
  resetCourseData,
  seedCourses,
  seedAssignments,
  seedDemoStudents,
  seedMaterials,
} from './course.seed.js';
import { seedDemoProgress } from './progress.seed.js';
import { resetStudyMaterials, seedStudyMaterials } from './studyMaterials.seed.js';

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
    await Promise.all([resetCourseData(), removeDemoStudents(), resetStudyMaterials()]);
    logger.warn(
      'Removed all courses, modules, lessons, materials, assignments, submissions, files, enrollments, progress, demo students and study materials (--reset)',
    );
  }

  for (const course of await seedCourses({ createdBy: admin.user._id })) {
    logger.info(`Course ${course.slug}: ${course.created ? 'created' : 'already exists, kept'}`);
  }
  for (const result of await seedMaterials({ createdBy: admin.user._id })) {
    logger.info(
      `Materials for ${result.slug}: added to ${result.added} lessons, ${result.kept} lessons already had materials`,
    );
  }

  for (const result of await seedAssignments({ createdBy: admin.user._id })) {
    logger.info(
      result.added
        ? `Assignments for ${result.slug}: added ${result.added}`
        : `Assignments for ${result.slug}: the course already has assignments, kept`,
    );
  }

  const studyRes = await seedStudyMaterials({ createdBy: admin.user._id });
  logger.info(
    `Study Books: ${studyRes.books.length} books (${studyRes.books.map((b) => b.slug).join(', ')}), ${studyRes.modules.total} modules catalogued (${studyRes.modules.added} added, ${studyRes.modules.updated} kept/updated)`,
  );

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

  const demo = await seedDemoProgress({ reviewer: admin.user._id });
  for (const result of demo.progress) {
    logger.info(
      result.added
        ? `Demo progress for ${result.email} in ${result.slug}: ${result.added} lessons completed`
        : `Demo progress for ${result.email} in ${result.slug}: already has progress, kept`,
    );
  }
  for (const result of demo.submissions) {
    logger.info(
      `Demo submission by ${result.email} for "${result.assignment}": ${result.added ? 'added' : 'already submitted, kept'}`,
    );
  }
}

main()
  .catch((error) => {
    logger.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
