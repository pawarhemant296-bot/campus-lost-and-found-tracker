import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { CATEGORIES, CLAIM_STAGES, LOCATIONS, QUESTION_TEMPLATES, STATUSES } from '../constants.js';
import { hasSharp } from '../images.js';
import { STATUS_LABELS } from '../services.js';

const router = Router();

router.get('/', (_req, res) => {
  const s = getSettings();
  res.json({
    categories: CATEGORIES,
    locations: LOCATIONS,
    statuses: STATUSES,
    status_labels: STATUS_LABELS,
    claim_stages: CLAIM_STAGES,
    question_templates: QUESTION_TEMPLATES,
    matching: {
      weights: {
        category: s.weight_category,
        description: s.weight_description,
        location: s.weight_location,
        date: s.weight_date,
        image: s.weight_image,
      },
      threshold: s.match_threshold,
      strong_threshold: s.strong_match_threshold,
      image_similarity_enabled: hasSharp,
    },
  });
});

/** Public counters for the landing page stats bar. */
router.get('/stats', (_req, res) => {
  const c = (sql) => db.prepare(sql).get().c;
  const reported = c('SELECT COUNT(*) AS c FROM items');
  const returned = c("SELECT COUNT(*) AS c FROM items WHERE status IN ('returned','closed')");
  const matches = c('SELECT COUNT(*) AS c FROM matches');
  const confirmed = c("SELECT COUNT(*) AS c FROM matches WHERE status IN ('confirmed','claimed')");
  res.json({
    items_reported: reported,
    items_returned: returned,
    active_users: c("SELECT COUNT(*) AS c FROM users WHERE status = 'active'"),
    total_matches: matches,
    match_success_rate: matches ? Math.round((confirmed / matches) * 100) : 0,
    avg_trace_hours:
      db
        .prepare(
          `SELECT ROUND(AVG(julianday(updated_at) - julianday(created_at)) * 24, 1) AS h
             FROM items WHERE status IN ('returned','closed')`
        )
        .get().h || 0,
  });
});

/** A small public feed used by the landing page ("recently traced back"). */
router.get('/showcase', (_req, res) => {
  const items = db
    .prepare(
      `SELECT i.id, i.title, i.type, i.category, i.location, i.status, i.item_date, i.image_url
         FROM items i WHERE i.is_flagged = 0 ORDER BY i.created_at DESC LIMIT 6`
    )
    .all();
  res.json({ items });
});

export default router;
