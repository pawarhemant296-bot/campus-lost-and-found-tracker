# TraceBack — Lost &amp; Found Item Tracker

> **PCE SW PS 13** · A centralised platform where people report lost or found items, get
> AI-assisted match suggestions, prove ownership privately, chat securely and track an item
> all the way back to its owner.

TraceBack is a complete, working full-stack application — not a mockup. Every screen is wired
to a real REST API, a real database and a real matching engine.

**Docs:** [SIH idea-submission deck (PDF)](docs/TraceBack-SIH-Deck.pdf) · [UI walkthrough (29 screenshots)](docs/SCREENSHOTS.md) · [SIH presentation &amp; Q&amp;A guide (PDF)](docs/TraceBack-SIH-Guide.pdf)

```
Student A loses a wallet → reports it
Student B finds a wallet → reports it (+ private ownership questions)
        ↓
Matching engine scores 5 signals → 88-95% match → both sides notified
        ↓
Student A claims it → answers the private questions → auto-scored 89%
        ↓
Student B approves → identities unlock → handover in chat → RETURNED → CLOSED
```

---

## 1. Quick start

Requires **Node.js 18 or newer** (`node -v` to check). No database to install, no API keys, and
**no C++ compiler** — on Node 22.5+ the database runs on Node's built-in `node:sqlite`, so there is
nothing to build on Windows, macOS or Linux.

```bash
# from the repo root
npm install       # the concurrently helper
npm run setup     # installs server + client deps, then seeds the demo database
npm run dev       # API on :4000, Vite dev server on :5173
```

Open **http://localhost:5173**.

**Single-port demo mode** — the API serves the production build, so there's only one URL and one
process to babysit while presenting:

```bash
npm run demo      # builds the client, then serves everything on http://localhost:4000
```

Anything went sideways? `npm run seed` resets the database to the clean demo story, and
`npm run reset` wipes `node_modules` and reinstalls from scratch. Both work identically in
PowerShell, cmd and Git Bash.

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Owner (lost the wallet) | `aarav@college.edu` | `demo1234` |
| Finder (found the wallet) | `priya@college.edu` | `demo1234` |
| Other members | `rohit@` / `sneha@` / `kabir@` / `meera@college.edu` | `demo1234` |
| Administrator | `admin@traceback.io` | `admin1234` |

The login screen has one-click chips for the three key accounts, so nothing needs typing during a demo.

### Verify it end to end

```bash
cd server && node e2e-demo.mjs      # 44 assertions covering the whole judge walkthrough
```

It registers fresh users, files both reports, checks the generated match score, submits a
genuine claim **and** an impostor claim (89.5% vs 1.9%), approves, hands over, closes the case,
exercises the admin console and asserts every access-control rule.

---

## 2. Architecture

```
                    ┌──────────────────────────────┐
  USERS / ADMIN ──► │  FRONTEND — React + Vite     │
                    │  cosmic design system (CSS)  │
                    └──────────────┬───────────────┘
                                   │  REST + JWT
                    ┌──────────────▼───────────────┐
                    │  BACKEND — Node + Express    │
                    │  auth · items · matches ·    │
                    │  claims · messages ·         │
                    │  notifications · admin       │
                    └───────┬──────────────┬───────┘
                            │              │
              ┌─────────────▼───┐   ┌──────▼──────────────────┐
              │  SQLite (WAL)   │   │  Matching engine        │
              │  6 core tables  │   │  5 weighted signals +   │
              │  + settings     │   │  perceptual image hash  │
              └─────────────────┘   └─────────────────────────┘
```

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + React Router | Fast HMR, zero-config build |
| Styling | Hand-built CSS design system (tokens → components) | Full control of the cosmic glow theme, no framework weight |
| Charts | Hand-rolled SVG | On-theme gradients, no chart dependency |
| Backend | Node.js + Express (ESM) | Matches the problem statement's recommended stack |
| Database | SQLite — built-in `node:sqlite`, or `better-sqlite3` if installed | Same SQL model as PostgreSQL, but **zero setup** — critical for a hackathon demo. Swappable: all queries are plain SQL |
| Auth | JWT + bcrypt password hashing | Stateless, role-aware (`user` / `admin`) |
| Images | `multer` upload + `sharp` 8×8 dHash | Real perceptual image similarity, computed locally |

### Repository layout

