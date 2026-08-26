/**
 * Notification Module - persists a notification and pushes it over Socket.IO.
 * Every other module calls `notify()`; nothing else writes to the table.
 */
import db from '../../db/index.js';
import { emitToUser } from '../../realtime/hub.js';
import { now } from '../../utils/constants.js';
import { notFound } from '../../utils/errors.js';

export async function notify({ userId, type, title, message, link = null }) {
  if (!userId) return null;
  const created = await db.insertReturning(
    `INSERT INTO notifications (user_id, type, title, message, link, read_status, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     RETURNING *`,
    [userId, type, title ?? '', message, link, now()],
  );
  const unread = await unreadCount(userId);
  emitToUser(userId, 'notification:new', { notification: created, unread });
  return created;
}

/** Fan-out helper for events that concern several people. */
export async function notifyMany(entries) {
  const results = [];
  for (const entry of entries) results.push(await notify(entry));
  return results.filter(Boolean);
}

export async function listForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly) clauses.push('read_status = 0');
  params.push(limit);
  return db.all(
    `SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, notification_id DESC LIMIT ?`,
    params,
  );
}

export async function unreadCount(userId) {
  const row = await db.one('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_status = 0', [
    userId,
  ]);
  return Number(row?.total ?? 0);
}

export async function markRead(userId, notificationId) {
  const existing = await db.one('SELECT * FROM notifications WHERE notification_id = ? AND user_id = ?', [
    notificationId,
    userId,
  ]);
  if (!existing) throw notFound('Notification not found');
  await db.run('UPDATE notifications SET read_status = 1 WHERE notification_id = ?', [notificationId]);
  const unread = await unreadCount(userId);
  emitToUser(userId, 'notification:read', { notificationId, unread });
  return { ...existing, read_status: 1 };
}

export async function markAllRead(userId) {
  const result = await db.run('UPDATE notifications SET read_status = 1 WHERE user_id = ? AND read_status = 0', [
    userId,
  ]);
  emitToUser(userId, 'notification:read', { notificationId: null, unread: 0 });
  return { updated: result.changes ?? 0 };
}
