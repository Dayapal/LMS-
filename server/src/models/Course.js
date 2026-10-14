import mongoose from 'mongoose';
import { CONTENT_STATUS, COURSE_LEVELS } from './constants.js';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 140 },
    summary: { type: String, trim: true, maxlength: 300, default: '' },
    description: { type: String, trim: true, maxlength: 10_000, default: '' },
    // Phase 3 adds uploaded thumbnails (FileAsset); until then an https URL.
    thumbnailUrl: { type: String, trim: true, maxlength: 2048 },
    level: { type: String, enum: COURSE_LEVELS, default: 'beginner' },
    estimatedHours: { type: Number, min: 0, max: 2000, default: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.DRAFT,
    },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

courseSchema.index({ slug: 1 }, { unique: true });
courseSchema.index({ status: 1, createdAt: -1 });

export const Course = mongoose.model('Course', courseSchema);