```
traceback/
├── server/
│   ├── src/
│   │   ├── index.js           Express app, static client, error handling
│   │   ├── config.js          env + default engine weights
│   │   ├── db.js              schema, indexes, live settings store
│   │   ├── auth.js            JWT sign/verify, bcrypt, route guards
│   │   ├── matching.js        ★ the matching engine + answer scoring
│   │   ├── images.js          upload handling + dHash + seed artwork
│   │   ├── services.js        status lifecycle, notifications, match runner, masking
│   │   ├── constants.js       categories, locations, question templates
│   │   ├── seed.js            full demo dataset
│   │   └── routes/            auth · items · matches · claims · messages ·
│   │                          notifications · admin · meta
│   └── e2e-demo.mjs           end-to-end walkthrough test
├── client/
│   └── src/
│       ├── styles/            tokens.css · base.css · components.css
│       ├── components/        design-system primitives + layouts + charts
│       ├── lib/               api client · auth context · formatters
│       └── pages/             16 public + member screens, 7 admin screens
└── verify-ui.sh               boots the app and screenshots every screen
```

---

## 3. The matching engine

`server/src/matching.js` implements the weighting table from the problem statement exactly:

| Factor | Weight | How it is computed |
| --- | --- | --- |
| Item / category similarity | **25%** | Category equality + title token overlap + character-bigram cosine |
| Description similarity | **25%** | Synonym-normalised token overlap + Jaccard + bigram cosine, then calibrated |
| Location similarity | **20%** | Location token overlap with a place-synonym lexicon (canteen ≈ cafeteria ≈ mess) |
| Date / time proximity | **15%** | Exponential decay across a configurable window (default 14 days) |
| Image similarity | **15%** | Hamming distance between 64-bit dHashes of the two photos |

Design decisions worth pointing out in a demo:

- **It never relies on an exact name.** "Redmi Note 12 with cracked screen guard" still matches
  "Grey Android phone on library reading desk" at 83%.
- **A synonym lexicon** collapses `phone ≈ mobile ≈ cell`, `wallet ≈ purse`, `canteen ≈ cafeteria`,
  colour families, and campus place names.
- **Free-text scores are calibrated.** Two people describing the *same* object typically share only
  30–45% of their distinctive words, while unrelated text sits below 10%. A piecewise curve maps that
  raw overlap onto a human-meaningful confidence value.
- **Missing factors are dropped, not zeroed.** If neither report has a photo, the image weight is
  removed and the remaining four weights are re-normalised, so scores stay comparable.
- **Weights are live-tunable** from *Admin → Settings* (with a donut showing the distribution).
- Every score ships with a **per-factor breakdown** and plain-English reasons, rendered as glowing
  progress bars on the item, match and claim screens.

### Ownership verification

The finder stores private question/answer pairs. The API returns **only the questions** — the answers
never leave the database. A claimant's answers are scored with the same text-similarity machinery, and
the result is presented as an *advisory* auto-score. A human (finder or admin) always makes the call,
and a rejected claimant can raise a dispute that lands in the admin queue.

In the seeded demo the genuine owner scores **86%** while an impostor scores **31%**.

---

## 4. Data model

| Table | Key fields |
| --- | --- |
| `users` | `id, name, email, password_hash, role, phone, campus, avatar_hue, status, created_at` |
| `items` | `id, user_id, type(lost/found), title, category, description, location, item_date, image_url, image_hash, status, questions, is_flagged, created_at, updated_at` |
| `matches` | `id, lost_item_id, found_item_id, match_score, breakdown, status` (unique per pair) |
| `claims` | `id, item_id, match_id, claimant_id, proof, answer_score, stage, status, decided_by, decision_note` |
| `messages` | `id, sender_id, receiver_id, item_id, message, read_status, created_at` |
| `notifications` | `id, user_id, type, title, message, link, read_status, created_at` |
| `disputes` | `id, claim_id, raised_by, reason, status, resolution` |
| `settings` | live matching-engine configuration (`key`, `value`) |

**Item lifecycle** — enforced server-side and never allowed to move backwards:

```
REPORTED → POSSIBLE MATCH → CLAIM REQUESTED → VERIFICATION → RETURNED → CLOSED
```

**Claim wizard stages:** `submitted → verification → review → handover → returned` (or `rejected`).

---

## 5. API reference

