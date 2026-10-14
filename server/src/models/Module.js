import mongoose from 'mongoose';
import { CONTENT_STATUS } from './constants.js';

const moduleSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.DRAFT,
    },
  },
  { timestamps: true },
);

moduleSchema.index({ course: 1, order: 1 });

// `Module` would shadow the Node global in some tooling, so the model is CourseModule.
export const CourseModule = mongoose.model('Module', moduleSchema);
