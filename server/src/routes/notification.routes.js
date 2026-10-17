import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/content.validators.js';
import { listNotificationsQuery } from '../validators/notification.validators.js';

/** The signed-in user's own notifications (any role). Polled by the client every 60 s. */
export function notificationRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', validate({ query: listNotificationsQuery }), notifications.list);
  router.get('/unread-count', notifications.unreadCount);
  router.patch('/read-all', notifications.markAllRead);
  router.patch('/:id/read', validate({ params: idParams }), notifications.markRead);
  return router;
}
