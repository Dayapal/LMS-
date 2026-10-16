import mongoose from 'mongoose';
import { CODE_LANGUAGES, SUBMISSION_STATUS, SUBMISSION_TYPES } from './constants.js';

const { ObjectId } = mongoose.Schema.Types;

/** One handed-in piece of work: a link, an uploaded PDF, or pasted code. */
const itemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(SUBMISSION_TYPES), required: true },
    url: { type: String, trim: true, maxlength: 2048 },
    file: { type: ObjectId, ref: 'FileAsset' },
    code: {
      type: new mongoose.Schema(
        {
          language: { type: String, enum: CODE_LANGUAGES, required: true },
          source: { type: String, required: true, maxlength: 102_400 },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { _id: false },
);

/**
 * One attempt at an assignment. Every attempt is its own document, which is
 * the student's submission history. `isLate` and `review.finalMarks` are set
 * by the server, never taken from a request.
 */
const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: ObjectId, ref: 'Assignment', required: true },
    // Copied from the assignment for course-wide queries and cleanup.
    course: { type: ObjectId, ref: 'Course', required: true },
    student: { type: ObjectId, ref: 'User', required: true },
    attempt: { type: Number, required: true, min: 1 },
    items: {
      type: [itemSchema],
      validate: [(items) => items.length > 0, 'A submission needs at least one item'],
    },
    note: { type: String, trim: true, maxlength: 2000, default: '' },
    submittedAt: { type: Date, required: true },
    editedAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.SUBMITTED,
    },
    review: {
      type: new mongoose.Schema(
        {
          marks: { type: Number, min: 0, default: null },
          finalMarks: { type: Number, min: 0, default: null },
          feedback: { type: String, trim: true, maxlength: 10_000, default: '' },
          reviewedBy: { type: ObjectId, ref: 'User' },
          reviewedAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

submissionSchema.index({ assignment: 1, student: 1, attempt: 1 }, { unique: true });
submissionSchema.index({ course: 1, status: 1 });
submissionSchema.index({ student: 1, submittedAt: -1 });
submissionSchema.index({ 'items.file': 1 }, { sparse: true });

export const Submission = mongoose.model('Submission', submissionSchema);
