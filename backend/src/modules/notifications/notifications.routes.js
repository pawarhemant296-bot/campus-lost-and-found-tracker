import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import * as notifications from './notifications.service.js';

const router = Router();
router.use(requireAuth);

/** GET /api/notifications?unread=true */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const unreadOnly = String(req.query.unread ?? '') === 'true';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const [items, unread] = await Promise.all([
      notifications.listForUser(req.user.user_id, { unreadOnly, limit }),
      notifications.unreadCount(req.user.user_id),
    ]);
    res.json({ notifications: items, unread });
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    res.json(await notifications.markAllRead(req.user.user_id));
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await notifications.markRead(req.user.user_id, Number(req.params.id));
    res.json({ notification });
  }),
);

export default router;
