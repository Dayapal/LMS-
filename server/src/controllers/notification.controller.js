import * as notifications from '../services/notification.service.js';
import { refreshDeadlineReminders } from '../services/deadlineReminders.js';
import { ok } from '../utils/respond.js';

// Every handler works on the signed-in user's own notifications only.

export async function list(req, res) {
  await refreshDeadlineReminders(req.user);
  const { items, meta } = await notifications.listNotifications(req.user, req.valid.query);
  ok(res, items, { meta });
}

export async function unreadCount(req, res) {
  await refreshDeadlineReminders(req.user);
  ok(res, { count: await notifications.countUnread(req.user) });
}

export async function markRead(req, res) {
  const { notification, unread } = await notifications.markRead(req.user, req.valid.params.id);
  ok(res, notification, { meta: { unread } });
}

export async function markAllRead(req, res) {
  const { updated } = await notifications.markAllRead(req.user);
  ok(res, { updated }, { meta: { unread: 0 } });
}
