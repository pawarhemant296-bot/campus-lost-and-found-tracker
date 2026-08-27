# REST API reference

Base URL: `http://localhost:4000/api`

- Authentication: `Authorization: Bearer <jwt>` (obtained from register/login).
- Errors always look like `{ "error": { "message": "...", "details": [...] } }`.
- Timestamps are ISO-8601 strings. Booleans are `0` / `1`.
- Endpoints that accept a photo take **either** `multipart/form-data` (field `image`) **or**
  JSON with an `image_url`.

---

## Service

### `GET /health`

```json
{
  "status": "ok",
  "database": { "client": "sqlite", "reachable": true },
  "realtime": { "enabled": true, "connected_clients": 2 },
  "ai_service": { "enabled": false, "reachable": false },
  "matching_weights": { "category": 0.25, "description": 0.25, "location": 0.2, "time": 0.15, "image": 0.15 }
}
```

### `GET /meta`

Categories, statuses, item types, matching weights and the score thresholds — used by the frontend
forms.

---

## Auth

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | `{ name, email, password, phone? }` |
| POST | `/auth/login` | – | `{ email, password }` |
| POST | `/auth/verify-email` | – | `{ token }` |
| GET | `/auth/me` | ✔ | – |
| PATCH | `/auth/me` | ✔ | `{ name?, phone? }` |
| POST | `/auth/change-password` | ✔ | `{ current_password, new_password }` |

```bash
curl -X POST localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ananya@campus.edu","password":"demo1234"}'
```

```json
{
  "user": { "user_id": 2, "name": "Ananya Sharma", "email": "ananya@campus.edu", "role": "user", "email_verified": true },
  "token": "eyJhbGciOi..."
}
```

Notes: the **first account ever created becomes `admin`**. Registration is rate limited
(40 attempts / 10 min). When `ALLOWED_EMAIL_DOMAINS` is set, registration returns a
`verification_token` (no mail server needed for the demo).

---

## Items

### `GET /items` — search & filter (public)

| Query | Description |
| --- | --- |
| `q` | keyword across title, description, category, location |
| `type` | `lost` \| `found` |
| `category`, `location` | exact category / substring location |
| `status` | any item status |
| `date_from`, `date_to` | range over `occurred_at` |
| `unresolved_only` | `true` hides returned/closed cases |
| `sort` | `recent` (default) \| `oldest` \| `date` \| `title` |
| `page`, `limit` | pagination (limit ≤ 100, default 12) |
| `include_hidden` | admin only — includes moderated reports |

```json
{
  "items": [
    {
      "item_id": 2, "type": "found", "title": "Wallet found in canteen",
      "category": "Wallet / Purse", "location": "Canteen, Block B",
      "occurred_at": "2026-08-25T19:18:00.000Z", "status": "POSSIBLE_MATCH",
      "image_url": null, "has_verification_question": true, "has_secret_details": true,
      "is_owner": false, "reporter": { "user_id": 3, "name": "Rahul Verma" }
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 1, "pages": 1, "has_more": false }
}
```

`secret_details` is **never** present in any response.

### Other item endpoints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/items/categories` | – | category list + status list |
| GET | `/items/stats` | – | landing page counters |
| GET | `/items/dashboard` | ✔ | user dashboard payload (counts, matches, claims) |
| GET | `/items/mine` | ✔ | My Reports (same filters as `/items`) |
| POST | `/items` | ✔ | create a report (`type` in the body) |
| POST | `/items/lost` · `/items/found` | ✔ | same, with the type implied |
| GET | `/items/:id` | optional | item + matches + claims + timeline |
| PATCH | `/items/:id` | ✔ | owner/admin edit (re-runs matching when scoring fields change) |
| DELETE | `/items/:id` | ✔ | owner/admin delete |
| POST | `/items/:id/close` | ✔ | mark the case `CLOSED` |
| GET | `/items/:id/matches` | optional | stored matches for the item |
| GET | `/items/:id/match-preview` | ✔ | score candidates **without storing** anything |
| POST | `/items/:id/rematch` | ✔ | re-run the engine on demand |

### `POST /items/found`

```bash
curl -X POST localhost:4000/api/items/found \
  -H "Authorization: Bearer $TOKEN" \
  -F 'title=Wallet found in canteen' \
  -F 'category=Wallet / Purse' \
  -F 'description=Black leather wallet on a canteen table, right corner slightly torn' \
  -F 'location=Canteen, Block B' \
  -F 'latitude=19.0762' -F 'longitude=72.8779' \
  -F 'occurred_at=2026-08-25T19:18' \
  -F 'verification_question=Which cards are inside?' \
  -F 'secret_details=library card and a torn right corner' \
  -F 'image=@wallet.jpg'
```

Response `201`:

```json
{
  "item": { "item_id": 2, "status": "REPORTED" },
  "new_matches": 1,
  "best_match": {
    "match_id": 1, "match_score": 87.3, "status": "POSSIBLE",
    "breakdown": {
      "score": 87.3,
      "reasons": ["Same category: Wallet / Purse", "0.02 km apart", "Reported on the same day"],
      "factors": [
        { "key": "category", "label": "Item / category similarity", "weight_pct": 25, "score_pct": 87.6, "contribution_pct": 25.8, "reason": "Same category: Wallet / Purse" },
        { "key": "image", "label": "Image similarity", "weight_pct": 15, "score_pct": 0, "skipped": true, "reason": "Skipped - both reports need a photo" }
      ]
    },
    "lost_item": { "item_id": 1, "title": "Black leather wallet" },
    "found_item": { "item_id": 2, "title": "Wallet found in canteen" }
  },
  "matches": []
}
```

