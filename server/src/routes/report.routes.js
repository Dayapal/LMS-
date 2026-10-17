import { Router } from 'express';
import * as trainer from '../controllers/trainer.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { courseReportQuery, courseReportsQuery } from '../validators/admin.validators.js';
import { idParams } from '../validators/content.validators.js';

/** Course and student reports. Trainer only. */
export function reportRoutes() {
  const router = Router();
  router.use(authenticate, requireRole(ROLES.ADMIN));
  router.get('/courses', validate({ query: courseReportsQuery }), trainer.courseReports);
  router.get(
    '/courses/:id',
    validate({ params: idParams, query: courseReportQuery }),
    trainer.courseReport,
  );
  router.get('/students/:id', validate({ params: idParams }), trainer.studentReport);
  return router;
}