All protected routes take `Authorization: Bearer <jwt>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` · `/login` | Create an account / sign in |
| `GET` `PATCH` | `/api/auth/me` | Read / update the signed-in profile |
| `POST` | `/api/auth/change-password` | Rotate a password |
| `GET` | `/api/items` | Browse with `q, type, category, location, status, from, to, sort, mine` |
| `POST` | `/api/items` | Create a report (multipart: fields + `photo` + `questions`) |
| `GET` | `/api/items/:id` | Item + its matches + question prompts + my claim |
| `PATCH` `DELETE` | `/api/items/:id` | Edit / delete your own report |
| `POST` | `/api/items/:id/rescan` | Re-run the engine for that report |
| `GET` | `/api/items/:id/compare/:otherId` | Live factor-by-factor explanation |
| `GET` | `/api/matches` · `/api/matches/:id` | Your match pairs (with perspective) |
| `POST` | `/api/matches/:id/reject` | "Not my item" |
| `POST` | `/api/claims` | Open a claim |
| `POST` | `/api/claims/:id/verify` | Submit + auto-score verification answers |
| `POST` | `/api/claims/:id/decision` | Approve / reject (finder or admin) |
| `POST` | `/api/claims/:id/handover` · `/close` | Mark RETURNED, then CLOSED |
| `POST` | `/api/claims/:id/dispute` | Escalate a rejection |
| `GET` `POST` | `/api/messages/threads` · `/thread/:userId` · `/` | Item-scoped chat |
| `GET` `POST` | `/api/notifications` · `/:id/read` · `/read-all` | Alert centre |
| `GET` | `/api/admin/overview` · `/analytics` | KPIs, trends, rates |
| `GET` `PATCH` | `/api/admin/users` · `/items` · `/claims` · `/disputes` | Moderation |
| `GET` `PUT` | `/api/admin/settings` | Live engine tuning |
| `GET` | `/api/meta` · `/meta/stats` · `/meta/showcase` | Public metadata for the UI |

**Privacy built into the API:** reporter names are returned masked (`Aa••• S.`), emails masked
(`aa•••@college.edu`), phone numbers are never serialised, and private verification answers are
excluded from every response. Identities unlock only once a claim is approved.

---

## 6. Screens

**Public** — Landing (hero, live stats bar, 4-step flow, engine explainer, lifecycle stepper,
recent reports), How It Works, Contact, Browse &amp; filter, Item details (photo, masked reporter,
match ring + factor bars, claim CTA), Login, Register.

**Member** — Dashboard (4 stat cards, recent activity, match previews, claims in flight),
Report Lost / Found (3-step wizard with a live preview card and a match-strength checklist),
My Reports (table + grid views), Possible Matches (paired cards with a glowing connector),
Claims, Claim &amp; Verification wizard (stepper + timeline + review + handover), Messages,
Notifications, Profile.

**Admin** — Overview (KPIs, 14-day trend, moderation queue), Manage Users, Manage Items,
Manage Claims (with an answer-review modal), Disputes, Analytics (line / bar / donut charts),
Settings (live weight tuning).

---

## 7. Design system

A dark, futuristic, cosmic theme: near-black canvas, soft purple nebula gradients, faint drifting
stars and violet glow accents. Everything is driven by tokens in
[`client/src/styles/tokens.css`](client/src/styles/tokens.css), so one edit re-themes the product.

| Token group | Values |
| --- | --- |
| Surfaces | `#0a0a0f` base · `#151220` cards · glassmorphism `rgba(21,18,32,.72)` + 14px blur |
| Accents | `#a78bfa` → `#c084fc`, deep `#4c1d95`; primary gradient `#8b5cf6 → #a855f7 → #c084fc` |
| Text | `#f4f2ff` primary · `#cfc9e8` soft · `#9d94bd` dim · `#6f6790` faint |
| Radii | 8 / 10 / **12** / **16** / 22 / pill |
| Glow | `--glow-xs · sm · md · lg`, `--glow-accent`, `--ring-focus` |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 |
| Type | Space Grotesk (display) · Inter (body) · system mono |

**Status badges** are colour-coded pills driven by CSS variables: Reported (blue-violet),
Possible Match (amber-purple glow), Claim Requested (orange), Verification (yellow),
Returned (green), Closed (grey), plus Lost (rose) / Found (teal) type badges.

**Reusable components** (`client/src/components/ui.jsx`): `Button` (primary gradient / ghost /
subtle / danger / success · 3 sizes · loading state), `StatusBadge`, `Badge`, `Tag`, `Card`,
`CardHead`, `StatCard`, `MatchRing` (glowing circular progress), `FactorBars`, `Stepper`,
`LifecycleStepper`, `ClaimStepper`, `Timeline`, `Avatar`, `Field`, `Input`, `Textarea`, `Select`,
`Switch`, `ToggleGroup`, `PillSelect`, `Empty` (glowing magnifier orb), `Alert`, `Skeleton`,
`Modal`, `ToastProvider`, `SectionTitle`, `ItemThumb` — plus `charts.jsx`
(`LineChart`, `BarChart`, `DonutChart`, `Sparkline`) and `Icon.jsx`, a 53-glyph stroked SVG set.

**Responsive behaviour** — sidebar → icon rail at ≤1024px → labelled bottom nav at ≤760px;
cards stack; forms go single column; match pairs stack with the connector rotating to vertical;
steppers scroll horizontally while keeping their glow; `prefers-reduced-motion` disables animation.

