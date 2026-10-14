import { z } from 'zod';

// Mirrors server/src/validators/material.validators.js.

const title = z
  .string()
  .trim()
  .min(3, 'Title must be at least 3 characters')
  .max(140, 'Title must be at most 140 characters');

const status = z.enum(['draft', 'published', 'archived']);

export const noteFormSchema = z.object({
  title,
  status,
  body: z
    .string()
    .trim()
    .min(1, 'Write the note before saving')
    .max(50_000, 'Notes must be at most 50,000 characters'),
});

export const codeFormSchema = z.object({
  title,
  status,
  language: z.string().min(1, 'Choose a language'),
  source: z
    .string()
    .max(100_000, 'Code must be at most 100,000 characters')
    .refine((value) => value.trim().length > 0, 'Add some code'),
  caption: z.string().trim().max(500, 'Caption must be at most 500 characters'),
});

export const linkFormSchema = z.object({
  title,
  status,
  url: z
    .string()
    .trim()
    .min(1, 'Enter the link address')
    .pipe(z.url({ protocol: /^https$/, error: 'Must be a valid https:// URL' })),
  description: z.string().trim().max(500, 'Description must be at most 500 characters'),
});

export const fileFormSchema = z.object({
  title,
  status,
  downloadable: z.boolean(),
});

/** Upload rules for study material files (spec §8). The server checks them again. */
export const MATERIAL_FILE_RULES = {
  maxBytes: 20 * 1024 * 1024,
  extensions: ['pdf', 'docx', 'pptx'],
  accept:
    '.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** A message describing why `file` can't be uploaded, or null when it looks fine. */
export function checkMaterialFile(file) {
  if (!file) return 'Choose a file to upload';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!file.name.includes('.') || !MATERIAL_FILE_RULES.extensions.includes(extension)) {
    return 'Only PDF, DOCX and PPTX files are allowed';
  }
  if (file.size === 0) return 'The file is empty';
  if (file.size > MATERIAL_FILE_RULES.maxBytes) return 'Files must be 20 MB or smaller';
  return null;
}