`GET /items/:id` additionally returns a `timeline` array (the six lifecycle steps with
`done` flags), and `claims` — the item owner and admins see all claims, a claimant sees only theirs.

Validation highlights: `title` ≥ 3 chars, `location` ≥ 2 chars, `occurred_at` cannot be in the
future, uploads limited to 5 MB and image mime types.

---

## Matches

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/matches/weights` | – | the configured weights (used by the UI legend) |
| GET | `/matches?min_score=75` | ✔ | every match touching the caller's reports |
| GET | `/matches/:id` | ✔ | one match (participants or admin only) |
| PATCH | `/matches/:id/status` | ✔ | `{ status: "CONFIRMED" \| "REJECTED" \| "POSSIBLE" }` |
| POST | `/matches/rescore` | admin | recompute every stored match |

Confirming or dismissing a match notifies the other participant.

---

## Claims &amp; verification

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/claims/prompt/:itemId` | ✔ | the verification question (never the answer) |
| POST | `/claims` | ✔ | submit a claim |
| GET | `/claims/mine` | ✔ | claims the caller filed |
| GET | `/claims/incoming?open=true` | ✔ | claims awaiting the caller's review |
| GET | `/claims/:id` | ✔ | claim detail (claimant, finder or admin) |
| POST | `/claims/:id/review` | finder/admin | `PENDING → UNDER_REVIEW` |
| POST | `/claims/:id/approve` | finder/admin | `{ note? }` → unlocks contact details |
| POST | `/claims/:id/reject` | finder/admin | `{ note? }` |
| POST | `/claims/:id/handover` | finder/admin | item becomes `RETURNED` |
| POST | `/claims/:id/withdraw` | claimant | withdraw an open claim |

### `POST /claims`

```json
{
  "item_id": 2,
  "match_id": 1,
  "proof": "It is my wallet - torn right corner, library card and about 400 rupees inside.",
  "answer": "My library card, and the right corner is torn"
}
```

Response `201`:

```json
{
  "claim": {
    "claim_id": 1, "status": "PENDING", "auto_score": 95.1,
    "item_title": "Wallet found in canteen",
    "can_review": false, "can_confirm_handover": false, "contact": null
  }
}
```

`auto_score` is the similarity between the claimant's words and the finder's private detail —
**advisory only**; a human always decides. `contact` stays `null` until the claim is approved, then
it contains the counterpart's name, email and phone.

When both the item report and the claim carry a photo and the AI service is enabled, the claim also
returns an image comparison:

```json
{
  "image_score": 81.4,
  "image_verdict": "likely_same_item",
  "image_verdict_label": "The photos look like the same item",
  "confidence": 90.3
}
```

`confidence` blends the two signals (`0.65 × answer + 0.35 × photo`), weighting the private detail
higher because only the true owner can know it. All three fields are `null` when the evidence is
unavailable.

Rejections: claiming your own report → `400`, a second open claim on the same item → `409`,
someone else's claim → `403`.

---

## Messages

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/messages/threads` | one row per (item, counterpart) with unread counts |
| POST | `/messages` | `{ item_id, receiver_id, message }` |
| GET | `/messages/:itemId/:userId` | the conversation, oldest first |
| PATCH | `/messages/:itemId/:userId/read` | mark the counterpart's messages read |

Only the item reporter, its claimants and matched counterparts may converse — anyone else gets
`403`.

---

## Notifications

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/notifications?unread=true&limit=30` | list + unread count |
| PATCH | `/notifications/:id/read` | mark one read |
| PATCH | `/notifications/read-all` | mark all read |

Types: `MATCH_FOUND`, `CLAIM_SUBMITTED`, `CLAIM_APPROVED`, `CLAIM_REJECTED`,
`HANDOVER_CONFIRMED`, `MESSAGE_RECEIVED`, `ITEM_MODERATED`.

---

## Admin

All require the `admin` role.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/admin/overview` | users, items, matches, claims, analytics, recent activity |
| GET | `/admin/users?q=&limit=` | user list with report/claim counts |
| PATCH | `/admin/users/:id/block` | `{ blocked: true \| false }` |
| PATCH | `/admin/users/:id/role` | `{ role: "user" \| "admin" }` |
| PATCH | `/admin/items/:id/hide` | `{ hidden: true \| false, reason? }` |
| DELETE | `/admin/items/:id` | remove a report |
| GET | `/admin/claims?status=` | dispute queue |
| GET | `/admin/matches?min_score=` | every stored match |
| GET | `/admin/audit?limit=` | moderation audit trail |

`GET /admin/overview` includes `analytics.resolution_rate`, `analytics.categories` and
`analytics.hotspots` (the location heatmap data).

---

## Realtime (Socket.IO)

Connect to the same origin with the JWT:

```js
import { io } from 'socket.io-client';
const socket = io('/', { auth: { token } });
```

Server → client: `notification:new`, `notification:read`, `match:new`, `claim:new`,
`claim:decided`, `item:returned`, `message:new`, `thread:message`, `thread:typing`.

Client → server: `thread:join`, `thread:leave`, `thread:typing`.

REST remains the source of truth — the socket only pushes what was already persisted, so
polling clients stay correct.

---

## Status codes

| Code | When |
| --- | --- |
| 400 | validation failed, or an illegal action (claiming your own item) |
| 401 | missing/expired token |
| 403 | authenticated but not allowed (not a participant, not an admin, blocked account) |
| 404 | not found, or hidden from this viewer |
| 409 | duplicate (email already registered, claim already open) |
| 413 | uploaded image too large |
| 429 | rate limit on the credential endpoints |
