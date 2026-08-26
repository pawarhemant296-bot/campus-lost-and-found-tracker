/**
 * User Module - registration, login, profile (spec section 2 / phase 2).
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import config from '../../config/env.js';
import db from '../../db/index.js';
import { signToken } from '../../middleware/auth.js';
import { ROLES, now } from '../../utils/constants.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../utils/errors.js';

const PUBLIC_FIELDS = 'user_id, name, email, role, phone, email_verified, is_blocked, created_at';

export function toPublicUser(row) {
  if (!row) return null;
  const { password_hash: _hash, verification_token: _token, ...rest } = row;
  return { ...rest, email_verified: Number(rest.email_verified ?? 0) === 1 };
}

function assertEmailDomainAllowed(email) {
  const allowed = config.auth.allowedEmailDomains;
  if (allowed.length === 0) return;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const ok = allowed.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
  if (!ok) {
    throw forbidden(`Registration is restricted to: ${allowed.map((d) => `@${d}`).join(', ')}`);
  }
}

export async function register({ name, email, password, phone, role }) {
  const normalizedEmail = email.trim().toLowerCase();
  assertEmailDomainAllowed(normalizedEmail);

  const existing = await db.one('SELECT user_id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // The very first account becomes the administrator so a fresh install is usable.
  const { total } = (await db.one('SELECT COUNT(*) AS total FROM users')) ?? { total: 0 };
  const isFirstUser = Number(total) === 0;
  const resolvedRole = isFirstUser ? ROLES.ADMIN : role === ROLES.ADMIN ? ROLES.USER : ROLES.USER;

  const user = await db.insertReturning(
    `INSERT INTO users (name, email, password_hash, role, phone, email_verified, verification_token, is_blocked, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     RETURNING *`,
    [
      name.trim(),
      normalizedEmail,
      passwordHash,
      resolvedRole,
      phone ?? null,
      config.auth.allowedEmailDomains.length > 0 ? 0 : 1,
      verificationToken,
      now(),
    ],
  );

  return {
    user: toPublicUser(user),
    token: signToken(user),
    // Returned instead of sending mail: keeps the hackathon demo self-contained.
    verification_token: user.email_verified ? null : verificationToken,
  };
}

export async function login({ email, password }) {
  const user = await db.one('SELECT * FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()]);
  if (!user) throw unauthorized('Email or password is incorrect');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw unauthorized('Email or password is incorrect');
  if (Number(user.is_blocked) === 1) throw forbidden('This account has been blocked by an administrator');

  return { user: toPublicUser(user), token: signToken(user) };
}

export async function verifyEmail(token) {
  const user = await db.one('SELECT * FROM users WHERE verification_token = ?', [token]);
  if (!user) throw badRequest('Verification link is invalid or already used');
  await db.run('UPDATE users SET email_verified = 1, verification_token = NULL WHERE user_id = ?', [user.user_id]);
  return toPublicUser({ ...user, email_verified: 1 });
}

export async function getById(userId) {
  const user = await db.one(`SELECT ${PUBLIC_FIELDS} FROM users WHERE user_id = ?`, [userId]);
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

export async function updateProfile(userId, { name, phone }) {
  const user = await db.one('SELECT * FROM users WHERE user_id = ?', [userId]);
  if (!user) throw notFound('User not found');
  const updated = await db.insertReturning(
    `UPDATE users SET name = ?, phone = ? WHERE user_id = ? RETURNING ${PUBLIC_FIELDS}`,
    [name?.trim() || user.name, phone ?? user.phone, userId],
  );
  return toPublicUser(updated);
}

export async function changePassword(userId, { current_password, new_password }) {
  const user = await db.one('SELECT * FROM users WHERE user_id = ?', [userId]);
  if (!user) throw notFound('User not found');
  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) throw badRequest('Current password is incorrect');
  const passwordHash = await bcrypt.hash(new_password, config.auth.bcryptRounds);
  await db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
  return { updated: true };
}

/** Minimal contact card shown once a claim is approved (Communication Module). */
export async function contactCard(userId) {
  const user = await db.one('SELECT user_id, name, email, phone FROM users WHERE user_id = ?', [userId]);
  if (!user) throw notFound('User not found');
  return user;
}
