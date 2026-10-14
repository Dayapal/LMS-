import { z } from 'zod';
import { email, password, personName } from './common.js';

// Unknown keys (role, isActive, tokenVersion, ...) are stripped, never trusted.
export const registerSchema = z.object({
  name: personName,
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});
