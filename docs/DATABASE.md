# Database design

Two schema files with identical table and column names:
`backend/src/db/schema.sqlite.sql` and `backend/src/db/schema.postgres.sql`.

```
users ──1:N── items ──1:N── claims ──N:1── users (claimant)
  │             │   │
  │             │   └──1:N── messages
  │             │
  │             └──N:M── matches (lost_item_id, found_item_id)
  │
  ├──1:N── notifications
  └──1:N── audit_logs (actor)
```

## users

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | PK | |
| `name`, `email`, `password_hash` | text | email unique, compared case-insensitively |
| `role` | text | `user` \| `admin` — the first account created becomes admin |
| `phone` | text | shared only after a claim is approved |
| `email_verified`, `verification_token` | int / text | used when `ALLOWED_EMAIL_DOMAINS` is set |
| `is_blocked` | int | checked on every authenticated request |
| `created_at` | timestamp | |

## items

| Column | Type | Notes |
| --- | --- | --- |
| `item_id` | PK | |
| `user_id` | FK → users | the reporter |
| `type` | text | `lost` \| `found` |
| `title`, `category`, `description`, `location` | text | matching inputs |
| `latitude`, `longitude` | real | optional; enables distance-based location scoring |
| `occurred_at` | timestamp | when the item was lost/found (not when it was reported) |
| `image_url` | text | local `/uploads/...` or a Cloudinary URL |
| `status` | text | lifecycle below |
| `verification_question` | text | shown to claimants |
| **`secret_details`** | text | **private ownership proof — never returned by the API** |
| `is_hidden` | int | admin moderation; hidden items leave public listings and matching |
| `resolved_at`, `created_at`, `updated_at` | timestamp | |

Indexes: `(type, status)`, `category`, `user_id`.

### Item status lifecycle

```
REPORTED → POSSIBLE_MATCH → CLAIM_REQUESTED → VERIFICATION → RETURNED → CLOSED
```

| Transition | Trigger |
| --- | --- |
| `REPORTED → POSSIBLE_MATCH` | the engine stores a match for the item |
| `POSSIBLE_MATCH → CLAIM_REQUESTED` | somebody submits a claim |
| `CLAIM_REQUESTED → VERIFICATION` | the finder/admin starts the review or approves it |
| `VERIFICATION → POSSIBLE_MATCH` | the last open claim is rejected or withdrawn (back to the pool) |
| `VERIFICATION → RETURNED` | handover confirmed; the claimant's matched report closes too |
| `RETURNED → CLOSED` | the owner or an admin closes the case |

`RETURNED` and `CLOSED` are terminal: those items are excluded from the matching pool and can no
longer be claimed or edited by their owner.

## matches

| Column | Type | Notes |
| --- | --- | --- |
| `match_id` | PK | |
| `lost_item_id`, `found_item_id` | FK → items | `UNIQUE (lost_item_id, found_item_id)` |
| `match_score` | real | 0–100 |
| `breakdown` | text (JSON) | per-factor scores, weights, reasons, keywords, `ai_used` |
| `status` | text | `POSSIBLE` \| `CONFIRMED` \| `REJECTED` |
| `created_at`, `updated_at` | timestamp | |

The unique constraint makes re-running the engine an upsert: scores update, duplicates never appear.
`breakdown` is stored as JSON so the UI can explain an old match without re-computing it.

## claims

| Column | Type | Notes |
| --- | --- | --- |
| `claim_id` | PK | |
| `item_id`, `claimant_id` | FK | you cannot claim your own report |
| `match_id` | FK, nullable | set when the claim came from a suggested match; approving it confirms the match |
| `proof` | text | free-text ownership evidence |
| `answer` | text | answer to `verification_question` |
| `proof_image_url` | text | optional supporting photo |
| `auto_score` | real | similarity between the answer/proof and `secret_details` — guidance only |
| `status` | text | `PENDING` → `UNDER_REVIEW` → `APPROVED` \| `REJECTED` → `HANDOVER_CONFIRMED` |
| `reviewer_id`, `review_note` | FK / text | who decided, and why |
| `created_at`, `updated_at` | timestamp | |

Only one open claim per (item, claimant) is allowed, and approving a claim automatically rejects the
other open claims on that item with the note "Another claim was approved for this item".

## messages

| Column | Type | Notes |
| --- | --- | --- |
| `message_id` | PK | |
| `sender_id`, `receiver_id` | FK → users | |
| `item_id` | FK → items | conversations are always scoped to one item |
| `message` | text | |
| `read_at` | timestamp | drives unread counters |
| `timestamp` | timestamp | |

Permission to converse is derived, not stored: the item reporter, anyone who claimed the item, and
the owner of a matched counterpart report.

## notifications

| Column | Type | Notes |
| --- | --- | --- |
| `notification_id` | PK | |
| `user_id` | FK → users | |
| `type` | text | `MATCH_FOUND`, `CLAIM_SUBMITTED`, `CLAIM_APPROVED`, `CLAIM_REJECTED`, `HANDOVER_CONFIRMED`, `MESSAGE_RECEIVED`, `ITEM_MODERATED` |
| `title`, `message` | text | |
| `link` | text | frontend route the bell should open |
| `read_status` | int | 0 unread / 1 read |
| `created_at` | timestamp | |

## audit_logs

Append-only record of moderation for dispute handling: `actor_id`, `action`
(`ITEM_HIDDEN`, `ITEM_RESTORED`, `ITEM_DELETED`, `USER_BLOCKED`, `USER_UNBLOCKED`,
`USER_ROLE_CHANGED`), `entity_type`, `entity_id`, `detail`, `created_at`.

## Conventions

- Timestamps are **ISO-8601 strings** everywhere in the API. PostgreSQL `TIMESTAMPTZ` values are
  normalised back to ISO strings by the data layer, so both drivers produce identical JSON.
- Booleans are stored as `0/1` integers for dialect parity.
- Foreign keys cascade on delete (`ON DELETE CASCADE`), except reviewer/actor references which
  become `NULL` so history survives account deletion.

## Commands

```bash
npm run db:migrate --prefix backend         # create missing tables
node backend/src/db/migrate.js --fresh      # drop and recreate everything
npm run db:seed --prefix backend            # fresh schema + demo data
node backend/src/db/seed.js --keep          # add demo data to an existing database
```
