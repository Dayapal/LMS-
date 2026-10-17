import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from './constants.js';

const { ObjectId } = mongoose.Schema.Types;

const READ_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * One in-app notification for one user (spec §5). `key` names the event it
 * is about (for example `assignment_published:<id>`) and is unique per user,
 * so a repeated event never creates a second copy. `link` is an in-app path
 * built by the server. Read notifications are removed 90 days after they were
 * read by a TTL index; unread ones stay until they are read.
 */
const notificationSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
  key: { type: String, required: true, maxlength: 200 },
  title: { type: String, required: true, maxlength: 300 },
  body: { type: String, default: '', maxlength: 500 },
  link: { type: String, default: null, maxlength: 300 },
  readAt: { type: Date, default: null },
  // Set by the server, and moved forward when an event refreshes its notification.
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ user: 1, key: 1 }, { unique: true });
// The unread list and count, newest first (`_id` breaks ties, as in the sort).
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1, _id: -1 });
// The full list, newest first.
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
// Documents whose readAt is null never expire.
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: READ_TTL_SECONDS });

export const Notification = mongoose.model('Notification', notificationSchema);
