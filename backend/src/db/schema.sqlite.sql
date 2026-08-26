-- Lost & Found Item Tracker - SQLite schema (spec section 9)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  email              TEXT    NOT NULL UNIQUE,
  password_hash      TEXT    NOT NULL,
  role               TEXT    NOT NULL DEFAULT 'user',      -- user | admin
  phone              TEXT,
  email_verified     INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  is_blocked         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  item_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type                  TEXT    NOT NULL,                  -- lost | found
  title                 TEXT    NOT NULL,
  category              TEXT    NOT NULL,
  description           TEXT    NOT NULL DEFAULT '',
  location              TEXT    NOT NULL DEFAULT '',
  latitude              REAL,
  longitude             REAL,
  occurred_at           TEXT    NOT NULL,                  -- when the item was lost / found
  image_url             TEXT,
  status                TEXT    NOT NULL DEFAULT 'REPORTED',
  -- Private ownership proof, never exposed by the public API (spec section 7)
  verification_question TEXT,
  secret_details        TEXT,
  is_hidden             INTEGER NOT NULL DEFAULT 0,         -- admin moderation
  resolved_at           TEXT,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(type, status);
CREATE INDEX IF NOT EXISTS idx_items_category    ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_user        ON items(user_id);

CREATE TABLE IF NOT EXISTS matches (
  match_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  lost_item_id  INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  found_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  match_score   REAL    NOT NULL,                          -- 0-100
  breakdown     TEXT,                                      -- JSON: per-factor scores + reasons
  status        TEXT    NOT NULL DEFAULT 'POSSIBLE',        -- POSSIBLE | CONFIRMED | REJECTED
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_lost  ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id);

CREATE TABLE IF NOT EXISTS claims (
  claim_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  claimant_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  match_id        INTEGER REFERENCES matches(match_id) ON DELETE SET NULL,
  proof           TEXT    NOT NULL DEFAULT '',             -- free-text ownership proof
  answer          TEXT,                                    -- answer to verification_question
  proof_image_url TEXT,
  status          TEXT    NOT NULL DEFAULT 'PENDING',       -- PENDING | UNDER_REVIEW | APPROVED | REJECTED | HANDOVER_CONFIRMED
  auto_score      REAL,                                    -- similarity between answer and secret_details
  reviewer_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  review_note     TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_item     ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status   ON claims(status);

CREATE TABLE IF NOT EXISTS messages (
  message_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  message     TEXT    NOT NULL,
  read_at     TEXT,
  timestamp   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(item_id, sender_id, receiver_id);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            TEXT    NOT NULL,                        -- MATCH_FOUND | CLAIM_SUBMITTED | ...
  title           TEXT    NOT NULL DEFAULT '',
  message         TEXT    NOT NULL,
  link            TEXT,                                    -- frontend route to open
  read_status     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_status);

-- Admin moderation / dispute trail
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   INTEGER,
  detail      TEXT,
  created_at  TEXT    NOT NULL
);
