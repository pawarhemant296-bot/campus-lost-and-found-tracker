/**
 * Lost Item Module + Found Item Module.
 * A report is validated, stored, and immediately pushed through the matching
 * engine (spec sections 4 and 5).
 */
import db from '../../db/index.js';
import {
  ITEM_STATUS,
  ITEM_TERMINAL_STATUS,
  ROLES,
  now,
} from '../../utils/constants.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import * as matches from '../matches/matches.service.js';
import * as repo from './items.repository.js';

/**
 * Public projection of an item.
 * `secret_details` is the ownership proof and is NEVER returned to anyone -
 * not even the owner - so it cannot leak through the API (spec section 7).
 */
export function sanitize(item, viewer = null) {
  if (!item) return null;
  const { secret_details, reporter_email, ...rest } = item;
  const isOwner = viewer && viewer.user_id === item.user_id;
  const isAdmin = viewer?.role === ROLES.ADMIN;

  return {
    ...rest,
    is_hidden: Number(rest.is_hidden ?? 0),
    has_verification_question: Boolean(item.verification_question),
    has_secret_details: Boolean(secret_details),
    is_owner: Boolean(isOwner),
    // Contact details stay private until a claim is approved; see claims module.
    reporter: {
      user_id: item.user_id,
      name: item.reporter_name ?? null,
      ...(isOwner || isAdmin ? { email: reporter_email ?? null } : {}),
    },
  };
}

const sanitizeAll = (rows, viewer) => rows.map((row) => sanitize(row, viewer));

function assertCanEdit(item, viewer) {
  const isOwner = viewer.user_id === item.user_id;
  const isAdmin = viewer.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) throw forbidden('Only the person who filed this report can change it');
  return { isOwner, isAdmin };
}

/**
 * Creates a lost or found report and runs the matching engine.
 * @returns {Promise<{item: object, matches: object[], best_match: object|null}>}
 */
export async function createReport(user, payload) {
  const item = await repo.insertItem({
    ...payload,
    user_id: user.user_id,
    status: ITEM_STATUS.REPORTED,
  });

  // Engine failures must never lose the user's report.
  let matchResult = { matches: [], created: 0, best: null };
  try {
    matchResult = await matches.runMatchingForItem(item);
  } catch (error) {
    console.error('[matching] failed for item', item.item_id, error.message);
  }

  const fresh = (await repo.findById(item.item_id)) ?? item;
  return {
    item: sanitize(fresh, user),
    matches: matchResult.matches,
    best_match: matchResult.best,
    new_matches: matchResult.created,
  };
}

export async function searchItems(filters, viewer = null) {
  const includeHidden = viewer?.role === ROLES.ADMIN && filters.include_hidden;
  const { rows, total, page, limit } = await repo.search({ ...filters, include_hidden: includeHidden });
  return {
    items: sanitizeAll(rows, viewer),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
      has_more: page * limit < total,
    },
  };
}

export async function getItem(itemId, viewer = null) {
  const item = await repo.findById(itemId);
  if (!item) throw notFound('Item not found');
  if (Number(item.is_hidden) === 1 && viewer?.role !== ROLES.ADMIN && viewer?.user_id !== item.user_id) {
    throw notFound('Item not found');
  }

  const relatedMatches = await matches.listForItem(itemId);

  // Owners see the claims filed against their item; claimants see their own.
  let claims = [];
  if (viewer) {
    claims = await db.all(
      `SELECT c.*, u.name AS claimant_name FROM claims c
       JOIN users u ON u.user_id = c.claimant_id
       WHERE c.item_id = ? AND (? = 1 OR c.claimant_id = ?)
       ORDER BY c.created_at DESC`,
      [itemId, viewer.user_id === item.user_id || viewer.role === ROLES.ADMIN ? 1 : 0, viewer.user_id],
    );
  }

  return {
    item: sanitize(item, viewer),
    matches: relatedMatches,
    claims,
    timeline: buildTimeline(item, relatedMatches, claims),
  };
}

