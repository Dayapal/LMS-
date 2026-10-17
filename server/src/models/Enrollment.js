import mongoose from 'mongoose';
import { ENROLLMENT_STATUS } from './constants.js';

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    status: {
      type: String,
      enum: Object.values(ENROLLMENT_STATUS),
      default: ENROLLMENT_STATUS.PENDING,
    },
    // Who made the latest decision: the student (request) or the trainer.
    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    enrolledAt: Date,
    lastLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    lastAccessedAt: Date,
  },
  { timestamps: true },
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });
// Counts and lists by status across courses (dashboard, pending requests).
enrollmentSchema.index({ status: 1, updatedAt: -1 });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
