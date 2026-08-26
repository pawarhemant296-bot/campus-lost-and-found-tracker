/**
 * Matching Module - runs the engine whenever a report is created or edited,
 * stores possible matches and notifies both parties (spec steps 7-9).
 */
import config from '../../config/env.js';
import db from '../../db/index.js';
import { rankCandidates, scorePairAsync } from '../../matching/engine.js';
import { emitToUser } from '../../realtime/hub.js';
import {
  ITEM_STATUS,
  ITEM_TERMINAL_STATUS,
  MATCH_STATUS,
  NOTIFICATION_TYPES,
  now,
} from '../../utils/constants.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import { notify } from '../notifications/notifications.service.js';
import * as itemsRepo from '../items/items.repository.js';

const parseBreakdown = (value) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

/** Adds the lost/found items and parsed score breakdown to a match row. */
export async function decorate(match) {
  if (!match) return null;
  const [lostItem, foundItem] = await Promise.all([
    itemsRepo.findById(match.lost_item_id),
    itemsRepo.findById(match.found_item_id),
  ]);
  const { secret_details: _l, ...lost } = lostItem ?? {};
  const { secret_details: _f, ...found } = foundItem ?? {};
  return {
    ...match,
    match_score: Number(match.match_score),
    breakdown: parseBreakdown(match.breakdown),
    lost_item: lostItem ? lost : null,
    found_item: foundItem ? found : null,
  };
}

const decorateAll = (rows) => Promise.all(rows.map(decorate));

