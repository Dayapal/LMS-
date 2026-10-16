import mongoose from 'mongoose';
import { FILE_PURPOSES } from './constants.js';

/**
 * Metadata for an uploaded file. The bytes live in the storage provider under
 * a random `storageKey` and are only ever streamed through GET /files/:id,
 * after the access service has approved the request.
 */
const fileAssetSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    checksum: { type: String, required: true }, // sha256, hex
    purpose: { type: String, enum: Object.values(FILE_PURPOSES), required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    // Submission files belong to one assignment (and are owned by `uploadedBy`).
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

fileAssetSchema.index({ storageKey: 1 }, { unique: true });
fileAssetSchema.index({ course: 1, purpose: 1 });
fileAssetSchema.index({ assignment: 1, uploadedBy: 1 });

export const FileAsset = mongoose.model('FileAsset', fileAssetSchema);
