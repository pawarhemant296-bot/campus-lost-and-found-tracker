import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import * as matches from '../matches/matches.service.js';
import * as admin from './admin.service.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json(await admin.overview());
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ users: await admin.listUsers({ q: req.query.q, limit }) });
  }),
);

router.patch(
  '/users/:id/block',
  asyncHandler(async (req, res) => {
    const blocked = req.body?.blocked !== false;
    res.json(await admin.setUserBlocked(req.user.user_id, Number(req.params.id), blocked));
  }),
);

router.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    res.json(await admin.setUserRole(req.user.user_id, Number(req.params.id), String(req.body?.role ?? '')));
  }),
);

router.patch(
  '/items/:id/hide',
  asyncHandler(async (req, res) => {
    const hidden = req.body?.hidden !== false;
    res.json(await admin.setItemHidden(req.user.user_id, Number(req.params.id), hidden, req.body?.reason));
  }),
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    res.json(await admin.deleteItem(req.user.user_id, Number(req.params.id), req.body?.reason));
  }),
);

router.get(
  '/claims',
  asyncHandler(async (req, res) => {
    res.json({ claims: await admin.listClaims({ status: req.query.status, limit: Number(req.query.limit) || 100 }) });
  }),
);

/** All stored matches, best first - dispute investigation. */
router.get(
  '/matches',
  asyncHandler(async (req, res) => {
    const minScore = Number(req.query.min_score) || 0;
    res.json({ matches: await matches.listAll({ minScore, limit: Number(req.query.limit) || 100 }) });
  }),
);

router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    res.json({ logs: await admin.auditTrail({ limit: Number(req.query.limit) || 100 }) });
  }),
);

export default router;