async function upsertMatch({ lostItemId, foundItemId, result }) {
  const existing = await db.one('SELECT * FROM matches WHERE lost_item_id = ? AND found_item_id = ?', [
    lostItemId,
    foundItemId,
  ]);
  const breakdown = JSON.stringify({
    score: result.score,
    factors: result.factors,
    reasons: result.reasons,
    keywords: result.keywords,
    ai_used: result.ai_used,
    weights: config.matching.weights,
  });

  if (existing) {
    const updated = await db.insertReturning(
      'UPDATE matches SET match_score = ?, breakdown = ?, updated_at = ? WHERE match_id = ? RETURNING *',
      [result.score, breakdown, now(), existing.match_id],
    );
    return { match: updated, isNew: false, previousScore: Number(existing.match_score) };
  }

  const created = await db.insertReturning(
    `INSERT INTO matches (lost_item_id, found_item_id, match_score, breakdown, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [lostItemId, foundItemId, result.score, breakdown, MATCH_STATUS.POSSIBLE, now(), now()],
  );
  return { match: created, isNew: true, previousScore: null };
}

/** Moves an item to POSSIBLE_MATCH without ever walking the lifecycle backwards. */
async function promoteToPossibleMatch(item) {
  if (!item || item.status !== ITEM_STATUS.REPORTED) return;
  await itemsRepo.updateItem(item.item_id, { status: ITEM_STATUS.POSSIBLE_MATCH });
}

/**
 * Compares one report against every opposite-type report still in play.
 * @returns {Promise<{matches: object[], created: number, best: object|null}>}
 */
export async function runMatchingForItem(item, { notifyUsers = true } = {}) {
  if (ITEM_TERMINAL_STATUS.includes(item.status)) return { matches: [], created: 0, best: null };

  const candidates = await itemsRepo.findMatchCandidates(item);
  const ranked = await rankCandidates(item, candidates);
  const isLost = item.type === 'lost';

  const stored = [];
  let created = 0;

  for (const { item: candidate, result } of ranked) {
    if (result.score < config.matching.minScore) continue;

    const lostItemId = isLost ? item.item_id : candidate.item_id;
    const foundItemId = isLost ? candidate.item_id : item.item_id;
    const { match, isNew, previousScore } = await upsertMatch({ lostItemId, foundItemId, result });

    if (isNew) created += 1;
    stored.push({ match, result, candidate, isNew, previousScore });

    await promoteToPossibleMatch(item);
    await promoteToPossibleMatch(candidate);

    if (notifyUsers && isNew) {
      const headline = result.strong ? 'Strong match found' : 'Possible match found';
      const reason = result.reasons[0] ? ` (${result.reasons[0]})` : '';

      // The person who filed this report
      await notify({
        userId: item.user_id,
        type: NOTIFICATION_TYPES.MATCH_FOUND,
        title: `${headline} - ${result.score}%`,
        message: `Your ${item.type} report "${item.title}" may match "${candidate.title}"${reason}.`,
        link: `/matches/${match.match_id}`,
      });
      // The person on the other side of the match
      await notify({
        userId: candidate.user_id,
        type: NOTIFICATION_TYPES.MATCH_FOUND,
        title: `${headline} - ${result.score}%`,
        message: `Your ${candidate.type} report "${candidate.title}" may match "${item.title}"${reason}.`,
        link: `/matches/${match.match_id}`,
      });

      emitToUser(item.user_id, 'match:new', { match_id: match.match_id, score: result.score });
      emitToUser(candidate.user_id, 'match:new', { match_id: match.match_id, score: result.score });
    }
  }

  const decorated = await decorateAll(stored.map((entry) => entry.match));
  decorated.sort((a, b) => b.match_score - a.match_score);

  return { matches: decorated, created, best: decorated[0] ?? null };
}

/** Live preview: score an item against candidates without storing anything. */
export async function previewForItem(itemId, { limit = 10 } = {}) {
  const item = await itemsRepo.findById(itemId);
  if (!item) throw notFound('Item not found');
  const candidates = await itemsRepo.findMatchCandidates(item);
  const ranked = await rankCandidates(item, candidates);
  return ranked.slice(0, limit).map(({ item: candidate, result }) => {
    const { secret_details: _s, reporter_email: _e, ...safeCandidate } = candidate;
    return { candidate: safeCandidate, score: result.score, strong: result.strong, factors: result.factors, reasons: result.reasons };
  });
}

export async function listForItem(itemId) {
  const rows = await db.all(
    `SELECT * FROM matches
     WHERE (lost_item_id = ? OR found_item_id = ?) AND status <> ?
     ORDER BY match_score DESC`,
    [itemId, itemId, MATCH_STATUS.REJECTED],
  );
  return decorateAll(rows);
}

/** Every match that touches one of this user's reports. */
export async function listForUser(userId, { minScore = 0 } = {}) {
  const rows = await db.all(
    `SELECT m.* FROM matches m
     JOIN items li ON li.item_id = m.lost_item_id
     JOIN items fi ON fi.item_id = m.found_item_id
     WHERE (li.user_id = ? OR fi.user_id = ?) AND m.match_score >= ? AND m.status <> ?
     ORDER BY m.match_score DESC, m.created_at DESC`,
    [userId, userId, minScore, MATCH_STATUS.REJECTED],
  );
  return decorateAll(rows);
}

export async function listAll({ minScore = 0, limit = 100 } = {}) {
  const rows = await db.all('SELECT * FROM matches WHERE match_score >= ? ORDER BY match_score DESC LIMIT ?', [
    minScore,
    limit,
  ]);
  return decorateAll(rows);
}

export async function getById(matchId, user) {
  const row = await db.one('SELECT * FROM matches WHERE match_id = ?', [matchId]);
  if (!row) throw notFound('Match not found');
  const match = await decorate(row);
  const isParticipant =
    match.lost_item?.user_id === user?.user_id || match.found_item?.user_id === user?.user_id;
  if (!isParticipant && user?.role !== 'admin') {
    throw forbidden('You can only view matches for your own reports');
  }
  return match;
}

/** Participants (or an admin) confirm or dismiss a suggested match. */
export async function setStatus(matchId, status, user) {
  const allowed = [MATCH_STATUS.CONFIRMED, MATCH_STATUS.REJECTED, MATCH_STATUS.POSSIBLE];
  if (!allowed.includes(status)) throw badRequest(`status must be one of ${allowed.join(', ')}`);

  const match = await getById(matchId, user);
  const updated = await db.insertReturning(
    'UPDATE matches SET status = ?, updated_at = ? WHERE match_id = ? RETURNING *',
    [status, now(), matchId],
  );

  const counterpartId =
    match.lost_item?.user_id === user.user_id ? match.found_item?.user_id : match.lost_item?.user_id;
  if (counterpartId && status !== MATCH_STATUS.POSSIBLE) {
    await notify({
      userId: counterpartId,
      type: NOTIFICATION_TYPES.MATCH_FOUND,
      title: status === MATCH_STATUS.CONFIRMED ? 'Match confirmed' : 'Match dismissed',
      message: `${user.name} marked the ${match.match_score}% match on "${match.lost_item?.title}" as ${status.toLowerCase()}.`,
      link: `/matches/${matchId}`,
    });
  }

  return decorate(updated);
}

/** Re-scores every open pair - handy after tuning weights or enabling the AI service. */
export async function rescoreAll() {
  const rows = await db.all('SELECT * FROM matches');
  let updated = 0;
  for (const row of rows) {
    const [lostItem, foundItem] = await Promise.all([
      itemsRepo.findById(row.lost_item_id),
      itemsRepo.findById(row.found_item_id),
    ]);
    if (!lostItem || !foundItem) continue;
    const result = await scorePairAsync(lostItem, foundItem);
    await upsertMatch({ lostItemId: row.lost_item_id, foundItemId: row.found_item_id, result });
    updated += 1;
  }
  return { rescored: updated };
}

export async function statistics() {
  const row = await db.one(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed,
            SUM(CASE WHEN status = 'POSSIBLE'  THEN 1 ELSE 0 END) AS possible,
            SUM(CASE WHEN status = 'REJECTED'  THEN 1 ELSE 0 END) AS rejected,
            AVG(match_score) AS average_score
     FROM matches`,
  );
  return {
    total: Number(row?.total ?? 0),
    confirmed: Number(row?.confirmed ?? 0),
    possible: Number(row?.possible ?? 0),
    rejected: Number(row?.rejected ?? 0),
    average_score: row?.average_score ? Number(Number(row.average_score).toFixed(1)) : 0,
  };
}
