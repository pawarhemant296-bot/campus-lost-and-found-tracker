# Campus Lost &amp; Found Tracker

A centralised platform where people report lost or found items, search listings, receive smart
match suggestions, verify ownership, communicate securely and track an item to its return.

The complete journey works end to end:

```
report lost → report found → engine scores a match → both users notified
→ claim submitted → ownership verified → handover confirmed → RETURNED → CLOSED
```

---

## Quick start (2 commands, no database to install)

```bash
npm run setup          # installs backend + frontend dependencies
npm run seed           # creates the SQLite database and the demo data
npm start              # API + UI on http://localhost:4000
```

Open <http://localhost:4000> and sign in with a demo account:

| Account | Password | Role in the demo |
| --- | --- | --- |
| `ananya@campus.edu` | `demo1234` | Lost the black wallet |
| `rahul@campus.edu` | `demo1234` | Found the black wallet |
| `admin@campus.edu` | `admin123` | Campus admin / moderator |

### Working on the frontend

```bash
npm run dev:api        # Express on :4000 with auto-reload
npm run dev:web        # Vite dev server on :5173 (proxies /api to :4000)
```

`npm start` rebuilds the UI and serves it from the API port, so a single process is enough for the
demo. Use `npm run start:api` to skip the rebuild.

> If `http://localhost:4000` ever returns JSON instead of the website, the UI has not been built —
> run `npm run build` in the repository root. `npm run demo` asserts this too.

### Windows notes

**`npm : File ...\npm.ps1 cannot be loaded because running scripts is disabled`**
PowerShell blocks npm's script shim. Any one of these fixes it:

```powershell
# a) run the commands from Command Prompt (cmd) instead of PowerShell, or
npm.cmd run setup          # b) call the .cmd shim directly, or
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned   # c) permanent, no admin needed
```

**`npm install` fails building `better-sqlite3`**
That native module has no prebuilt binary for every Node version on Windows, and building it from
source needs the Microsoft C++ toolchain. You do not need it: it is an **optional** dependency, and
the app automatically falls back to Node's built-in `node:sqlite` driver. Just carry on —
`npm run seed && npm start` will work. `GET /api/health` reports which driver is active.

On Node 22.x the built-in driver needs a flag, so if you also skipped the native module use:

```bash
node --experimental-sqlite src/server.js     # from the backend/ folder
```

Node 23.4+ and 24+ need no flag. Node 20 and older need `better-sqlite3` to install successfully —
upgrading to Node 22 LTS or newer is the simplest fix.

**Site can't be reached at localhost:4000**
The server is not running. Check the terminal where you ran `npm start`: it should print a banner
ending in `URL : http://localhost:4000`. If it exited instead, the error above the prompt says why.
Verify something is listening with `netstat -ano | findstr :4000`.

### Full stack on PostgreSQL

```bash
docker compose up --build     # Postgres + API/UI + Python AI service
```

---

## Verifying it actually works

Three self-contained checks, all runnable before you present:

```bash
npm run demo      # 39 assertions over the whole REST journey (boots the API in-process)
npm run test:ui   # drives the real UI in Chromium: 38 assertions, fails on any console error
cd ai-service && .venv/bin/python -m pytest -q                        # AI service unit tests
cd ai-service && .venv/bin/python ../scripts/ai-integration-check.py  # AI wiring + degradation
```

`npm run demo` prints the judge-facing walkthrough with the live score breakdown:

```
 3. Rahul reports the found wallet - the engine runs immediately
    ✓ a possible match was generated
    ✓ score is a strong match (>= 75%) -> 87.3%
    score breakdown:
      Item / category similarity     87.6%  x 25%  ->  25.8 pts
      Description similarity         70.6%  x 25%  ->  20.8 pts
      Location similarity            98.8%  x 20%  ->  23.2 pts
      Date / time proximity          99.4%  x 15%  ->  17.5 pts
      Image similarity                  0%  x 15%  ->     0 pts  (skipped)
```

`npm run test:ui` needs a browser once: `npx playwright install chromium`.
Add `SHOTS=./.shots` to save a screenshot of every screen.

---

## Architecture

```
          USERS / ADMIN
                │
                ▼
      ┌─────────────────────┐
      │  FRONTEND (React)   │   17 screens, Vite build
      └──────────┬──────────┘
                 │  REST + Socket.IO
                 ▼
      ┌─────────────────────┐
      │  BACKEND (Express)  │   auth · items · matches · claims
      │                     │   messages · notifications · admin
      └───┬─────────────┬───┘
          │             │
          ▼             ▼
 ┌────────────────┐  ┌──────────────────────┐
 │  SQLite  /     │  │  Matching engine     │
 │  PostgreSQL    │  │  (+ optional Python  │
 │                │  │   AI service)        │
 └────────────────┘  └──────────────────────┘
```

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 18, React Router, Material UI form controls, CSS-variable design system | dark theme by default, with a persisted light/dark switch |
| Backend | Node.js 18+, Express 4 | modular: one folder per domain module |
| Database | **SQLite by default, PostgreSQL when `DATABASE_URL` is set** | identical SQL, two schema files |
| Auth | JWT + bcrypt, role based (`user` / `admin`) | optional college-domain restriction |
| Realtime | Socket.IO | live notifications and chat |
| Image storage | local disk, or Cloudinary via `STORAGE_DRIVER=cloudinary` | |
| AI / ML | Python + FastAPI (sentence-transformers → TF-IDF → pure Python) | fully optional |
| API style | REST, JSON | see [docs/API.md](docs/API.md) |

