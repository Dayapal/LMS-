import { z } from 'zod';
import { password, personName, httpsUrl } from './common.js';

export const updateProfileSchema = z
  .object({
    name: personName.optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional(),
    avatarUrl: z.union([httpsUrl, z.literal('')]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(200),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });
