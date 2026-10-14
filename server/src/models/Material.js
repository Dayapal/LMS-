import mongoose from 'mongoose';
import { CODE_LANGUAGES, CONTENT_STATUS, MATERIAL_TYPES } from './constants.js';

/**
 * One ordered content block inside a lesson. Only the fields of its `type`
 * are set: note → body; code → language, source, caption; file → file,
 * downloadable; link → url, description.
 */
const materialSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    // Denormalized from the lesson for access checks and course-wide cleanup.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    type: { type: String, enum: Object.values(MATERIAL_TYPES), required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.DRAFT,
    },
    body: { type: String, maxlength: 50_000 },
    language: { type: String, enum: CODE_LANGUAGES },
    source: { type: String, maxlength: 100_000 },
    caption: { type: String, trim: true, maxlength: 500 },
    file: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' },
    downloadable: Boolean,
    url: { type: String, trim: true, maxlength: 2048 },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

materialSchema.index({ lesson: 1, order: 1 });
materialSchema.index({ course: 1 });
materialSchema.index({ file: 1 }, { sparse: true });

export const Material = mongoose.model('Material', materialSchema);
