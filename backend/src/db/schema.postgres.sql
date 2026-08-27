-- Lost & Found Item Tracker - PostgreSQL schema (spec section 9)
-- Column names match the SQLite schema exactly so application SQL is portable.

CREATE TABLE IF NOT EXISTS users (
  user_id            SERIAL PRIMARY KEY,
  name               TEXT        NOT NULL,
  email              TEXT        NOT NULL UNIQUE,
  password_hash      TEXT        NOT NULL,
  role               TEXT        NOT NULL DEFAULT 'user',
  phone              TEXT,
  email_verified     SMALLINT    NOT NULL DEFAULT 0,
  verification_token TEXT,
  is_blocked         SMALLINT    NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  item_id               SERIAL PRIMARY KEY,
  user_id               INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  category              TEXT        NOT NULL,
  description           TEXT        NOT NULL DEFAULT '',
  location              TEXT        NOT NULL DEFAULT '',
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  occurred_at           TIMESTAMPTZ NOT NULL,
  image_url             TEXT,
  status                TEXT        NOT NULL DEFAULT 'REPORTED',
  verification_question TEXT,
  secret_details        TEXT,
  is_hidden             SMALLINT    NOT NULL DEFAULT 0,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(type, status);
CREATE INDEX IF NOT EXISTS idx_items_category    ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_user        ON items(user_id);

CREATE TABLE IF NOT EXISTS matches (
  match_id      SERIAL PRIMARY KEY,
  lost_item_id  INTEGER     NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  found_item_id INTEGER     NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  match_score   REAL        NOT NULL,
  breakdown     TEXT,
  status        TEXT        NOT NULL DEFAULT 'POSSIBLE',
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_lost  ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id);

CREATE TABLE IF NOT EXISTS claims (
  claim_id        SERIAL PRIMARY KEY,
  item_id         INTEGER     NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  claimant_id     INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  match_id        INTEGER     REFERENCES matches(match_id) ON DELETE SET NULL,
  proof           TEXT        NOT NULL DEFAULT '',
  answer          TEXT,
  proof_image_url TEXT,
  status          TEXT        NOT NULL DEFAULT 'PENDING',
  auto_score      REAL,
  image_score     REAL,
  image_verdict   TEXT,
  reviewer_id     INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_item     ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status   ON claims(status);

CREATE TABLE IF NOT EXISTS messages (
  message_id  SERIAL PRIMARY KEY,
  sender_id   INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id     INTEGER     NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  message     TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,
  timestamp   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(item_id, sender_id, receiver_id);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id         INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            TEXT        NOT NULL,
  title           TEXT        NOT NULL DEFAULT '',
  message         TEXT        NOT NULL,
  link            TEXT,
  read_status     SMALLINT    NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_status);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      SERIAL PRIMARY KEY,
  actor_id    INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   INTEGER,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL
);
