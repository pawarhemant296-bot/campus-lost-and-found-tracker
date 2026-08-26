/**
 * Admin Module - moderation, dispute handling and analytics (spec section 2, phase 7).
 * Every state-changing action is written to `audit_logs`.
 */
import db from '../../db/index.js';
import { NOTIFICATION_TYPES, ROLES, now } from '../../utils/constants.js';
import { badRequest, notFound } from '../../utils/errors.js';
import * as itemsRepo from '../items/items.repository.js';
import * as matchesService from '../matches/matches.service.js';
import { notify } from '../notifications/notifications.service.js';

async function audit(actorId, action, entityType, entityId, detail) {
  await db.run(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [actorId, action, entityType, entityId ?? null, detail ?? null, now()],
  );
}

/** Admin Dashboard: users, reports, claims and analytics. */
export async function overview() {
  const [itemCounts, matchStats, userRow, claimRow, categories, hotspots, recentAudit] = await Promise.all([
    itemsRepo.globalCounts(),
    matchesService.statistics(),
    db.one(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN role = 'admin'   THEN 1 ELSE 0 END) AS admins,
              SUM(CASE WHEN is_blocked = 1   THEN 1 ELSE 0 END) AS blocked
       FROM users`,
    ),
    db.one(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'PENDING'            THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'UNDER_REVIEW'       THEN 1 ELSE 0 END) AS under_review,
              SUM(CASE WHEN status = 'APPROVED'           THEN 1 ELSE 0 END) AS approved,
              SUM(CASE WHEN status = 'REJECTED'           THEN 1 ELSE 0 END) AS rejected,
              SUM(CASE WHEN status = 'HANDOVER_CONFIRMED' THEN 1 ELSE 0 END) AS handover_confirmed
       FROM claims`,
    ),
    itemsRepo.categoryBreakdown(),
    itemsRepo.locationHotspots(8),
    db.all(
      `SELECT a.*, u.name AS actor_name FROM audit_logs a
       LEFT JOIN users u ON u.user_id = a.actor_id
       ORDER BY a.created_at DESC, a.log_id DESC LIMIT 15`,
    ),
  ]);

  const items = {
    total: Number(itemCounts?.total_items ?? 0),
    lost: Number(itemCounts?.lost_count ?? 0),
    found: Number(itemCounts?.found_count ?? 0),
    returned: Number(itemCounts?.returned_count ?? 0),
    closed: Number(itemCounts?.closed_count ?? 0),
    hidden: Number(itemCounts?.hidden_count ?? 0),
  };
  const resolved = items.returned + items.closed;

  return {
    users: {
      total: Number(userRow?.total ?? 0),
      admins: Number(userRow?.admins ?? 0),
      blocked: Number(userRow?.blocked ?? 0),
    },
    items,
    matches: matchStats,
    claims: {
      total: Number(claimRow?.total ?? 0),
      pending: Number(claimRow?.pending ?? 0),
      under_review: Number(claimRow?.under_review ?? 0),
      approved: Number(claimRow?.approved ?? 0),
      rejected: Number(claimRow?.rejected ?? 0),
      handover_confirmed: Number(claimRow?.handover_confirmed ?? 0),
    },
    analytics: {
      resolution_rate: items.total === 0 ? 0 : Math.round((resolved / items.total) * 1000) / 10,
      categories: categories.map((row) => ({
        category: row.category,
        total: Number(row.total),
        lost: Number(row.lost_count),
        found: Number(row.found_count),
      })),
      /** Location heatmap data. */
      hotspots: hotspots.map((row) => ({ location: row.location, total: Number(row.total) })),
    },
    recent_activity: recentAudit,
  };
}

