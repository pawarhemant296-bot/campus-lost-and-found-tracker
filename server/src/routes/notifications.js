import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 100);
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(req.user.id, limit);
  const unread = db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_status = 0')
    .get(req.user.id).c;
  const unreadMessages = db
    .prepare('SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND read_status = 0')
    .get(req.user.id).c;
  res.json({ notifications, unread, unread_messages: unreadMessages });
});

router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user.id
  );
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_status = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
