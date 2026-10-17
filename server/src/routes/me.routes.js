import { Router } from 'express';
import * as progress from '../controllers/progress.controller.js';
import * as trainer from '../controllers/trainer.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { listMyAssignmentsQuery } from '../validators/progress.validators.js';

/** The signed-in student's own learning data. Ownership always comes from the token's user. */
export function meRoutes() {
  const router = Router();
  router.use(authenticate, requireRole(ROLES.STUDENT));
  router.get('/courses', progress.myCourses);
  router.get('/assignments', validate({ query: listMyAssignmentsQuery }), progress.myAssignments);
  return router;
}

/** Dashboards: each role gets only its own. */
export function dashboardRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/student', requireRole(ROLES.STUDENT), progress.studentDashboard);
  router.get('/admin', requireRole(ROLES.ADMIN), trainer.dashboard);
  return router;
}
