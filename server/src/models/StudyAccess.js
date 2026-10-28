import mongoose from 'mongoose';

const studyAccessSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyBook', required: true },
    isBookAssigned: { type: Boolean, default: true },
    releasedModules: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'StudyModule' },
    ],
    canViewReport: { type: Boolean, default: false },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    grantedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

studyAccessSchema.index({ student: 1, book: 1 }, { unique: true });
studyAccessSchema.index({ student: 1 });
studyAccessSchema.index({ book: 1 });

export const StudyAccess = mongoose.model('StudyAccess', studyAccessSchema);