Deeper documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map, request lifecycle, design decisions
- [docs/MATCHING.md](docs/MATCHING.md) — how the score is computed, with worked examples
- [docs/DATABASE.md](docs/DATABASE.md) — tables, relationships, status lifecycles
- [docs/API.md](docs/API.md) — every endpoint with request/response examples
- [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) — the 3-minute presentation, keystroke by keystroke
- [docs/SPEC-COVERAGE.md](docs/SPEC-COVERAGE.md) — every requirement mapped to the code that implements it

---

## Feature highlights

**Smart matching engine** (`backend/src/matching/`)
Weighted score exactly as specified — item/category 25%, description 25%, location 20%,
date/time 15%, image 15%. Factors that cannot be evaluated (no photos, AI service off) are marked
*skipped* and their weight is **redistributed**, so a missing photo can never cap an otherwise
perfect match. Every stored match keeps its full breakdown, and the UI shows *why* two reports
matched.

**Ownership verification** (`backend/src/modules/claims/`)
The finder stores a private detail that the API **never returns to anyone**. A claimant must
describe it; the API grades the answer automatically to assist the reviewer, but a human — the
finder or an admin — always decides. Contact details unlock only after approval.

**AI photo verification of claims**
When the claimant uploads a proof photo and the report has one too, the Python service compares them
(perceptual hash + colour profile) and the reviewer sees both images side by side with a similarity
score, a plain-language verdict, and a combined confidence figure that weights the private-detail
answer higher than the photo. Entirely advisory, and skipped silently when unavailable.

**Dark theme**
Dark by default, with a light/dark switch in the header that persists across reloads. All colours
come from CSS variables, and the Material UI palette is generated from the same tokens.

**Item lifecycle**
`REPORTED → POSSIBLE_MATCH → CLAIM_REQUESTED → VERIFICATION → RETURNED → CLOSED`, enforced
server-side and rendered as a timeline on the item page.

**Admin module**
Analytics (resolution rate, category breakdown, location hotspots for a heatmap), user blocking
and role changes, report moderation, a dispute queue over all claims, and an append-only audit log.

**Advanced extras already built**
Realtime notifications and chat over Socket.IO · optional college-email verification ·
map coordinates with real distance scoring · semantic description matching and image similarity
via the Python service · location hotspot analytics.

---

## Configuration

Everything has a working default; copy `backend/.env.example` to `backend/.env` to change anything.

```ini
PORT=4000
JWT_SECRET=change-me-in-production
ALLOWED_EMAIL_DOMAINS=          # e.g. campus.edu to restrict registration

DB_CLIENT=sqlite                # sqlite | postgres
DATABASE_URL=postgres://lostfound:lostfound@localhost:5432/lostfound

STORAGE_DRIVER=local            # local | cloudinary

MATCH_WEIGHT_CATEGORY=0.25      # tune the engine without touching code
MATCH_WEIGHT_DESCRIPTION=0.25
MATCH_WEIGHT_LOCATION=0.20
MATCH_WEIGHT_TIME=0.15
MATCH_WEIGHT_IMAGE=0.15
MATCH_MIN_SCORE=45              # below this, no match row is stored
MATCH_STRONG_SCORE=75           # at or above this, users get a "strong match" alert

AI_SERVICE_ENABLED=false        # turn on the Python service
AI_SERVICE_URL=http://localhost:8000
```

After changing weights, re-score the existing matches from the admin dashboard
(**Matches → Re-score everything**) or `POST /api/matches/rescore`.

---

## Repository layout

```
lost-found-tracker/
├── backend/                 Express API, matching engine, data layer
│   └── src/
│       ├── config/          environment loading & validation
│       ├── db/              dual-dialect layer, schemas, migrate, seed
│       ├── matching/        similarity metrics, weighted engine, AI client
│       ├── middleware/      auth, validation, uploads, error handling
│       ├── modules/         auth · items · matches · claims · messages ·
│       │                    notifications · admin  (service + routes each)
│       ├── realtime/        Socket.IO hub
│       └── utils/           shared constants and error helpers
├── frontend/                React app (17 screens)
│   └── src/{api,components,context,hooks,pages,utils}
├── ai-service/              optional FastAPI semantic + image matching
├── scripts/                 demo-flow · ui-smoke · ai-integration-check
├── docs/                    architecture, API, database, matching, demo script
├── deploy/Dockerfile.api    builds UI + API into one image
└── docker-compose.yml       Postgres + API + AI service
```

---

## Development order followed (spec section 14)

1. Database and API structure → 2. auth and roles → 3. reporting with image upload →
4. search, filtering and item details → 5. matching algorithm → 6. claim and ownership
verification → 7. admin dashboard and moderation → 8. notifications and UI polish →
9. AI/image matching last, behind a flag.

The core flow was working before any AI was added — exactly the guidance in section 16 of the
problem statement.
