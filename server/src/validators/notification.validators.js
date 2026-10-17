import { z } from 'zod';
import { pageQuery } from './content.validators.js';

/** GET /notifications */
export const listNotificationsQuery = z.object({
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['all', 'unread']).default('all'),
});
