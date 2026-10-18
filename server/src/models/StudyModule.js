import mongoose from 'mongoose';
import { CONTENT_STATUS } from './constants.js';

const studyModuleSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyBook', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phaseLabel: { type: String, trim: true, maxlength: 100, default: '' },
    originalFilename: { type: String, required: true, trim: true, immutable: true },
    sourcePath: { type: String, required: true, trim: true, immutable: true },
    fileHash: { type: String, required: true, trim: true, immutable: true },
    fileBytes: { type: Number, required: true, min: 0 },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.PUBLISHED,
    },
    prerequisites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StudyModule' }],
      default: [],
    },
    linkedAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
    },
    estimatedMinutes: { type: Number, min: 0, max: 1440, default: 45 },
  },
  { timestamps: true },
);

studyModuleSchema.index({ book: 1, slug: 1 }, { unique: true });
studyModuleSchema.index({ book: 1, order: 1 });
studyModuleSchema.index({ fileHash: 1 });

export const StudyModule = mongoose.model('StudyModule', studyModuleSchema);
