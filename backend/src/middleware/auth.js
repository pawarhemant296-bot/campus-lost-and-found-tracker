import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import db from '../db/index.js';
import { ROLES } from '../utils/constants.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.user_id, email: user.email, role: user.role, name: user.name },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret);
}

function readToken(req) {
  const header = req.headers.authorization ?? '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (req.query?.token) return String(req.query.token);
  return null;
}

/** Loads the caller into `req.user`. Rejects blocked accounts. */
async function loadUser(token) {
  const payload = verifyToken(token);
  const user = await db.one(
    'SELECT user_id, name, email, role, phone, email_verified, is_blocked, created_at FROM users WHERE user_id = ?',
    [payload.sub],
  );
  if (!user) throw unauthorized('Account no longer exists');
  if (user.is_blocked) throw forbidden('This account has been blocked by an administrator');
  return user;
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  loadUser(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((error) => {
      if (error.status) return next(error);
      next(unauthorized('Invalid or expired session token'));
    });
}

/** Attaches `req.user` when a token is present, but never blocks the request. */
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  loadUser(token)
    .then((user) => {
      req.user = user;
    })
    .catch(() => {})
    .finally(() => next());
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== ROLES.ADMIN) return next(forbidden('Administrator access required'));
  next();
}
