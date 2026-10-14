import { Router } from 'express';
import * as enrollments from '../controllers/enrollment.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
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
  return router;
}
