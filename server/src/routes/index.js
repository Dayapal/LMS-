import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { proxyDiagnostics } from '../middleware/proxy.js';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { courseRoutes, lessonRoutes, materialRoutes, moduleRoutes } from './course.routes.js';
import { fileRoutes } from './file.routes.js';
import { adminRoutes } from './admin.routes.js';
import { assignmentRoutes, submissionRoutes } from './assignment.routes.js';
import { dashboardRoutes, meRoutes } from './me.routes.js';
import { reportRoutes } from './report.routes.js';
import { notificationRoutes } from './notification.routes.js';

export function apiRoutes(limiters) {
  const router = Router();

  // Every API response is per user: no browser or CDN (Vercel honours upstream
  // cache headers on rewrites) may store it. Files set `private, no-store` too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Open without the proxy's x-origin-secret (app.js): Render's health checks call it directly.
  router.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      success: dbUp,
      data: { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' },
    });
  });

  if (config.proxyDiagnostics) router.get('/health/proxy', limiters.general, proxyDiagnostics);

  router.use(limiters.general);
  router.use('/auth', authRoutes(limiters));
  router.use('/users', userRoutes(limiters));
  router.use('/courses', courseRoutes());
  router.use('/modules', moduleRoutes());
  router.use('/lessons', lessonRoutes());
  router.use('/materials', materialRoutes());
  router.use('/files', fileRoutes(limiters));
  router.use('/assignments', assignmentRoutes(limiters));
  router.use('/submissions', submissionRoutes());
  router.use('/admin', adminRoutes());
  router.use('/me', meRoutes());
  router.use('/dashboard', dashboardRoutes());
  router.use('/reports', reportRoutes());
  router.use('/notifications', notificationRoutes());
  return router;
}
