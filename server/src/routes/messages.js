import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { notify } from '../services.js';

const router = Router();

/** Conversation list: one row per (counterpart, item) pair with unread counts. */
router.get('/threads', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS user_id,
         m.item_id,
         MAX(m.created_at) AS last_at,
         COUNT(*) AS total,
         SUM(CASE WHEN m.receiver_id = ? AND m.read_status = 0 THEN 1 ELSE 0 END) AS unread
       FROM messages m
       WHERE m.sender_id = ? OR m.receiver_id = ?
       GROUP BY user_id, m.item_id
       ORDER BY last_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id, req.user.id);

  const threads = rows.map((t) => {
    const other = db
      .prepare('SELECT id, name, avatar_hue, role FROM users WHERE id = ?')
      .get(t.user_id);
    const item = t.item_id
      ? db.prepare('SELECT id, title, type, image_url, status, category FROM items WHERE id = ?').get(t.item_id)
      : null;
    const last = db
      .prepare(
        `SELECT message, sender_id, created_at FROM messages
          WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
            AND (item_id IS ? OR item_id = ?)
          ORDER BY created_at DESC LIMIT 1`
      )
      .get(req.user.id, t.user_id, t.user_id, req.user.id, t.item_id, t.item_id);
    return { ...t, user: other, item, last_message: last };
  });

  res.json({ threads, unread_total: threads.reduce((s, t) => s + (t.unread || 0), 0) });
});

/** Full conversation with one person, optionally scoped to an item. */
router.get('/thread/:userId', requireAuth, (req, res) => {
  const otherId = Number(req.params.userId);
  const itemId = req.query.item_id ? Number(req.query.item_id) : null;

  const messages = db
    .prepare(
      `SELECT * FROM messages
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          AND (? IS NULL OR item_id = ?)
        ORDER BY created_at ASC`
    )
    .all(req.user.id, otherId, otherId, req.user.id, itemId, itemId);

  db.prepare(
    `UPDATE messages SET read_status = 1
      WHERE receiver_id = ? AND sender_id = ? AND (? IS NULL OR item_id = ?)`
  ).run(req.user.id, otherId, itemId, itemId);

  const user = db.prepare('SELECT id, name, avatar_hue, role FROM users WHERE id = ?').get(otherId);
  const item = itemId
    ? db.prepare('SELECT id, title, type, image_url, status, category, location FROM items WHERE id = ?').get(itemId)
    : null;

  res.json({ messages, user, item });
});

router.post('/', requireAuth, (req, res) => {
  const { receiver_id, item_id = null, message } = req.body || {};
  if (!receiver_id || Number(receiver_id) === req.user.id)
    return res.status(400).json({ error: 'Pick someone to message' });
  if (!message || !String(message).trim())
    return res.status(400).json({ error: 'Message cannot be empty' });

  const receiver = db.prepare('SELECT * FROM users WHERE id = ?').get(receiver_id);
  if (!receiver) return res.status(404).json({ error: 'Recipient not found' });

  const info = db
    .prepare('INSERT INTO messages (sender_id, receiver_id, item_id, message) VALUES (?,?,?,?)')
    .run(req.user.id, receiver.id, item_id || null, String(message).trim().slice(0, 2000));

  notify(receiver.id, {
    type: 'message',
    title: `New message from ${req.user.name}`,
    message: String(message).trim().slice(0, 120),
    link: `/app/messages?user=${req.user.id}${item_id ? `&item=${item_id}` : ''}`,
  });

  res.status(201).json({
    message: db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid),
  });
});

/** Starts (or reuses) a conversation with the reporter of an item. */
router.post('/start', requireAuth, (req, res) => {
  const { item_id } = req.body || {};
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.user_id === req.user.id)
    return res.status(400).json({ error: 'This is your own report' });
  res.json({ user_id: item.user_id, item_id: item.id });
});

export default router;
