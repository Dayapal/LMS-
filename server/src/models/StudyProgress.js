import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/**
 * Tracks a student's reading telemetry, active reading duration,
 * and completion status for a single study module.
 */
const studyProgressSchema = new mongoose.Schema(
  {
    student: { type: ObjectId, ref: 'User', required: true },
    book: { type: ObjectId, ref: 'StudyBook', required: true },
    module: { type: ObjectId, ref: 'StudyModule', required: true },
    firstOpenedAt: { type: Date, default: Date.now },
    lastAccessedAt: { type: Date, default: Date.now },
    totalReadingSeconds: { type: Number, default: 0, min: 0 },
    lastScrollPosition: { type: Number, default: 0, min: 0, max: 100 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studyProgressSchema.index({ student: 1, module: 1 }, { unique: true });
studyProgressSchema.index({ student: 1, book: 1 });
studyProgressSchema.index({ student: 1, isCompleted: 1 });
studyProgressSchema.index({ module: 1 });

export const StudyProgress = mongoose.model('StudyProgress', studyProgressSchema);

