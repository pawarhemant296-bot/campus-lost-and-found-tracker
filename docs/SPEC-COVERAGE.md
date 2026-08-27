# Requirement coverage

Every requirement from the project brief, mapped to where it lives in the code.

## Section 2 — Main modules

| Module | Status | Implementation |
| --- | --- | --- |
| User module (registration, login, profile, reports) | ✅ | `backend/src/modules/auth/`, `frontend/src/pages/{Login,Register,Dashboard}.jsx` |
| Lost item module (report, edit, search, track) | ✅ | `modules/items/`, `pages/{ReportItem,Search,MyReports,ItemDetail}.jsx` |
| Found item module | ✅ | same module, `type=found`, dedicated `POST /api/items/found` |
| Matching module (compare + score) | ✅ | `matching/{similarity,engine,aiClient}.js`, `modules/matches/` |
| Claim & verification module | ✅ | `modules/claims/`, `pages/{ClaimForm,ClaimDetail,Claims}.jsx` |
| Communication module (secure chat) | ✅ | `modules/messages/`, `pages/Messages.jsx` |
| Notification module | ✅ | `modules/notifications/`, `components/NotificationBell.jsx`, Socket.IO |
| Admin module (moderation, disputes, analytics) | ✅ | `modules/admin/`, `pages/Admin.jsx`, `audit_logs` table |

## Section 3 — Complete user workflow

| Step | Where |
| --- | --- |
| 1–2. Open the app, register/login | `pages/Landing.jsx`, `pages/Login.jsx` |
| 3. Dashboard | `GET /api/items/dashboard` → `pages/Dashboard.jsx` |
| 4–5. Report lost/found with details, location, date/time, photo | `pages/ReportItem.jsx` → `POST /api/items/{lost,found}` |
| 6. Backend validates and stores | zod schemas + `items.repository.insertItem` |
| 7. Engine searches opposite-type listings | `items.repository.findMatchCandidates` |
| 8. Possible match generated | `matches.service.runMatchingForItem` → `matches` table |
| 9. User receives notification | `notifications.notify` + `emitToUser` (both parties) |
| 10. Claim submitted | `POST /api/claims` |
| 11. Ownership verification | `verification_question` + `secret_details` + `gradeAnswer` |
| 12. Finder/admin confirms handover | `POST /api/claims/:id/handover` |
| 13. Status becomes RETURNED / RESOLVED | item → `RETURNED`, then `CLOSED` |

Verified automatically, in order, by `scripts/demo-flow.js`.

## Sections 4 & 5 — Lost and found item workflows

Both flows are implemented, including the "black wallet in the college canteen" example, which is
pre-seeded (`backend/src/db/seed.js`) and scores **87.3%**.

## Section 6 — Smart matching engine

| Factor | Required weight | Implemented |
| --- | --- | --- |
| Item/category similarity | 25% | ✅ `categorySimilarity()` |
| Description similarity | 25% | ✅ `textSimilarity()`, optional semantic model |
| Location similarity | 20% | ✅ text + haversine distance when coordinates exist |
| Date/time proximity | 15% | ✅ decay window + chronology sanity check |
| Image similarity | 15% | ✅ via the Python service (aHash + colour histogram) |

Weights are configurable, and unavailable factors have their weight redistributed instead of
scoring zero. Details in [MATCHING.md](MATCHING.md).

## Section 7 — Claim & ownership verification

| Requirement | Implementation |
| --- | --- |
| 1. User clicks *Claim item* | `pages/ItemDetail.jsx` → `/items/:id/claim` |
| 2. System asks verification questions / proof | `GET /api/claims/prompt/:itemId` |
| 3. Unique mark, contents, photo, serial detail | `answer`, `proof`, `proof_image_url` fields |
| 3b. AI photo check | `verifyClaimImage()` → `POST /verify-image`; stores `image_score` + verdict for the reviewer |
| 4. Reviewed by the finder and/or admin | `assertCanReview`, admin queue in the dashboard |
| 5. Safe handover arranged | contact card unlocked on approval + item-scoped chat |
| 6. Item marked RETURNED, case closed | `confirmHandover()` → `RETURNED` → `CLOSED` |

Extra safeguards: the private detail is never returned by the API, answers are graded
automatically as reviewer guidance, you cannot claim your own report, one open claim per item per
person, approving one claim auto-rejects the others.

## Section 8 — Item status lifecycle

`REPORTED → POSSIBLE_MATCH → CLAIM_REQUESTED → VERIFICATION → RETURNED → CLOSED`, enforced in
`items.service`/`claims.service` and rendered by `components/StatusTimeline.jsx`.

