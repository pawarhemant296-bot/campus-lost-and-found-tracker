import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db } from './db.js';

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compareSync(plain, hash);

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
}

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.query.token || null;
}

/** Attaches req.user when a valid token is present, but never rejects. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
      if (user && user.status === 'active') req.user = publicUser(user);
    } catch {
      /* ignore invalid tokens on public routes */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return next();
}
