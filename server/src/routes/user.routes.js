import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, updateProfileSchema } from '../validators/user.validators.js';

export function userRoutes(limiters) {
  const router = Router();
  router.use(authenticate);
  router.patch('/me', validate({ body: updateProfileSchema }), users.updateMe);
  router.patch(
    '/me/password',
    limiters.credentials,
    validate({ body: changePasswordSchema }),
    users.changePassword,
  );
  return router;
}
