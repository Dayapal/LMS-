import { Router } from 'express';
import mongoose from 'mongoose';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';

export function apiRoutes(limiters) {
  const router = Router();

  router.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      success: dbUp,
      data: { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' },
    });
  });

  router.use(limiters.general);
  router.use('/auth', authRoutes(limiters));
  router.use('/users', userRoutes(limiters));
  return router;
}