Regenerate the full screenshot set (desktop, tablet, mobile) at any time:

```bash
./verify-ui.sh      # → .kiro/artifacts/screenshots/
```

---

## 8. MVP vs advanced features

| MVP (built) | Advanced (also built) |
| --- | --- |
| Login / register with roles | Perceptual **image similarity** matching (dHash) |
| Report lost / found with photo upload | Synonym-aware **semantic-ish text matching** with calibration |
| Search &amp; filter | In-app **chat** with item context, threaded per report |
| Weighted match score | Live notification centre (bell panel + full page + polling) |
| Claim verification | **Auto-scored** verification answers + dispute escalation |
| Item status tracking | Admin **analytics** (trends, category donut, hotspots, funnel, resolution time) |
| Admin dashboard | Live **engine tuning** from the admin console |

Deliberately left out: college email verification (needs SMTP), WebSocket push (polling is used
instead), map view (locations are a controlled vocabulary today).

---

## 9. Troubleshooting

### `npm install` fails building `better-sqlite3` (Windows, "Could not find any Visual Studio installation")

**You can ignore it — the app still runs.** `better-sqlite3` and `sharp` are declared as
*optional* dependencies precisely so a missing C++ toolchain cannot stop the install. Just continue:

```bash
npm run seed
npm run demo
```

Why it happens: `better-sqlite3` is a native addon. If npm can't find a prebuilt binary for your
exact Node version and platform (common on brand-new Node releases), it tries to compile from
source, which needs Visual Studio Build Tools plus Python.

What TraceBack does instead — [`server/src/sqlite.js`](server/src/sqlite.js) picks a driver at boot:

| Your Node | Driver used | Needs a compiler? |
| --- | --- | --- |
| 22.5 or newer | **`node:sqlite`** (built into Node) | No |
| 18 – 22.4 | `better-sqlite3` | Only if no prebuilt binary exists |

Confirm which one you got — the server prints it at boot and `/api/health` reports it:

```bash
curl http://localhost:4000/api/health
# {"sqlite_driver":"node:sqlite","image_similarity":true, ...}
```

Want to skip the native builds entirely and silence the noise:

```bash
npm install --omit=optional --prefix server
```

If an earlier install left a half-finished `node_modules`, start clean — this works in PowerShell,
cmd and Git Bash alike, so there are no `rmdir` / `rm -rf` differences to worry about:

```bash
npm run reset      # deletes node_modules + client/dist, reinstalls, reseeds
```

Verified: with **both** native modules absent, `npm run seed`, the server and all 44 end-to-end
assertions still pass. Image similarity is simply dropped from the score and the remaining four
weights re-normalise (the demo wallet pair scores 87% instead of 88%).

### Port 4000 is already in use

Something else is listening there — most often an older version of this app still running in
another terminal. Close that window, or start TraceBack elsewhere:

```bash
set PORT=4100 && npm start      # Windows (cmd)
$env:PORT=4100; npm start       # Windows (PowerShell)
PORT=4100 npm start             # macOS / Linux
```

Then open <http://localhost:4100>. The server prints these exact instructions when the port is
taken, so you never get a bare stack trace.

### The UI looks like the old app after switching branches

Hard-refresh to clear the cached bundle: `Ctrl+Shift+R` (`Cmd+Shift+R` on macOS). If it *still*
looks old, check the port — an earlier version may be serving on 4000 while TraceBack runs
elsewhere.

### Files from a previous version are still in my folder

Switching branches deletes tracked files but **not untracked ones**, so an earlier
implementation's `node_modules`, database and uploads can survive on disk — and even keep serving
on port 4000. Clear them out:

```bash
npm run clean:legacy
```

It removes only `backend/`, `frontend/`, `ai-service/`, `deploy/`, `scripts/` and
`docker-compose.yml`, refuses to run unless the current tree really is TraceBack, and reports what
it freed. The old implementation stays in git history either way — `git checkout main` brings it
back.

Prefer to inspect before deleting? `git clean -nxd` lists every untracked file without touching
anything.

---

## 10. Notes for judges / reviewers

- `npm run seed` is idempotent — run it any time to reset to a clean, story-shaped dataset.
- Seeded item artwork is generated locally as cosmic placeholder PNGs, so the demo needs **no
  internet** and every photo has a real perceptual hash.
- Try *Admin → Settings*: drop the description weight to 0, then re-scan a report from
  *My Reports* and watch the score change — the engine is genuinely configuration-driven.
- Every state has a designed empty state, loading skeleton and error toast; there are no dead ends.
