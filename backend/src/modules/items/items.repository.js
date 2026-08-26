/**
 * All item SQL lives here. Queries use `?` placeholders and LOWER() comparisons
 * so they behave identically on SQLite and PostgreSQL.
 */
import db from '../../db/index.js';
import { ITEM_TERMINAL_STATUS, now } from '../../utils/constants.js';

const SELECT_ITEM = `
  SELECT i.*, u.name AS reporter_name, u.email AS reporter_email
  FROM items i
  JOIN users u ON u.user_id = i.user_id
`;

export async function insertItem(payload) {
  const timestamp = now();
  return db.insertReturning(
    `INSERT INTO items
       (user_id, type, title, category, description, location, latitude, longitude,
        occurred_at, image_url, status, verification_question, secret_details,
        is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     RETURNING *`,
    [
      payload.user_id,
      payload.type,
      payload.title,
      payload.category,
      payload.description ?? '',
      payload.location ?? '',
      payload.latitude ?? null,
      payload.longitude ?? null,
      payload.occurred_at,
      payload.image_url ?? null,
      payload.status,
      payload.verification_question ?? null,
      payload.secret_details ?? null,
      timestamp,
      timestamp,
    ],
  );
}

export async function findById(itemId) {
  return db.one(`${SELECT_ITEM} WHERE i.item_id = ?`, [itemId]);
}

export async function findManyByIds(itemIds) {
  if (!itemIds?.length) return [];
  const placeholders = itemIds.map(() => '?').join(', ');
  return db.all(`${SELECT_ITEM} WHERE i.item_id IN (${placeholders})`, itemIds);
}

/**
 * Search & filter (spec section 12): category, location, date range and keyword.
 * @returns {Promise<{rows: object[], total: number}>}
 */
export async function search(filters = {}) {
  const clauses = [];
  const params = [];

  if (!filters.include_hidden) clauses.push('i.is_hidden = 0');

  if (filters.type) {
    clauses.push('i.type = ?');
    params.push(filters.type);
  }
  if (filters.category) {
    clauses.push('LOWER(i.category) = LOWER(?)');
    params.push(filters.category);
  }
  if (filters.status) {
    clauses.push('i.status = ?');
    params.push(filters.status);
  }
  if (filters.user_id) {
    clauses.push('i.user_id = ?');
    params.push(filters.user_id);
  }
  if (filters.location) {
    clauses.push('LOWER(i.location) LIKE LOWER(?)');
    params.push(`%${filters.location}%`);
  }
  if (filters.q) {
    clauses.push('(LOWER(i.title) LIKE LOWER(?) OR LOWER(i.description) LIKE LOWER(?) OR LOWER(i.category) LIKE LOWER(?) OR LOWER(i.location) LIKE LOWER(?))');
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.date_from) {
    clauses.push('i.occurred_at >= ?');
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clauses.push('i.occurred_at <= ?');
    params.push(filters.date_to);
  }
  if (filters.unresolved_only) {
    clauses.push(`i.status NOT IN (${ITEM_TERMINAL_STATUS.map(() => '?').join(', ')})`);
    params.push(...ITEM_TERMINAL_STATUS);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sortMap = {
    recent: 'i.created_at DESC, i.item_id DESC',
    oldest: 'i.created_at ASC, i.item_id ASC',
    date: 'i.occurred_at DESC',
    title: 'LOWER(i.title) ASC',
  };
  const orderBy = sortMap[filters.sort] ?? sortMap.recent;

  const limit = Math.min(Math.max(Number(filters.limit) || 12, 1), 100);
  const page = Math.max(Number(filters.page) || 1, 1);
  const offset = (page - 1) * limit;

  const rows = await db.all(`${SELECT_ITEM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [
    ...params,
    limit,
    offset,
  ]);
  const countRow = await db.one(
    `SELECT COUNT(*) AS total FROM items i JOIN users u ON u.user_id = i.user_id ${where}`,
    params,
  );

  return { rows, total: Number(countRow?.total ?? 0), page, limit };
}

/** Opposite-type reports that are still in play - the matching engine's pool. */
export async function findMatchCandidates(item, { limit = 200 } = {}) {
  const oppositeType = item.type === 'lost' ? 'found' : 'lost';
  const placeholders = ITEM_TERMINAL_STATUS.map(() => '?').join(', ');
  return db.all(
    `${SELECT_ITEM}
     WHERE i.type = ?
       AND i.is_hidden = 0
       AND i.status NOT IN (${placeholders})
       AND i.user_id <> ?
     ORDER BY i.created_at DESC
     LIMIT ?`,
    [oppositeType, ...ITEM_TERMINAL_STATUS, item.user_id, limit],
  );
}

export async function updateItem(itemId, fields) {
  const allowed = [
    'title',
    'category',
    'description',
    'location',
    'latitude',
    'longitude',
    'occurred_at',
    'image_url',
    'status',
    'verification_question',
    'secret_details',
    'is_hidden',
    'resolved_at',
  ];
  const entries = Object.entries(fields).filter(([key, value]) => allowed.includes(key) && value !== undefined);
  if (entries.length === 0) return findById(itemId);

  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  const params = entries.map(([, value]) => value);
  await db.run(`UPDATE items SET ${assignments}, updated_at = ? WHERE item_id = ?`, [...params, now(), itemId]);
  return findById(itemId);
}

export async function deleteItem(itemId) {
  const result = await db.run('DELETE FROM items WHERE item_id = ?', [itemId]);
  return (result.changes ?? 0) > 0;
}

export async function countsForUser(userId) {
  return db.one(
    `SELECT
       SUM(CASE WHEN type = 'lost'  THEN 1 ELSE 0 END) AS lost_count,
       SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) AS found_count,
       SUM(CASE WHEN status = 'RETURNED' OR status = 'CLOSED' THEN 1 ELSE 0 END) AS resolved_count,
       COUNT(*) AS total_count
     FROM items WHERE user_id = ?`,
    [userId],
  );
}

export async function globalCounts() {
  return db.one(
    `SELECT
       COUNT(*) AS total_items,
       SUM(CASE WHEN type = 'lost'  THEN 1 ELSE 0 END) AS lost_count,
       SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) AS found_count,
       SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) AS returned_count,
       SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_count,
       SUM(CASE WHEN is_hidden = 1 THEN 1 ELSE 0 END) AS hidden_count
     FROM items`,
  );
}

export async function categoryBreakdown() {
  return db.all(
    `SELECT category,
            COUNT(*) AS total,
            SUM(CASE WHEN type = 'lost'  THEN 1 ELSE 0 END) AS lost_count,
            SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) AS found_count
     FROM items GROUP BY category ORDER BY total DESC`,
  );
}

/** Location hotspots - powers the analytics heatmap. */
export async function locationHotspots(limit = 10) {
  return db.all(
    `SELECT location, COUNT(*) AS total
     FROM items WHERE location <> '' GROUP BY LOWER(location), location
     ORDER BY total DESC LIMIT ?`,
    [limit],
  );
}
