import { z } from 'zod';
import {
  CODE_LANGUAGES,
  CONTENT_STATUS,
  FILE_PURPOSES,
  MATERIAL_TYPES,
} from '../models/constants.js';
import { httpsUrl } from './common.js';
import { objectId } from './content.validators.js';

const fields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  status: z.enum(Object.values(CONTENT_STATUS)),
  body: z
    .string()
    .trim()
    .min(1, 'Write the note before saving')
    .max(50_000, 'Notes must be at most 50,000 characters'),
  language: z.enum(CODE_LANGUAGES, { error: 'Choose a supported language' }),
  // Not trimmed: leading indentation is part of the code.
  source: z
    .string()
    .max(100_000, 'Code must be at most 100,000 characters')
    .refine((value) => value.trim().length > 0, 'Add some code'),
  caption: z.string().trim().max(500, 'Caption must be at most 500 characters'),
  fileId: objectId,
  downloadable: z.boolean(),
  url: httpsUrl,
  description: z.string().trim().max(500, 'Description must be at most 500 characters'),
};

const common = { title: fields.title, status: fields.status.default(CONTENT_STATUS.DRAFT) };

export const createMaterialSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal(MATERIAL_TYPES.NOTE), ...common, body: fields.body }),
    z.object({
      type: z.literal(MATERIAL_TYPES.CODE),
      ...common,
      language: fields.language,
      source: fields.source,
      caption: fields.caption.default(''),
    }),
    z.object({
      type: z.literal(MATERIAL_TYPES.FILE),
      ...common,
      fileId: fields.fileId,
      downloadable: fields.downloadable.default(true),
    }),
    z.object({
      type: z.literal(MATERIAL_TYPES.LINK),
      ...common,
      url: fields.url,
      description: fields.description.default(''),
    }),
  ],
  { error: 'Choose a material type: note, code, file or link' },
);

/** Any subset of fields; the service rejects ones that don't belong to the material's type. */
export const updateMaterialSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const uploadFileSchema = z.object({
  // Students upload submission files through POST /assignments/:id/files instead.
  purpose: z.enum([FILE_PURPOSES.MATERIAL, FILE_PURPOSES.ASSIGNMENT], {
    error: 'Unsupported upload purpose',
  }),
  courseId: objectId,
});

export const fileQuery = z.object({ download: z.enum(['0', '1']).optional() });
