import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyOrigin } from '../middleware/verifyOrigin.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

export function authRoutes(limiters) {
  const router = Router();
  router.post('/register', limiters.credentials, validate({ body: registerSchema }), auth.register);
  router.post('/login', limiters.credentials, validate({ body: loginSchema }), auth.login);
  router.post('/refresh', limiters.refresh, verifyOrigin, auth.refresh);
  router.post('/logout', verifyOrigin, auth.logout);
  router.get('/me', authenticate, auth.me);
  return router;
}