export async function listUsers({ q, limit = 50 } = {}) {
  const params = [];
  let where = '';
  if (q) {
    where = 'WHERE LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  params.push(limit);
  return db.all(
    `SELECT u.user_id, u.name, u.email, u.role, u.phone, u.email_verified, u.is_blocked, u.created_at,
            (SELECT COUNT(*) FROM items i  WHERE i.user_id = u.user_id)      AS item_count,
            (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.user_id)  AS claim_count
     FROM users u ${where}
     ORDER BY u.created_at DESC LIMIT ?`,
    params,
  );
}

export async function setUserBlocked(adminId, userId, blocked) {
  const user = await db.one('SELECT user_id, name, role FROM users WHERE user_id = ?', [userId]);
  if (!user) throw notFound('User not found');
  if (Number(userId) === Number(adminId)) throw badRequest('You cannot block your own account');

  await db.run('UPDATE users SET is_blocked = ? WHERE user_id = ?', [blocked ? 1 : 0, userId]);
  await audit(adminId, blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'user', userId, user.name);
  return { user_id: Number(userId), is_blocked: blocked ? 1 : 0 };
}

export async function setUserRole(adminId, userId, role) {
  if (![ROLES.USER, ROLES.ADMIN].includes(role)) throw badRequest('role must be "user" or "admin"');
  const user = await db.one('SELECT user_id, name FROM users WHERE user_id = ?', [userId]);
  if (!user) throw notFound('User not found');

  await db.run('UPDATE users SET role = ? WHERE user_id = ?', [role, userId]);
  await audit(adminId, 'USER_ROLE_CHANGED', 'user', userId, `${user.name} -> ${role}`);
  return { user_id: Number(userId), role };
}

/** Hide a report from public listings (moderation). */
export async function setItemHidden(adminId, itemId, hidden, reason) {
  const item = await itemsRepo.findById(itemId);
  if (!item) throw notFound('Item not found');

  await itemsRepo.updateItem(itemId, { is_hidden: hidden ? 1 : 0 });
  await audit(adminId, hidden ? 'ITEM_HIDDEN' : 'ITEM_RESTORED', 'item', itemId, reason ?? item.title);

  await notify({
    userId: item.user_id,
    type: NOTIFICATION_TYPES.ITEM_MODERATED,
    title: hidden ? 'Report hidden by moderator' : 'Report restored',
    message: hidden
      ? `Your report "${item.title}" was hidden.${reason ? ` Reason: ${reason}` : ''}`
      : `Your report "${item.title}" is public again.`,
    link: `/items/${itemId}`,
  });

  return { item_id: Number(itemId), is_hidden: hidden ? 1 : 0 };
}

export async function deleteItem(adminId, itemId, reason) {
  const item = await itemsRepo.findById(itemId);
  if (!item) throw notFound('Item not found');
  await itemsRepo.deleteItem(itemId);
  await audit(adminId, 'ITEM_DELETED', 'item', itemId, reason ?? item.title);
  await notify({
    userId: item.user_id,
    type: NOTIFICATION_TYPES.ITEM_MODERATED,
    title: 'Report removed',
    message: `Your report "${item.title}" was removed by a moderator.${reason ? ` Reason: ${reason}` : ''}`,
  });
  return { deleted: true, item_id: Number(itemId) };
}

/** Every claim in the system - dispute handling queue. */
export async function listClaims({ status, limit = 100 } = {}) {
  const params = [];
  let where = '';
  if (status) {
    where = 'WHERE c.status = ?';
    params.push(status);
  }
  params.push(limit);
  return db.all(
    `SELECT c.*, u.name AS claimant_name, i.title AS item_title, i.type AS item_type,
            i.status AS item_status, owner.name AS item_owner_name, i.user_id AS item_owner_id
     FROM claims c
     JOIN users u     ON u.user_id = c.claimant_id
     JOIN items i     ON i.item_id = c.item_id
     JOIN users owner ON owner.user_id = i.user_id
     ${where}
     ORDER BY c.created_at DESC LIMIT ?`,
    params,
  );
}

export async function auditTrail({ limit = 100 } = {}) {
  return db.all(
    `SELECT a.*, u.name AS actor_name FROM audit_logs a
     LEFT JOIN users u ON u.user_id = a.actor_id
     ORDER BY a.created_at DESC, a.log_id DESC LIMIT ?`,
    [limit],
  );
}

export { audit as recordAudit };
