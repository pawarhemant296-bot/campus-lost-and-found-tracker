import { Router } from 'express';
import { db } from '../db.js';
import {
  hashPassword,
  publicUser,
  requireAuth,
  signToken,
  verifyPassword,
} from '../auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post('/register', (req, res) => {
  const { name, email, password, role = 'user', phone = null, campus = null } = req.body || {};

  if (!name || String(name).trim().length < 2)
    return res.status(400).json({ error: 'Please enter your full name' });
  if (!EMAIL_RE.test(String(email || '')))
    return res.status(400).json({ error: 'Please enter a valid email address' });
  if (!password || String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

  const hue = 200 + Math.floor(Math.random() * 120);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, phone, campus, avatar_hue)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(
      String(name).trim(),
      String(email).toLowerCase(),
      hashPassword(String(password)),
      role === 'admin' ? 'admin' : 'user',
      phone,
      campus,
      hue
    );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES (?,?,?,?,?)`
  ).run(
    user.id,
    'system',
    'Welcome to TraceBack',
    'Report a lost or found item and our matching engine will start tracing it back.',
    '/app/report/lost'
  );

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email || '').toLowerCase());

  if (!user || !verifyPassword(String(password || ''), user.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password' });
  if (user.status !== 'active')
    return res.status(403).json({ error: 'This account has been suspended. Contact an admin.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, (req, res) => {
  const { name, phone, campus, avatar_hue } = req.body || {};
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  db.prepare('UPDATE users SET name = ?, phone = ?, campus = ?, avatar_hue = ? WHERE id = ?').run(
    name?.trim() || current.name,
    phone ?? current.phone,
    campus ?? current.campus,
    Number(avatar_hue) || current.avatar_hue,
    req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(current_password || ''), user.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect' });
  if (!new_password || String(new_password).length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(String(new_password)),
    req.user.id
  );
  res.json({ ok: true });
});

export default router;