## Section 9 — Database design

All six specified tables exist with the required fields (`users`, `items`, `matches`, `claims`,
`messages`, `notifications`), plus `audit_logs` for moderation. See [DATABASE.md](DATABASE.md).
`items.date` is named `occurred_at` to distinguish "when it was lost" from `created_at`.

## Section 10 — Technology stack

| Layer | Recommended | Used |
| --- | --- | --- |
| Frontend | HTML/CSS/JS, React optional | React 18 + Vite + React Router |
| Backend | Node.js + Express | ✅ Express 4, ES modules |
| Database | PostgreSQL or MySQL | ✅ PostgreSQL, **plus SQLite** so it runs with zero setup |
| Authentication | JWT + password hashing | ✅ JWT + bcrypt, role based |
| Image storage | Cloudinary / Firebase | ✅ local disk by default, Cloudinary via `STORAGE_DRIVER` |
| AI/ML | Python + FastAPI + scikit-learn / sentence-transformers | ✅ `ai-service/`, all three tiers |
| API style | REST | ✅ |

## Section 11 — System architecture

Matches the diagram in the statement: frontend → REST → Express backend → database **and** a
separate matching/AI service. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Section 12 — Core screens

| Screen | Route |
| --- | --- |
| Landing page (explanation + search) | `/` |
| Register / Login | `/register`, `/login` |
| User dashboard (counts, recent matches) | `/dashboard` |
| Report lost item | `/report/lost` |
| Report found item | `/report/found` |
| Search & filter (category, location, date, keyword) | `/search` |
| Item details (photo, description, status) | `/items/:id` |
| Possible matches (percentage + reasons) | `/matches`, `/matches/:id` |
| Claim & verification | `/items/:id/claim`, `/claims`, `/claims/:id` |
| Messages / contact | `/messages`, `/messages/:itemId/:userId` |
| My reports | `/my-reports` |
| Admin dashboard | `/admin` |

Plus an edit-report screen and a 404 page — 17 screens in total.

## Section 13 — MVP vs advanced features

| MVP | Status |
| --- | --- |
| Login / register | ✅ |
| Report lost/found | ✅ |
| Search / filter | ✅ |
| Basic match score | ✅ |
| Claim verification | ✅ |
| Item status tracking | ✅ |
| Admin dashboard | ✅ |

| Advanced | Status |
| --- | --- |
| College email verification | ✅ `ALLOWED_EMAIL_DOMAINS` + `POST /auth/verify-email` |
| AI image matching | ✅ optional Python service (aHash + colour histogram), used both for match scoring and for **claim photo verification** |
| Dark theme | ✅ dark by default with a persisted light/dark switch |
| Material Design inputs | ✅ Material UI form controls throughout |
| Semantic description matching | ✅ sentence-transformers → TF-IDF fallback |
| Real-time notifications | ✅ Socket.IO push + polling fallback |
| In-app chat / WebSocket | ✅ item-scoped chat with live delivery |
| Map-based location view | ⚠️ coordinates are captured, used for distance scoring, and link out to OpenStreetMap — no embedded map tile layer |
| Analytics and heatmaps | ✅ resolution rate, category breakdown, location hotspot bars |

## Section 14 — Recommended development order

Followed exactly, phases 1→9, with AI added last behind a flag. Summarised at the end of the
[README](../README.md).

## Section 15 — Final demo flow

Scripted twice: as a live walkthrough in [DEMO-SCRIPT.md](DEMO-SCRIPT.md) and as an automated
assertion suite in `scripts/demo-flow.js`.

## Section 16 — Key point

The MVP was completed and verified end to end before any AI was introduced, and the AI service
remains optional at runtime — if it is unreachable the platform keeps working on its own
heuristics.

## Known gaps (honest list)

- **No embedded map component.** Coordinates are captured and scored; the item page links to
  OpenStreetMap rather than rendering tiles in-app.
- **No email delivery.** Verification tokens are returned by the API instead of being mailed, which
  keeps the demo self-contained. Wiring an SMTP provider is the only change needed.
- **Image similarity is classical, not a CNN.** Perceptual hash plus colour histogram is fast and
  dependency-light; swapping in CLIP embeddings would only touch `ai-service/similarity.py`.
- **No automated unit-test suite for the backend modules.** Verification is end-to-end
  (`scripts/demo-flow.js`, `scripts/ui-smoke.mjs`) plus pytest for the AI service.
