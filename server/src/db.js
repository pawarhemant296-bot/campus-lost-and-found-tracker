import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config, DEFAULT_SETTINGS } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',      -- user | admin
  phone         TEXT,
  campus        TEXT,
  avatar_hue    INTEGER NOT NULL DEFAULT 265,
  status        TEXT    NOT NULL DEFAULT 'active',    -- active | suspended
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,                     -- lost | found
  title         TEXT    NOT NULL,
  category      TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  location      TEXT    NOT NULL DEFAULT '',
  item_date     TEXT    NOT NULL,                     -- ISO datetime of loss/find
  image_url     TEXT,
  image_hash    TEXT,                                 -- 64-bit dHash (hex) for image similarity
  status        TEXT    NOT NULL DEFAULT 'reported',
  -- reported | possible_match | claim_requested | verification | returned | closed
  questions     TEXT    NOT NULL DEFAULT '[]',        -- JSON [{q,a}] private ownership questions
  is_flagged    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lost_item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  match_score    REAL    NOT NULL,
  breakdown      TEXT    NOT NULL DEFAULT '{}',       -- JSON per-factor scores
  status         TEXT    NOT NULL DEFAULT 'pending',  -- pending | claimed | confirmed | rejected
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lost_item_id, found_item_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  match_id      INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  claimant_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof         TEXT    NOT NULL DEFAULT '{}',        -- JSON {answers:[], note, evidence_url}
  answer_score  REAL,                                 -- auto-scored verification answers 0-100
  stage         TEXT    NOT NULL DEFAULT 'submitted',
  -- submitted | verification | review | handover | returned | rejected
  status        TEXT    NOT NULL DEFAULT 'open',      -- open | approved | rejected | closed
  decided_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL,
  message     TEXT    NOT NULL,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,   -- match | claim | message | system
  title       TEXT    NOT NULL,
  message     TEXT    NOT NULL DEFAULT '',
  link        TEXT,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disputes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id   INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  raised_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open',   -- open | resolved | dismissed
  resolution TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(type, status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);
`);

const insertSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  insertSetting.run(key, String(value));
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    const n = Number(value);
    out[key] = Number.isNaN(n) ? value : n;
  }
  return out;
}

export function setSettings(patch) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) stmt.run(k, String(v));
  });
  tx(Object.entries(patch));
  return getSettings();
}

export default db;
