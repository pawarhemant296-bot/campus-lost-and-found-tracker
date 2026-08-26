import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { persistUploadedImage, uploadImage } from '../../middleware/upload.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/errors.js';
import * as claims from './claims.service.js';

const router = Router();
router.use(requireAuth);

const submitSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  match_id: z.coerce.number().int().positive().optional(),
  proof: z.string().trim().min(10, 'Describe your proof of ownership (at least 10 characters)').max(2000),
  answer: z.string().trim().max(1000).optional(),
  proof_image_url: z.string().trim().max(500).optional(),
});

const decisionSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

/** Verification question for an item, before the claim form is shown. */
router.get(
  '/prompt/:itemId',
  asyncHandler(async (req, res) => {
    res.json(await claims.verificationPrompt(Number(req.params.itemId), req.user));
  }),
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    res.json({ claims: await claims.listMine(req.user.user_id) });
  }),
);

/** Claims the caller has to review as the finder. */
router.get(
  '/incoming',
  asyncHandler(async (req, res) => {
    const openOnly = String(req.query.open ?? '') === 'true';
    res.json({ claims: await claims.listIncoming(req.user.user_id, { openOnly }) });
  }),
);

router.post(
  '/',
  uploadImage,
  asyncHandler(async (req, res, next) => {
    const imageUrl = await persistUploadedImage(req);
    if (imageUrl) req.body.proof_image_url = imageUrl;
    next();
  }),
  validateBody(submitSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ claim: await claims.submitClaim(req.user, req.body) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ claim: await claims.getById(Number(req.params.id), req.user) });
  }),
);

router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    res.json({ claim: await claims.startReview(Number(req.params.id), req.user) });
  }),
);

router.post(
  '/:id/approve',
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    res.json({ claim: await claims.decide(Number(req.params.id), req.user, { approve: true, note: req.body.note }) });
  }),
);

router.post(
  '/:id/reject',
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    res.json({ claim: await claims.decide(Number(req.params.id), req.user, { approve: false, note: req.body.note }) });
  }),
);

router.post(
  '/:id/handover',
  asyncHandler(async (req, res) => {
    res.json({ claim: await claims.confirmHandover(Number(req.params.id), req.user) });
  }),
);

router.post(
  '/:id/withdraw',
  asyncHandler(async (req, res) => {
    res.json(await claims.withdraw(Number(req.params.id), req.user));
  }),
);

export default router;
