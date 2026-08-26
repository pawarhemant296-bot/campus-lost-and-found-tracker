import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/errors.js';
import * as messages from './messages.service.js';

const router = Router();
router.use(requireAuth);

const sendSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  receiver_id: z.coerce.number().int().positive(),
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});

router.get(
  '/threads',
  asyncHandler(async (req, res) => {
    const [threads, unread] = await Promise.all([
      messages.threads(req.user),
      messages.unreadTotal(req.user.user_id),
    ]);
    res.json({ threads, unread });
  }),
);

router.post(
  '/',
  validateBody(sendSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ message: await messages.sendMessage(req.user, req.body) });
  }),
);

router.get(
  '/:itemId/:userId',
  asyncHandler(async (req, res) => {
    res.json(await messages.conversation(req.user, Number(req.params.itemId), Number(req.params.userId)));
  }),
);

router.patch(
  '/:itemId/:userId/read',
  asyncHandler(async (req, res) => {
    res.json(await messages.markConversationRead(req.user, Number(req.params.itemId), Number(req.params.userId)));
  }),
);

export default router;
