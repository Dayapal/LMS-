import mongoose from 'mongoose';
import { CONTENT_STATUS, SUBMISSION_TYPES } from './constants.js';

const { ObjectId } = mongoose.Schema.Types;

/**
 * A piece of work students hand in. It belongs to a course and optionally to
 * one of its modules or lessons (a lesson implies its module). Late work is
 * accepted until `latePolicy.lateUntil` when `allowLate` is set, and loses
 * `penaltyPercent` of its marks.
 */
const assignmentSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true },
    module: { type: ObjectId, ref: 'Module', default: null },
    lesson: { type: ObjectId, ref: 'Lesson', default: null },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    instructions: { type: String, trim: true, maxlength: 20_000, default: '' },
    objectives: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    dueAt: { type: Date, required: true },
    maxMarks: { type: Number, required: true, min: 1, max: 1000 },
    allowedSubmissionTypes: {
      type: [{ type: String, enum: Object.values(SUBMISSION_TYPES) }],
      validate: [(types) => types.length > 0, 'At least one submission type is required'],
    },
    attachments: { type: [{ type: ObjectId, ref: 'FileAsset' }], default: [] },
    latePolicy: {
      allowLate: { type: Boolean, default: false },
      lateUntil: { type: Date, default: null },
      penaltyPercent: { type: Number, min: 0, max: 100, default: 0 },
    },
    // null means unlimited attempts.
    maxAttempts: { type: Number, min: 1, max: 20, default: null },
    status: {
      type: String,
      enum: Object.values(CONTENT_STATUS),
      default: CONTENT_STATUS.DRAFT,
    },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

assignmentSchema.index({ course: 1, status: 1, dueAt: 1 });
assignmentSchema.index({ module: 1 });
assignmentSchema.index({ lesson: 1 });
assignmentSchema.index({ attachments: 1 });

export const Assignment = mongoose.model('Assignment', assignmentSchema);
