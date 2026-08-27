import { db, getSettings } from './db.js';
import { findMatches, scoreItems } from './matching.js';

/* --------------------------------------------------------------- item status */

export const STATUS_FLOW = [
  'reported',
  'possible_match',
  'claim_requested',
  'verification',
  'returned',
  'closed',
];

export const STATUS_LABELS = {
  reported: 'Reported',
  possible_match: 'Possible Match',
  claim_requested: 'Claim Requested',
  verification: 'Verification',
  returned: 'Returned',
  closed: 'Closed',
};

/** Only ever move an item forward in the lifecycle. */
export function advanceStatus(itemId, next) {
  const item = db.prepare('SELECT status FROM items WHERE id = ?').get(itemId);
  if (!item) return;
  const from = STATUS_FLOW.indexOf(item.status);
  const to = STATUS_FLOW.indexOf(next);
  if (to > from) {
    db.prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      next,
      itemId
    );
  }
}

export function setStatus(itemId, status) {
  db.prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    itemId
  );
}

/* -------------------------------------------------------------- notifications */

export function notify(userId, { type, title, message = '', link = null }) {
  if (!userId) return null;
  const info = db
    .prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)')
    .run(userId, type, title, message, link);
  return info.lastInsertRowid;
}

/* ------------------------------------------------------------------ matching */

const publicItemColumns =
  'id, user_id, type, title, category, description, location, item_date, ' +
  'image_url, image_hash, status, is_flagged, created_at, updated_at';

/** items joined with their reporter — the shape every client screen consumes. */
export const ITEM_SELECT = `
  SELECT i.id, i.user_id, i.type, i.title, i.category, i.description, i.location,
         i.item_date, i.image_url, i.image_hash, i.status, i.is_flagged,
         i.created_at, i.updated_at,
         u.name AS reporter_name, u.email AS reporter_email, u.avatar_hue AS reporter_hue,
         (SELECT COUNT(*) FROM items q WHERE q.id = i.id AND q.questions != '[]') AS has_questions
    FROM items i JOIN users u ON u.id = i.user_id`;

export function getItem(id) {
  return db.prepare(`SELECT ${publicItemColumns} FROM items WHERE id = ?`).get(id);
}

export function getItemWithReporter(id) {
  return db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id);
}

/**
 * Runs the matching engine for a freshly created/updated item against all
 * opposite-type reports that are still in play, persists new matches and
 * notifies both sides. Returns the created/updated match rows.
 */
export function runMatchingForItem(itemId) {
  const settings = getSettings();
  const item = db.prepare(`SELECT ${publicItemColumns} FROM items WHERE id = ?`).get(itemId);
  if (!item) return [];

  const oppositeType = item.type === 'lost' ? 'found' : 'lost';
  const candidates = db
    .prepare(
      `SELECT ${publicItemColumns} FROM items
        WHERE type = ? AND status NOT IN ('returned','closed') AND user_id != ?`
    )
    .all(oppositeType, item.user_id);

  const results = findMatches(item, candidates, settings);
  const created = [];

  const insert = db.prepare(`
    INSERT INTO matches (lost_item_id, found_item_id, match_score, breakdown)
    VALUES (?,?,?,?)
    ON CONFLICT (lost_item_id, found_item_id)
    DO UPDATE SET match_score = excluded.match_score, breakdown = excluded.breakdown
    RETURNING *`);

  for (const result of results) {
    const lostId = item.type === 'lost' ? item.id : result.candidate.id;
    const foundId = item.type === 'found' ? item.id : result.candidate.id;
    const row = insert.get(
      lostId,
      foundId,
      result.score,
      JSON.stringify({ factors: result.factors, reasons: result.reasons })
    );
    created.push(row);

    advanceStatus(lostId, 'possible_match');
    advanceStatus(foundId, 'possible_match');

    if (settings.auto_notify) {
      const strong = result.score >= (settings.strong_match_threshold ?? 80);
      const headline = strong ? 'Strong match found' : 'Possible match found';
      const detail = `${Math.round(result.score)}% match between "${
        db.prepare('SELECT title FROM items WHERE id = ?').get(lostId).title
      }" and a reported found item.`;
      notify(db.prepare('SELECT user_id FROM items WHERE id = ?').get(lostId).user_id, {
        type: 'match',
        title: headline,
        message: detail,
        link: `/app/matches`,
      });
      notify(db.prepare('SELECT user_id FROM items WHERE id = ?').get(foundId).user_id, {
        type: 'match',
        title: headline,
        message: `The item you found may belong to someone who reported it lost (${Math.round(
          result.score
        )}% match).`,
        link: `/app/matches`,
      });
    }
  }

  return created;
}

/** Recomputes the score+breakdown for an existing match pair (live details). */
export function explainMatch(lostItemId, foundItemId) {
  const settings = getSettings();
  const lost = getItem(lostItemId);
  const found = getItem(foundItemId);
  if (!lost || !found) return null;
  return scoreItems(lost, found, settings);
}

/** Hydrates a match row with both items and their reporters. */
export function hydrateMatch(row) {
  if (!row) return null;
  const lost = getItemWithReporter(row.lost_item_id);
  const found = getItemWithReporter(row.found_item_id);
  let breakdown = {};
  try {
    breakdown = JSON.parse(row.breakdown || '{}');
  } catch {
    breakdown = {};
  }
  return { ...row, breakdown, lost_item: lost, found_item: found };
}

/* ---------------------------------------------------------------- privacy */

/** Masks a reporter's identity for public views: "Aarav Sharma" → "Aa••• S." */
export function maskName(name = '') {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0] || '';
  const head = first.slice(0, 2);
  const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : '';
  return `${head}${'•'.repeat(Math.max(3, first.length - 2))}${initial}`;
}

export function maskEmail(email = '') {
  const [user = '', domain = ''] = String(email).split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(3, user.length - 2))}@${domain}`;
}
