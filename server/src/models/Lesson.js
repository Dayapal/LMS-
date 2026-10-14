import mongoose from 'mongoose';
import { CONTENT_STATUS } from './constants.js';

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    // Short roadmap blurb. Full notes are study materials (Phase 3).
    summary: { type: String, trim: true, maxlength: 300, default: '' },
    objectives: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    prerequisites: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    estimatedMinutes: { type: Number, min: 0, max: 1440, default: 0 },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.DRAFT,
    },
  },
  { timestamps: true },
);

lessonSchema.index({ module: 1, order: 1 });
lessonSchema.index({ course: 1, status: 1 });
lessonSchema.index({ course: 1, slug: 1 }, { unique: true });

export const Lesson = mongoose.model('Lesson', lessonSchema);
