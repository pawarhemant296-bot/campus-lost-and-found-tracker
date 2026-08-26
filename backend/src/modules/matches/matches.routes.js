import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { matchingWeights } from '../../matching/engine.js';
import { asyncHandler } from '../../utils/errors.js';
import * as matches from './matches.service.js';

const router = Router();

/** The weights behind every score - shown on the "why this match" panel. */
router.get('/weights', (req, res) => {
  const weights = matchingWeights();
  res.json({
    weights,
    weights_pct: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.round(value * 100)])),
  });
});

/** Possible Matches screen: every match touching the caller's reports. */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const minScore = Number(req.query.min_score) || 0;
    res.json({ matches: await matches.listForUser(req.user.user_id, { minScore }) });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ match: await matches.getById(Number(req.params.id), req.user) });
  }),
);

/** Participants confirm or dismiss a suggestion. */
router.patch(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? '').toUpperCase();
    res.json({ match: await matches.setStatus(Number(req.params.id), status, req.user) });
  }),
);

/** Admin: recompute every stored match (after tuning weights / enabling AI). */
router.post(
  '/rescore',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await matches.rescoreAll());
  }),
);

export default router;
