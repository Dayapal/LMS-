import mongoose from 'mongoose';

/**
 * One completed lesson of one student. Course progress is never stored: it is
 * computed from these records and the lessons that are currently published,
 * so it stays correct when the trainer adds, unpublishes or archives lessons.
 * Records are kept when a lesson is hidden, and count again if it returns.
 */
const lessonProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Copied from the lesson, which never changes course.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

lessonProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, course: 1 });
// Deletion guards: does anyone have progress in this lesson or course?
lessonProgressSchema.index({ lesson: 1 });
lessonProgressSchema.index({ course: 1 });

export const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);
