import mongoose from 'mongoose';
import { ACTIVITY_TYPES } from './constants.js';

const { ObjectId } = mongoose.Schema.Types;

const YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * One learning event about a student (spec §5): append-only, and removed
 * after a year by a TTL index. It feeds the trainer's recent activity and the
 * student reports. The spec's single `ref` is split into typed references
 * (lesson, assignment, submission) so their titles can be populated. Nothing
 * secret is stored: no passwords, tokens, IP addresses or submitted work.
 */
const activitySchema = new mongoose.Schema(
  {
    // The student the event is about.
    user: { type: ObjectId, ref: 'User', required: true },
    // Who caused it, when that isn't the student (the trainer approving, reviewing, …).
    actor: { type: ObjectId, ref: 'User', default: null },
    type: { type: String, enum: Object.values(ACTIVITY_TYPES), required: true },
    course: { type: ObjectId, ref: 'Course', default: null },
    lesson: { type: ObjectId, ref: 'Lesson', default: null },
    assignment: { type: ObjectId, ref: 'Assignment', default: null },
    submission: { type: ObjectId, ref: 'Submission', default: null },
    attempt: { type: Number, min: 1, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Also serves "latest events first" across all students (an index can be read backwards).
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: YEAR_SECONDS });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ course: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
