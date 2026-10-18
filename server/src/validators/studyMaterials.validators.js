import { z } from 'zod';
import { CONTENT_STATUS } from '../models/constants.js';
import { objectId } from './content.validators.js';

export const updateStudyModuleSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200).optional(),
  phaseLabel: z.string().trim().max(100).optional(),
  status: z.enum(Object.values(CONTENT_STATUS)).optional(),
  order: z.coerce.number().int().min(0).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  linkedAssignment: z.union([objectId, z.null()]).optional(),
});

export const updateStudyBookSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(Object.values(CONTENT_STATUS)).optional(),
  order: z.coerce.number().int().min(0).optional(),
  gradient: z.string().trim().max(200).optional(),
});

export const updateStudentAccessSchema = z.object({
  bookId: objectId,
  isBookAssigned: z.boolean().optional(),
  releasedModuleIds: z.array(objectId).optional(),
  canViewReport: z.boolean().optional(),
});

export const bulkUpdateStudentAccessSchema = z.object({
  studentIds: z.array(objectId).min(1, 'At least one student must be selected'),
  bookId: objectId,
  isBookAssigned: z.boolean().optional(),
  releasedModuleIds: z.array(objectId).optional(),
});

export const heartbeatSchema = z.object({
  activeSeconds: z.coerce.number().int().min(1, 'activeSeconds must be at least 1').max(300, 'activeSeconds cannot exceed 300'),
  scrollPosition: z.coerce.number().int().min(0).max(100).optional(),
});

