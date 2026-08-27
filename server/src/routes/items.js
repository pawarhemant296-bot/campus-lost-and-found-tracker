import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { computeImageHash, upload } from '../images.js';
import { CATEGORIES } from '../constants.js';
import {
  ITEM_SELECT,
  explainMatch,
  hydrateMatch,
  maskEmail,
  maskName,
  runMatchingForItem,
} from '../services.js';

const router = Router();

function parseQuestions(input) {
  if (!input) return [];
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q) => q && String(q.q || '').trim())
      .slice(0, 5)
      .map((q) => ({ q: String(q.q).trim(), a: String(q.a || '').trim() }));
  } catch {
    return [];
  }
}

/** Strips private data and masks the reporter unless the viewer owns the item. */
function shapeItem(row, viewer) {
  if (!row) return null;
  const isOwner = viewer && viewer.id === row.user_id;
  const isAdmin = viewer && viewer.role === 'admin';
  const { image_hash, reporter_email, reporter_name, ...rest } = row;
  return {
    ...rest,
    has_image: Boolean(row.image_url),
    reporter: {
      id: isOwner || isAdmin ? row.user_id : undefined,
      name: isOwner || isAdmin ? reporter_name : maskName(reporter_name),
      email: isOwner || isAdmin ? reporter_email : maskEmail(reporter_email),
      hue: row.reporter_hue,
      is_you: Boolean(isOwner),
    },
  };
}

/* ------------------------------------------------------------------ browse */

router.get('/', (req, res) => {
  const {
    q = '',
    type = '',
    category = '',
    location = '',
    status = '',
    from = '',
    to = '',
    sort = 'recent',
    mine = '',
    limit = '60',
    offset = '0',
  } = req.query;

  const where = [];
  const params = [];

  if (q) {
    where.push('(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ? OR i.category LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (type) {
    where.push('i.type = ?');
    params.push(type);
  }
  if (category) {
    where.push('i.category = ?');
    params.push(category);
  }
  if (location) {
    where.push('i.location = ?');
    params.push(location);
  }
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  if (from) {
    where.push('date(i.item_date) >= date(?)');
    params.push(from);
  }
  if (to) {
    where.push('date(i.item_date) <= date(?)');
    params.push(to);
  }
  if (mine === '1' && req.user) {
    where.push('i.user_id = ?');
    params.push(req.user.id);
  }
  if (!req.user || req.user.role !== 'admin') where.push('i.is_flagged = 0');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order =
    sort === 'oldest'
      ? 'i.item_date ASC'
      : sort === 'title'
        ? 'i.title ASC'
        : 'i.created_at DESC';

  const rows = db
    .prepare(`${ITEM_SELECT} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, Math.min(Number(limit) || 60, 200), Number(offset) || 0);

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM items i ${clause.replace(/i\./g, 'i.')}`)
    .get(...params).c;

  res.json({ items: rows.map((r) => shapeItem(r, req.user)), total });
});

/* ------------------------------------------------------------------- create */

router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  const { type, title, category, description = '', location = '', item_date } = req.body || {};

  const cleanup = () => {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
  };

  if (!['lost', 'found'].includes(type)) {
    cleanup();
    return res.status(400).json({ error: 'Report type must be "lost" or "found"' });
  }
  if (!title || String(title).trim().length < 3) {
    cleanup();
    return res.status(400).json({ error: 'Give the item a short descriptive title' });
  }
  if (!category || !CATEGORIES.includes(category)) {
    cleanup();
    return res.status(400).json({ error: 'Pick a category for the item' });
  }
  if (!item_date || Number.isNaN(Date.parse(item_date))) {
    cleanup();
    return res.status(400).json({ error: 'Enter a valid date and time' });
  }

  let imageUrl = null;
  let imageHash = null;
  if (req.file) {
    imageUrl = `/uploads/${path.basename(req.file.path)}`;
    imageHash = await computeImageHash(req.file.path);
  }

  const info = db
    .prepare(
      `INSERT INTO items
        (user_id, type, title, category, description, location, item_date, image_url, image_hash, questions)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      req.user.id,
      type,
      String(title).trim(),
      category,
      String(description).trim(),
      String(location).trim(),
      new Date(item_date).toISOString(),
      imageUrl,
      imageHash,
      JSON.stringify(parseQuestions(req.body.questions))
    );

  const itemId = Number(info.lastInsertRowid);
  const matches = runMatchingForItem(itemId).map(hydrateMatch);
  const item = shapeItem(db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(itemId), req.user);

  res.status(201).json({ item, matches, match_count: matches.length });
});

/* --------------------------------------------------------------- read / edit */

router.get('/:id', (req, res) => {
  const row = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item not found' });

  const item = shapeItem(row, req.user);
  const isOwner = req.user && req.user.id === row.user_id;

  // Matches this item participates in (scores are public; item details are not private).
  const matchRows = db
    .prepare('SELECT * FROM matches WHERE lost_item_id = ? OR found_item_id = ? ORDER BY match_score DESC')
    .all(row.id, row.id)
    .map(hydrateMatch)
    .map((m) => ({
      ...m,
      lost_item: shapeItem(m.lost_item, req.user),
      found_item: shapeItem(m.found_item, req.user),
    }));

  const questions = JSON.parse(
    db.prepare('SELECT questions FROM items WHERE id = ?').get(row.id).questions || '[]'
  );

  res.json({
    item,
    matches: matchRows,
    // Question prompts are public (answers never are) so a claimant knows what to prove.
    verification_questions: questions.map((q) => q.q),
    my_claim: req.user
      ? db
          .prepare('SELECT id, stage, status FROM claims WHERE item_id = ? AND claimant_id = ?')
          .get(row.id, req.user.id) || null
      : null,
    can_edit: Boolean(isOwner) || Boolean(req.user && req.user.role === 'admin'),
  });
});

router.patch('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You can only edit your own reports' });

  const { title, category, description, location, item_date, status, questions } = req.body || {};
  db.prepare(
    `UPDATE items SET title = ?, category = ?, description = ?, location = ?, item_date = ?,
       status = ?, questions = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title?.trim() || item.title,
    category && CATEGORIES.includes(category) ? category : item.category,
    description ?? item.description,
    location ?? item.location,
    item_date && !Number.isNaN(Date.parse(item_date))
      ? new Date(item_date).toISOString()
      : item.item_date,
    status || item.status,
    questions ? JSON.stringify(parseQuestions(questions)) : item.questions,
    item.id
  );

  runMatchingForItem(item.id);
  res.json({ item: shapeItem(db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(item.id), req.user) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You can only delete your own reports' });

  if (item.image_url) {
    const file = path.join(config.uploadDir, path.basename(item.image_url));
    fs.promises.unlink(file).catch(() => {});
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

/** Re-runs the engine on demand (used by the "Re-scan for matches" button). */
router.post('/:id/rescan', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not your report' });

  const matches = runMatchingForItem(item.id)
    .map(hydrateMatch)
    .map((m) => ({
      ...m,
      lost_item: shapeItem(m.lost_item, req.user),
      found_item: shapeItem(m.found_item, req.user),
    }));
  res.json({ matches, match_count: matches.length });
});

/** Live factor-by-factor explanation between any two items. */
router.get('/:id/compare/:otherId', (req, res) => {
  const a = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  const b = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.otherId);
  if (!a || !b) return res.status(404).json({ error: 'Item not found' });
  const lost = a.type === 'lost' ? a.id : b.id;
  const found = a.type === 'found' ? a.id : b.id;
  res.json(explainMatch(lost, found));
});

export default router;
