/**
 * Communication Module - item-scoped messaging.
 *
 * A conversation always belongs to one item, and only people connected to that
 * item may talk: the reporter, anyone who filed a claim on it, and the owner of
 * a matched counterpart report. Emails are never exposed here.
 */
import db from '../../db/index.js';
import { emitToItem, emitToUser } from '../../realtime/hub.js';
import { MATCH_STATUS, NOTIFICATION_TYPES, ROLES, now } from '../../utils/constants.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import * as itemsRepo from '../items/items.repository.js';
import { notify } from '../notifications/notifications.service.js';

/** Users allowed to discuss one item. */
async function participantsFor(itemId) {
  const item = await itemsRepo.findById(itemId);
  if (!item) throw notFound('Item not found');

  const allowed = new Set([Number(item.user_id)]);

  const claimants = await db.all('SELECT DISTINCT claimant_id FROM claims WHERE item_id = ?', [itemId]);
  for (const row of claimants) allowed.add(Number(row.claimant_id));

  const linked = await db.all(
    `SELECT m.lost_item_id, m.found_item_id, li.user_id AS lost_user, fi.user_id AS found_user
     FROM matches m
     JOIN items li ON li.item_id = m.lost_item_id
     JOIN items fi ON fi.item_id = m.found_item_id
     WHERE (m.lost_item_id = ? OR m.found_item_id = ?) AND m.status <> ?`,
    [itemId, itemId, MATCH_STATUS.REJECTED],
  );
  for (const row of linked) {
    allowed.add(Number(row.lost_user));
    allowed.add(Number(row.found_user));
  }

  return { item, allowed };
}

async function assertCanConverse(itemId, viewer, counterpartId) {
  const { item, allowed } = await participantsFor(itemId);
  const isAdmin = viewer.role === ROLES.ADMIN;
  if (!isAdmin && !allowed.has(Number(viewer.user_id))) {
    throw forbidden('You can only message about items you reported, claimed or matched');
  }
  if (counterpartId != null && !allowed.has(Number(counterpartId)) && !isAdmin) {
    throw forbidden('That person is not part of this item conversation');
  }
  return item;
}

export async function sendMessage(viewer, { item_id, receiver_id, message }) {
  if (Number(receiver_id) === Number(viewer.user_id)) throw badRequest('You cannot message yourself');

  const item = await assertCanConverse(item_id, viewer, receiver_id);
  const receiver = await db.one('SELECT user_id, name FROM users WHERE user_id = ?', [receiver_id]);
  if (!receiver) throw notFound('Recipient not found');

  const created = await db.insertReturning(
    `INSERT INTO messages (sender_id, receiver_id, item_id, message, timestamp)
     VALUES (?, ?, ?, ?, ?)
     RETURNING *`,
    [viewer.user_id, receiver_id, item_id, message, now()],
  );

  const payload = { ...created, sender_name: viewer.name };
  emitToUser(receiver_id, 'message:new', payload);
  emitToUser(viewer.user_id, 'message:new', payload);
  emitToItem(item_id, 'thread:message', payload);

  await notify({
    userId: receiver_id,
    type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
    title: `Message from ${viewer.name}`,
    message: `About "${item.title}": ${message.slice(0, 90)}${message.length > 90 ? '...' : ''}`,
    link: `/messages/${item_id}/${viewer.user_id}`,
  });

  return payload;
}

export async function conversation(viewer, itemId, counterpartId) {
  await assertCanConverse(itemId, viewer, counterpartId);
  const rows = await db.all(
    `SELECT m.*, s.name AS sender_name, r.name AS receiver_name
     FROM messages m
     JOIN users s ON s.user_id = m.sender_id
     JOIN users r ON r.user_id = m.receiver_id
     WHERE m.item_id = ?
       AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
     ORDER BY m.timestamp ASC, m.message_id ASC`,
    [itemId, viewer.user_id, counterpartId, counterpartId, viewer.user_id],
  );

  const item = await itemsRepo.findById(itemId);
  const counterpart = await db.one('SELECT user_id, name FROM users WHERE user_id = ?', [counterpartId]);
  return {
    messages: rows,
    item: item ? { item_id: item.item_id, title: item.title, type: item.type, status: item.status } : null,
    counterpart,
  };
}

/** Messages / Contact screen: one row per (item, counterpart). */
export async function threads(viewer) {
  const rows = await db.all(
    `SELECT m.*, s.name AS sender_name, r.name AS receiver_name, i.title AS item_title, i.type AS item_type, i.status AS item_status
     FROM messages m
     JOIN users s ON s.user_id = m.sender_id
     JOIN users r ON r.user_id = m.receiver_id
     JOIN items i ON i.item_id = m.item_id
     WHERE m.sender_id = ? OR m.receiver_id = ?
     ORDER BY m.timestamp DESC, m.message_id DESC`,
    [viewer.user_id, viewer.user_id],
  );

  const byThread = new Map();
  for (const row of rows) {
    const counterpartId = Number(row.sender_id) === Number(viewer.user_id) ? row.receiver_id : row.sender_id;
    const key = `${row.item_id}:${counterpartId}`;
    if (!byThread.has(key)) {
      byThread.set(key, {
        item_id: row.item_id,
        item_title: row.item_title,
        item_type: row.item_type,
        item_status: row.item_status,
        counterpart_id: counterpartId,
        counterpart_name: Number(row.sender_id) === Number(viewer.user_id) ? row.receiver_name : row.sender_name,
        last_message: row.message,
        last_message_at: row.timestamp,
        unread: 0,
      });
    }
    const thread = byThread.get(key);
    if (Number(row.receiver_id) === Number(viewer.user_id) && !row.read_at) thread.unread += 1;
  }

  return [...byThread.values()];
}

export async function markConversationRead(viewer, itemId, counterpartId) {
  const result = await db.run(
    'UPDATE messages SET read_at = ? WHERE item_id = ? AND receiver_id = ? AND sender_id = ? AND read_at IS NULL',
    [now(), itemId, viewer.user_id, counterpartId],
  );
  return { updated: result.changes ?? 0 };
}

export async function unreadTotal(userId) {
  const row = await db.one('SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND read_at IS NULL', [
    userId,
  ]);
  return Number(row?.total ?? 0);
}
