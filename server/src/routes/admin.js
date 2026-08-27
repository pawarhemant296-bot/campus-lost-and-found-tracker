import { Router } from 'express';
import { db, getSettings, setSettings } from '../db.js';
import { requireAdmin } from '../auth.js';
import { DEFAULT_SETTINGS } from '../config.js';
import { notify, setStatus } from '../services.js';

const router = Router();
router.use(requireAdmin);

const count = (sql, ...params) => db.prepare(sql).get(...params).c;

/* ------------------------------------------------------------------ overview */

router.get('/overview', (_req, res) => {
  const kpis = {
    total_reports: count('SELECT COUNT(*) AS c FROM items'),
    lost_reports: count("SELECT COUNT(*) AS c FROM items WHERE type = 'lost'"),
    found_reports: count("SELECT COUNT(*) AS c FROM items WHERE type = 'found'"),
    pending_claims: count("SELECT COUNT(*) AS c FROM claims WHERE status = 'open'"),
    resolved_cases: count("SELECT COUNT(*) AS c FROM items WHERE status IN ('returned','closed')"),
    active_users: count("SELECT COUNT(*) AS c FROM users WHERE status = 'active'"),
    open_disputes: count("SELECT COUNT(*) AS c FROM disputes WHERE status = 'open'"),
    total_matches: count('SELECT COUNT(*) AS c FROM matches'),
    flagged_items: count('SELECT COUNT(*) AS c FROM items WHERE is_flagged = 1'),
  };

  const reportsByDay = db
    .prepare(
      `SELECT date(created_at) AS day,
              SUM(CASE WHEN type = 'lost' THEN 1 ELSE 0 END) AS lost,
              SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) AS found
         FROM items
        WHERE created_at >= date('now','-13 days')
        GROUP BY day ORDER BY day`
    )
    .all();

  const recent = db
    .prepare(
      `SELECT i.id, i.title, i.type, i.status, i.category, i.created_at, u.name AS reporter
         FROM items i JOIN users u ON u.id = i.user_id
        ORDER BY i.created_at DESC LIMIT 8`
    )
    .all();

  const queue = db
    .prepare(
      `SELECT c.id, c.stage, c.status, c.answer_score, c.created_at,
              i.title AS item_title, u.name AS claimant
         FROM claims c JOIN items i ON i.id = c.item_id JOIN users u ON u.id = c.claimant_id
        WHERE c.status = 'open' ORDER BY c.created_at ASC LIMIT 8`
    )
    .all();

  res.json({ kpis, reports_by_day: reportsByDay, recent_items: recent, claim_queue: queue });
});

/* --------------------------------------------------------------------- users */

