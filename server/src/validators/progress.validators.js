import { z } from 'zod';
import { STUDENT_ASSIGNMENT_STATUS } from '../models/constants.js';
import { objectId, pageQuery } from './content.validators.js';

export const listMyAssignmentsQuery = z.object({
  ...pageQuery,
  limit: pageQuery.limit.default(20),
  status: z.enum(Object.values(STUDENT_ASSIGNMENT_STATUS)).optional(),
  course: objectId.optional(),
});
