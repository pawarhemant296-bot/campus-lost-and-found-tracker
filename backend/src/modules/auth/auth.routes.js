import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/errors.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from './auth.schema.js';
import * as auth from './auth.service.js';

const router = Router();

/** Brute-force guard on the credential endpoints. */
const credentialLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Try again in a few minutes.' } },
});

router.post(
  '/register',
  credentialLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await auth.register(req.body));
  }),
);

router.post(
  '/login',
  credentialLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.login(req.body));
  }),
);

router.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    res.json({ user: await auth.verifyEmail(req.body.token) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await auth.getById(req.user.user_id) });
  }),
);

router.patch(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    res.json({ user: await auth.updateProfile(req.user.user_id, req.body) });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.changePassword(req.user.user_id, req.body));
  }),
);

export default router;
