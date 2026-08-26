# Architecture

## System overview

```
USERS / ADMIN
     │
     ▼
┌──────────────────────────────┐
│ FRONTEND — React + Vite      │  Router, AuthContext, NotificationContext
└──────────────┬───────────────┘
               │ REST (JSON, JWT bearer) + Socket.IO
               ▼
┌──────────────────────────────┐
│ BACKEND — Node.js + Express  │
│                              │
│  routes.js                   │  /api/{auth,items,matches,claims,
│    └── modules/*             │        messages,notifications,admin}
│  middleware/                 │  auth · validate · upload · error
│  matching/                   │  similarity → engine → aiClient
│  realtime/hub.js             │  Socket.IO rooms: user:<id>, item:<id>
│  db/index.js                 │  one API, two SQL dialects
└─────┬──────────────────┬─────┘
      │                  │
      ▼                  ▼
┌─────────────┐   ┌────────────────────────┐
│ SQLite      │   │ AI SERVICE (optional)  │
│ PostgreSQL  │   │ FastAPI, /similarity   │
└─────────────┘   └────────────────────────┘
```

## Module map

Every domain module owns its business rules and its HTTP surface:

| Module | Files | Responsibility |
| --- | --- | --- |
| `auth` | `auth.service.js`, `auth.routes.js`, `auth.schema.js` | register, login, profile, password change, email verification |
| `items` | `items.service.js`, `items.repository.js`, `items.routes.js`, `items.schema.js` | lost/found reports, search & filter, status lifecycle, dashboards |
| `matches` | `matches.service.js`, `matches.routes.js` | runs the engine, stores matches, notifies both sides, rescoring |
| `claims` | `claims.service.js`, `claims.routes.js` | verification prompt, claim submission, grading, decisions, handover |
| `messages` | `messages.service.js`, `messages.routes.js` | item-scoped conversations and threads |
| `notifications` | `notifications.service.js`, `notifications.routes.js` | the only writer to the notifications table; pushes over Socket.IO |
| `admin` | `admin.service.js`, `admin.routes.js` | analytics, moderation, disputes, audit trail |

Cross-module rules:

- **Routes never touch SQL.** They validate input (zod), call a service and shape the response.
- **Services own invariants** such as "an item cannot walk backwards in its lifecycle" or
  "only the finder or an admin may decide a claim".
- **Only `notifications.service.js` writes notifications**, so every user-facing event travels
  through one code path and is automatically delivered over the socket.
- `items.service` depends on `matches.service`, and `matches.service` depends on
  `items.repository` (not `items.service`) — that keeps the dependency graph acyclic.

## Request lifecycle: reporting a found item

```
POST /api/items/found        (multipart: fields + photo)
  │
  ├─ requireAuth ................. verifies the JWT, loads the user, rejects blocked accounts
  ├─ uploadImage ................. multer, memory storage, 5 MB / image mime allow-list
  ├─ persistUploadedImage ........ writes to ./uploads (or Cloudinary) → sets body.image_url
  ├─ validateBody(createItemSchema) zod: coerces types, rejects future dates
  │
  ├─ items.service.createReport
  │    ├─ items.repository.insertItem ................ status = REPORTED
  │    └─ matches.service.runMatchingForItem
  │         ├─ items.repository.findMatchCandidates .. opposite type, not resolved, other users
  │         ├─ engine.rankCandidates
  │         │    └─ scorePairAsync → aiClient (optional) → scorePair (weighted)
  │         ├─ upsert matches with score >= MATCH_MIN_SCORE
  │         ├─ promote both items to POSSIBLE_MATCH
  │         └─ notifications.notify(both owners) → Socket.IO push
  │
  └─ 201 { item, matches, best_match, new_matches }
```

The engine call is wrapped in try/catch: **a matching failure can never lose a user's report.**

## Data layer: one API, two dialects

`backend/src/db/index.js` exposes `all / one / run / insertReturning / script / transaction`.
Application code writes portable SQL with `?` placeholders; the adapter rewrites them to `$1, $2`
for PostgreSQL, normalises `Date` objects back to ISO strings, and converts booleans for SQLite.
Both dialects support `INSERT ... RETURNING`, so services always get the written row back.

Why two drivers: SQLite makes the project clone-and-run with zero setup (critical when demoing
on someone else's laptop), while PostgreSQL is what the spec recommends for deployment. Same
schema, same column names, same behaviour — `schema.sqlite.sql` and `schema.postgres.sql`.

Migrations run automatically on boot (`server.js` → `migrate()`), so `npm start` on a fresh clone
always has a valid schema.

## Security model

| Concern | Implementation |
| --- | --- |
| Passwords | bcrypt, configurable cost (`BCRYPT_ROUNDS`) |
| Sessions | signed JWT, `Authorization: Bearer`, expiry `JWT_EXPIRES_IN` |
| Blocked users | checked on **every** request, not just at login |
| Ownership proof | `items.secret_details` is stripped in `sanitize()` and never returned to anyone |
| Contact details | revealed only when a claim reaches `APPROVED` / `HANDOVER_CONFIRMED` |
| Messaging | restricted to the reporter, claimants and matched counterparts of one item |
| Claim integrity | you cannot claim your own report; one open claim per (item, claimant); approving one claim auto-rejects the rest |
| Admin actions | `requireAdmin` + append-only `audit_logs` |
| Abuse | rate limiter on login/register, helmet headers, strict CORS allow-list |
| Uploads | mime allow-list, size cap, random filenames (no user-controlled paths) |

## Realtime

Socket.IO authenticates with the same JWT during the handshake and joins `user:<id>`. The REST
endpoints remain the source of truth: they persist first, then push. Clients that never open a
socket still work because the notification context also polls every 30 seconds.

## Frontend structure

- `api/client.js` — fetch wrapper: attaches the JWT, unwraps `{ error: { message } }`,
  clears a dead token on 401, and supports multipart uploads.
- `context/AuthContext` — restores the session on first paint, exposes `login/register/logout`.
- `context/NotificationContext` — bell state from socket pushes + polling fallback.
- `hooks/useApi` — small `{ data, error, loading, reload }` fetch hook used by every screen.
- `pages/*` — one file per screen; `components/*` holds the reusable pieces
  (`ItemCard`, `MatchCard`, `MatchScore`, `StatusTimeline`, `NotificationBell`).

## Deliberate trade-offs

- **No ORM.** The schema is small and explicit SQL keeps the dual-dialect story honest and
  readable for reviewers.
- **Plain CSS design system** instead of a component library: no build complexity, and the
  whole visual language is one readable file.
- **AI is additive, never required.** `aiClient.js` has a 30-second circuit breaker: if the
  Python service is slow or down, the engine silently continues with its own heuristics.
- **Weights live in configuration.** Judges can retune the engine live and re-score every match
  from the admin dashboard.
