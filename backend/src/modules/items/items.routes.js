import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { persistUploadedImage, uploadImage } from '../../middleware/upload.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { CATEGORIES, ITEM_STATUS_ORDER } from '../../utils/constants.js';
import { asyncHandler } from '../../utils/errors.js';
import * as matches from '../matches/matches.service.js';
import { createItemSchema, searchQuerySchema, updateItemSchema } from './items.schema.js';
import * as items from './items.service.js';

const router = Router();

/** Turns a multipart request into a validated body with the stored image URL. */
const withImage = (schema) => [
  uploadImage,
  asyncHandler(async (req, res, next) => {
    const imageUrl = await persistUploadedImage(req);
    if (imageUrl) req.body.image_url = imageUrl;
    next();
  }),
  validateBody(schema),
];

// --- reference data ---------------------------------------------------------

router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES, statuses: ITEM_STATUS_ORDER });
});

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    res.json(await items.publicStats());
  }),
);

router.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await items.dashboard(req.user));
  }),
);

/** My Reports screen. */
router.get(
  '/mine',
  requireAuth,
  validateQuery(searchQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await items.searchItems({ ...req.validatedQuery, user_id: req.user.user_id }, req.user));
  }),
);

// --- search & create --------------------------------------------------------

/** Public search & filter: category, location, date range, keyword. */
router.get(
  '/',
  optionalAuth,
  validateQuery(searchQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await items.searchItems(req.validatedQuery, req.user ?? null));
  }),
);

/** Report Lost Item / Report Found Item (type in the body). */
router.post(
  '/',
  requireAuth,
  ...withImage(createItemSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await items.createReport(req.user, req.body));
  }),
);

/** Convenience aliases so the two report forms have dedicated endpoints. */
for (const type of ['lost', 'found']) {
  router.post(
    `/${type}`,
    requireAuth,
    uploadImage,
    asyncHandler(async (req, res, next) => {
      const imageUrl = await persistUploadedImage(req);
      if (imageUrl) req.body.image_url = imageUrl;
      req.body.type = type;
      next();
    }),
    validateBody(createItemSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json(await items.createReport(req.user, req.body));
    }),
  );
}

// --- single item ------------------------------------------------------------

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await items.getItem(Number(req.params.id), req.user ?? null));
  }),
);

router.patch(
  '/:id',
  requireAuth,
  ...withImage(updateItemSchema),
  asyncHandler(async (req, res) => {
    res.json({ item: await items.updateReport(Number(req.params.id), req.user, req.body) });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await items.deleteReport(Number(req.params.id), req.user));
  }),
);

router.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ item: await items.closeCase(Number(req.params.id), req.user) });
  }),
);

// --- matching ---------------------------------------------------------------

router.get(
  '/:id/matches',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json({ matches: await matches.listForItem(Number(req.params.id)) });
  }),
);

/** Score without storing - "why did this match?" preview. */
router.get(
  '/:id/match-preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ candidates: await matches.previewForItem(Number(req.params.id)) });
  }),
);

/** Re-run the engine on demand (demo friendly). */
router.post(
  '/:id/rematch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { item } = await items.getItem(Number(req.params.id), req.user);
    const result = await matches.runMatchingForItem({ ...item, user_id: item.user_id });
    res.json({ matches: result.matches, new_matches: result.created, best_match: result.best });
  }),
);

export default router;
