import mongoose from 'mongoose';
import { CONTENT_STATUS } from './constants.js';

export const STUDY_CATEGORIES = Object.freeze(['dsa', 'javascript', 'react']);

const studyBookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 140 },
    category: { type: String, required: true, enum: STUDY_CATEGORIES },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.PUBLISHED,
    },
    gradient: { type: String, trim: true, default: 'linear-gradient(135deg, #03AED2 0%, #D12052 100%)' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

studyBookSchema.index({ slug: 1 }, { unique: true });
studyBookSchema.index({ status: 1, order: 1 });

export const StudyBook = mongoose.model('StudyBook', studyBookSchema);

