import { Router } from 'express';
import * as enrollments from '../controllers/enrollment.controller.js';
import * as trainer from '../controllers/trainer.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { listStudentsQuery, reviewQueueQuery } from '../validators/admin.validators.js';
import {
  adminEnrollSchema,
  idParams,
  listEnrollmentsQuery,
  updateEnrollmentSchema,
} from '../validators/content.validators.js';

export function adminRoutes() {
  const router = Router();
  router.use(authenticate, requireRole(ROLES.ADMIN));

  router.get('/enrollments', validate({ query: listEnrollmentsQuery }), enrollments.list);
  router.post('/enrollments', validate({ body: adminEnrollSchema }), enrollments.create);
  router.patch(
    '/enrollments/:id',
    validate({ params: idParams, body: updateEnrollmentSchema }),
    enrollments.update,
  );

  // Phase 6: the review queue across courses and student management.
  router.get('/submissions', validate({ query: reviewQueueQuery }), trainer.reviewQueue);
  router.get('/students', validate({ query: listStudentsQuery }), trainer.students);
  router.get('/students/:id', validate({ params: idParams }), trainer.student);
  return router;
}
