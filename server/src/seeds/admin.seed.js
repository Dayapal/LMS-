import { User, ROLES } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { password as passwordSchema } from '../validators/common.js';

/**
 * Creates the trainer account if it doesn't exist. Never overwrites an
 * existing account, so re-running the seed keeps the trainer's own changes.
 */
export async function seedAdmin({ name, email, password }) {
  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to seed the trainer account');
  }
  const check = passwordSchema.safeParse(password);
  if (!check.success) {
    throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${check.error.issues[0].message}`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      throw new Error(`${normalizedEmail} already exists as a ${existing.role} account`);
    }
    return { user: existing, created: false };
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: ROLES.ADMIN,
  });
  return { user, created: true };
}
