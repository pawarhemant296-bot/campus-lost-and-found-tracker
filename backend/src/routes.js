import { Router } from 'express';
import config from './config/env.js';
import db from './db/index.js';
import { aiHealth } from './matching/aiClient.js';
import { matchingWeights } from './matching/engine.js';
import { connectedUserCount, isRealtimeReady } from './realtime/hub.js';
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import claimsRoutes from './modules/claims/claims.routes.js';
import itemsRoutes from './modules/items/items.routes.js';
import matchesRoutes from './modules/matches/matches.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import { asyncHandler } from './utils/errors.js';
import { CATEGORIES, ITEM_STATUS_ORDER } from './utils/constants.js';

const router = Router();

/** Service metadata - handy for the demo and for uptime checks. */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const dbOk = await db
      .one('SELECT 1 AS ok')
      .then(() => true)
      .catch(() => false);
    res.json({
      status: dbOk ? 'ok' : 'degraded',
      service: 'lost-found-tracker-api',
      version: '1.0.0',
      environment: config.env,
      database: { client: db.client, reachable: dbOk },
      realtime: { enabled: isRealtimeReady(), connected_clients: connectedUserCount() },
      ai_service: await aiHealth(),
      matching_weights: matchingWeights(),
      time: new Date().toISOString(),
    });
  }),
);

/** Shared reference data for the frontend forms. */
router.get('/meta', (req, res) => {
  res.json({
    categories: CATEGORIES,
    statuses: ITEM_STATUS_ORDER,
    item_types: ['lost', 'found'],
    matching_weights: matchingWeights(),
    strong_match_threshold: config.matching.strongScore,
    min_match_score: config.matching.minScore,
  });
});

router.use('/auth', authRoutes);
router.use('/items', itemsRoutes);
router.use('/matches', matchesRoutes);
router.use('/claims', claimsRoutes);
router.use('/messages', messagesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/admin', adminRoutes);

export default router;
