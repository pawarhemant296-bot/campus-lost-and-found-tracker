import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { explainMatch, hydrateMatch, maskEmail, maskName, notify } from '../services.js';

const router = Router();

function shape(match, viewer) {
  const mask = (item) => {
    if (!item) return null;
    const isOwner = viewer && viewer.id === item.user_id;
    const isAdmin = viewer && viewer.role === 'admin';
    const { image_hash, reporter_email, reporter_name, ...rest } = item;
    return {
      ...rest,
      reporter: {
        name: isOwner || isAdmin ? reporter_name : maskName(reporter_name),
        email: isOwner || isAdmin ? reporter_email : maskEmail(reporter_email),
        hue: item.reporter_hue,
        is_you: Boolean(isOwner),
      },
    };
  };
  return { ...match, lost_item: mask(match.lost_item), found_item: mask(match.found_item) };
}

/** All matches involving the signed-in user's reports (admins see everything). */
router.get('/', requireAuth, (req, res) => {
  const minScore = Number(req.query.min_score || 0);
  const sort = req.query.sort === 'oldest' ? 'm.created_at ASC' : 'm.match_score DESC';

  const rows =
    req.user.role === 'admin' && req.query.scope === 'all'
      ? db.prepare(`SELECT m.* FROM matches m WHERE m.match_score >= ? ORDER BY ${sort}`).all(minScore)
      : db
          .prepare(
            `SELECT m.* FROM matches m
               JOIN items l ON l.id = m.lost_item_id
               JOIN items f ON f.id = m.found_item_id
              WHERE (l.user_id = ? OR f.user_id = ?) AND m.match_score >= ?
              ORDER BY ${sort}`
          )
          .all(req.user.id, req.user.id, minScore);

  const matches = rows.map(hydrateMatch).map((m) => {
    const perspective =
      m.lost_item?.user_id === req.user.id
        ? 'owner'
        : m.found_item?.user_id === req.user.id
          ? 'finder'
          : 'admin';
    return { ...shape(m, req.user), perspective };
  });

  res.json({ matches });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Match not found' });
  const match = hydrateMatch(row);
  const live = explainMatch(row.lost_item_id, row.found_item_id);
  res.json({ match: shape(match, req.user), live });
});

/** Dismiss a match ("not my item") — keeps the engine from re-surfacing it. */
router.post('/:id/reject', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Match not found' });
  const lost = db.prepare('SELECT user_id FROM items WHERE id = ?').get(row.lost_item_id);
  const found = db.prepare('SELECT user_id FROM items WHERE id = ?').get(row.found_item_id);
  if (![lost.user_id, found.user_id].includes(req.user.id) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not your match' });

  db.prepare("UPDATE matches SET status = 'rejected' WHERE id = ?").run(row.id);
  const other = req.user.id === lost.user_id ? found.user_id : lost.user_id;
  notify(other, {
    type: 'match',
    title: 'Match dismissed',
    message: 'The other party indicated this is not the same item.',
    link: '/app/matches',
  });
  res.json({ ok: true });
});

export default router;