/** Human readable status history for the item detail screen (spec section 8). */
function buildTimeline(item, relatedMatches, claims) {
  const events = [
    {
      status: ITEM_STATUS.REPORTED,
      at: item.created_at,
      label: `${item.type === 'lost' ? 'Lost' : 'Found'} item reported`,
      done: true,
    },
  ];

  const best = relatedMatches[0];
  events.push({
    status: ITEM_STATUS.POSSIBLE_MATCH,
    at: best?.created_at ?? null,
    label: best ? `Possible match found (${best.match_score}%)` : 'Waiting for a possible match',
    done: Boolean(best),
  });

  const claim = claims[0];
  events.push({
    status: ITEM_STATUS.CLAIM_REQUESTED,
    at: claim?.created_at ?? null,
    label: claim ? 'Claim submitted' : 'No claim submitted yet',
    done: Boolean(claim),
  });
  events.push({
    status: ITEM_STATUS.VERIFICATION,
    at: claim?.updated_at ?? null,
    label: claim ? `Ownership verification: ${claim.status}` : 'Ownership verification pending',
    done: Boolean(claim && claim.status !== 'PENDING'),
  });
  events.push({
    status: ITEM_STATUS.RETURNED,
    at: item.resolved_at ?? null,
    label: item.status === ITEM_STATUS.RETURNED || item.status === ITEM_STATUS.CLOSED ? 'Item returned to owner' : 'Handover pending',
    done: [ITEM_STATUS.RETURNED, ITEM_STATUS.CLOSED].includes(item.status),
  });
  events.push({
    status: ITEM_STATUS.CLOSED,
    at: item.status === ITEM_STATUS.CLOSED ? item.updated_at : null,
    label: item.status === ITEM_STATUS.CLOSED ? 'Case closed' : 'Case open',
    done: item.status === ITEM_STATUS.CLOSED,
  });

  return events;
}

export async function updateReport(itemId, viewer, payload) {
  const item = await repo.findById(itemId);
  if (!item) throw notFound('Item not found');
  assertCanEdit(item, viewer);
  if (ITEM_TERMINAL_STATUS.includes(item.status) && viewer.role !== ROLES.ADMIN) {
    throw badRequest('This case is already closed and can no longer be edited');
  }

  const updated = await repo.updateItem(itemId, payload);

  // Re-run matching when a scoring input changed.
  const rescoreKeys = ['title', 'category', 'description', 'location', 'occurred_at', 'image_url', 'latitude', 'longitude'];
  if (rescoreKeys.some((key) => payload[key] !== undefined)) {
    try {
      await matches.runMatchingForItem(updated);
    } catch (error) {
      console.error('[matching] re-run failed for item', itemId, error.message);
    }
  }

  return sanitize((await repo.findById(itemId)) ?? updated, viewer);
}

export async function deleteReport(itemId, viewer) {
  const item = await repo.findById(itemId);
  if (!item) throw notFound('Item not found');
  assertCanEdit(item, viewer);
  await repo.deleteItem(itemId);
  return { deleted: true, item_id: itemId };
}

/** Owner (or admin) closes the case manually - the final lifecycle step. */
export async function closeCase(itemId, viewer) {
  const item = await repo.findById(itemId);
  if (!item) throw notFound('Item not found');
  assertCanEdit(item, viewer);
  const updated = await repo.updateItem(itemId, {
    status: ITEM_STATUS.CLOSED,
    resolved_at: item.resolved_at ?? now(),
  });
  return sanitize(updated, viewer);
}

/** User Dashboard payload (spec section 12). */
export async function dashboard(user) {
  const counts = (await repo.countsForUser(user.user_id)) ?? {};
  const [recentItems, userMatches, openClaims, pendingReviews] = await Promise.all([
    repo.search({ user_id: user.user_id, limit: 5, sort: 'recent' }),
    matches.listForUser(user.user_id),
    db.all(
      `SELECT c.*, i.title AS item_title, i.type AS item_type FROM claims c
       JOIN items i ON i.item_id = c.item_id
       WHERE c.claimant_id = ? ORDER BY c.created_at DESC LIMIT 5`,
      [user.user_id],
    ),
    db.all(
      `SELECT c.*, i.title AS item_title, u.name AS claimant_name FROM claims c
       JOIN items i ON i.item_id = c.item_id
       JOIN users u ON u.user_id = c.claimant_id
       WHERE i.user_id = ? AND c.status IN ('PENDING', 'UNDER_REVIEW')
       ORDER BY c.created_at DESC LIMIT 5`,
      [user.user_id],
    ),
  ]);

  return {
    counts: {
      lost: Number(counts.lost_count ?? 0),
      found: Number(counts.found_count ?? 0),
      resolved: Number(counts.resolved_count ?? 0),
      total: Number(counts.total_count ?? 0),
      matches: userMatches.length,
      strong_matches: userMatches.filter((match) => match.match_score >= 75).length,
    },
    recent_items: sanitizeAll(recentItems.rows, user),
    recent_matches: userMatches.slice(0, 5),
    my_claims: openClaims,
    claims_to_review: pendingReviews,
  };
}

/** Landing page statistics - no authentication required. */
export async function publicStats() {
  const counts = (await repo.globalCounts()) ?? {};
  const matchStats = await matches.statistics();
  return {
    total_items: Number(counts.total_items ?? 0),
    lost: Number(counts.lost_count ?? 0),
    found: Number(counts.found_count ?? 0),
    returned: Number(counts.returned_count ?? 0) + Number(counts.closed_count ?? 0),
    matches: matchStats.total,
    average_match_score: matchStats.average_score,
  };
}

export { repo as itemsRepository };