router.get('/users', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.campus, u.avatar_hue, u.created_at,
              (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id) AS reports,
              (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.id) AS claims,
              (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id AND i.status IN ('returned','closed')) AS resolved
         FROM users u
        WHERE u.name LIKE ? OR u.email LIKE ?
        ORDER BY u.created_at DESC`
    )
    .all(q, q);
  res.json({ users });
});

router.patch('/users/:id', (req, res) => {
  const { role, status } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id && (role === 'user' || status === 'suspended'))
    return res.status(400).json({ error: 'You cannot demote or suspend yourself' });

  db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(
    role === 'admin' ? 'admin' : role === 'user' ? 'user' : user.role,
    ['active', 'suspended'].includes(status) ? status : user.status,
    user.id
  );
  res.json({ user: db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(user.id) });
});

/* --------------------------------------------------------------------- items */

router.get('/items', (req, res) => {
  const { status = '', type = '', q = '' } = req.query;
  const items = db
    .prepare(
      `SELECT i.*, u.name AS reporter, u.email AS reporter_email,
              (SELECT COUNT(*) FROM matches m WHERE m.lost_item_id = i.id OR m.found_item_id = i.id) AS match_count,
              (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id) AS claim_count
         FROM items i JOIN users u ON u.id = i.user_id
        WHERE (? = '' OR i.status = ?) AND (? = '' OR i.type = ?)
          AND (i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)
        ORDER BY i.created_at DESC`
    )
    .all(status, status, type, type, `%${q}%`, `%${q}%`, `%${q}%`)
    .map(({ questions, image_hash, ...rest }) => ({
      ...rest,
      question_count: JSON.parse(questions || '[]').length,
    }));
  res.json({ items });
});

router.patch('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const { status, is_flagged } = req.body || {};
  if (status) setStatus(item.id, status);
  if (is_flagged !== undefined) {
    db.prepare('UPDATE items SET is_flagged = ? WHERE id = ?').run(is_flagged ? 1 : 0, item.id);
    notify(item.user_id, {
      type: 'system',
      title: is_flagged ? 'Report hidden by a moderator' : 'Report restored',
      message: `"${item.title}" was ${is_flagged ? 'hidden pending review' : 'made visible again'}.`,
      link: `/items/${item.id}`,
    });
  }
  res.json({ item: db.prepare('SELECT * FROM items WHERE id = ?').get(item.id) });
});

router.delete('/items/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* -------------------------------------------------------------------- claims */

router.get('/claims', (req, res) => {
  const { status = '', stage = '' } = req.query;
  const claims = db
    .prepare(
      `SELECT c.id, c.stage, c.status, c.answer_score, c.created_at, c.updated_at, c.decision_note,
              i.id AS item_id, i.title AS item_title, i.type AS item_type, i.image_url AS item_image,
              cu.name AS claimant, cu.email AS claimant_email,
              ru.name AS reporter, ru.id AS reporter_id,
              (SELECT COUNT(*) FROM disputes d WHERE d.claim_id = c.id AND d.status = 'open') AS open_disputes
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN users cu ON cu.id = c.claimant_id
         JOIN users ru ON ru.id = i.user_id
        WHERE (? = '' OR c.status = ?) AND (? = '' OR c.stage = ?)
        ORDER BY c.created_at DESC`
    )
    .all(status, status, stage, stage);
  res.json({ claims });
});

/* ------------------------------------------------------------------ disputes */

router.get('/disputes', (req, res) => {
  const disputes = db
    .prepare(
      `SELECT d.*, u.name AS raised_by_name, c.stage AS claim_stage, c.status AS claim_status,
              i.title AS item_title, i.id AS item_id
         FROM disputes d
         JOIN users u ON u.id = d.raised_by
         JOIN claims c ON c.id = d.claim_id
         JOIN items i ON i.id = c.item_id
        ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.created_at DESC`
    )
    .all();
  res.json({ disputes });
});

router.patch('/disputes/:id', (req, res) => {
  const { status, resolution = '' } = req.body || {};
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  db.prepare('UPDATE disputes SET status = ?, resolution = ? WHERE id = ?').run(
    ['open', 'resolved', 'dismissed'].includes(status) ? status : dispute.status,
    resolution,
    dispute.id
  );
  notify(dispute.raised_by, {
    type: 'system',
    title: `Dispute ${status}`,
    message: resolution || 'An administrator reviewed your dispute.',
    link: '/app/claims',
  });
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- analytics */

router.get('/analytics', (_req, res) => {
  const reportsOverTime = db
    .prepare(
      `SELECT date(created_at) AS day,
              SUM(CASE WHEN type = 'lost' THEN 1 ELSE 0 END) AS lost,
              SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) AS found
         FROM items WHERE created_at >= date('now','-29 days')
        GROUP BY day ORDER BY day`
    )
    .all();

  const categoryBreakdown = db
    .prepare('SELECT category AS label, COUNT(*) AS value FROM items GROUP BY category ORDER BY value DESC')
    .all();

  const locationHotspots = db
    .prepare(
      `SELECT location AS label, COUNT(*) AS value FROM items
        WHERE location != '' GROUP BY location ORDER BY value DESC LIMIT 8`
    )
    .all();

  const statusFunnel = db
    .prepare('SELECT status AS label, COUNT(*) AS value FROM items GROUP BY status')
    .all();

  const scoreBuckets = db
    .prepare(
      `SELECT CASE
                WHEN match_score >= 90 THEN '90-100'
                WHEN match_score >= 80 THEN '80-89'
                WHEN match_score >= 70 THEN '70-79'
                WHEN match_score >= 60 THEN '60-69'
                ELSE '<60' END AS label,
              COUNT(*) AS value
         FROM matches GROUP BY label ORDER BY label DESC`
    )
    .all();

  const resolutionTrend = db
    .prepare(
      `SELECT date(c.updated_at) AS day,
              ROUND(AVG(julianday(c.updated_at) - julianday(c.created_at)) * 24, 1) AS hours
         FROM claims c WHERE c.status IN ('closed','approved')
        GROUP BY day ORDER BY day`
    )
    .all();

  const totalMatches = count('SELECT COUNT(*) AS c FROM matches');
  const confirmedMatches = count("SELECT COUNT(*) AS c FROM matches WHERE status = 'confirmed'");
  const totalClaims = count('SELECT COUNT(*) AS c FROM claims');
  const approvedClaims = count("SELECT COUNT(*) AS c FROM claims WHERE status IN ('approved','closed')");

  res.json({
    reports_over_time: reportsOverTime,
    category_breakdown: categoryBreakdown,
    location_hotspots: locationHotspots,
    status_funnel: statusFunnel,
    score_buckets: scoreBuckets,
    resolution_trend: resolutionTrend,
    rates: {
      match_success_rate: totalMatches ? Math.round((confirmedMatches / totalMatches) * 100) : 0,
      claim_approval_rate: totalClaims ? Math.round((approvedClaims / totalClaims) * 100) : 0,
      avg_resolution_hours:
        db
          .prepare(
            `SELECT ROUND(AVG(julianday(updated_at) - julianday(created_at)) * 24, 1) AS h
               FROM claims WHERE status IN ('closed','approved')`
          )
          .get().h || 0,
    },
  });
});

/* ------------------------------------------------------------------ settings */

router.get('/settings', (_req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS });
});

router.put('/settings', (req, res) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const patch = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.includes(k) && v !== null && v !== '') patch[k] = Number(v);
  }
  res.json({ settings: setSettings(patch) });
});

export default router;
