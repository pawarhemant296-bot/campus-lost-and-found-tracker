# AI matching service (optional)

Refines two of the five matching factors: **semantic description similarity** and
**image similarity**. The Node backend works perfectly without it — this service is a
differentiator, not a dependency (spec section 16).

## Run it

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
```

Then point the backend at it:

```ini
# backend/.env
AI_SERVICE_ENABLED=true
AI_SERVICE_URL=http://localhost:8000
```

Existing matches keep their old scores until you re-score them: admin dashboard →
**Matches → Re-score everything** (or `POST /api/matches/rescore`).

## Backends, chosen automatically at start-up

| Tier | Requirement | Quality |
| --- | --- | --- |
| `sentence-transformers:all-MiniLM-L6-v2` | `pip install -r requirements-ml.txt` (~500 MB) | true semantic similarity |
| `sklearn:tfidf-char_wb` | `requirements.txt` | character n-gram cosine, typo tolerant |
| `fallback:token-overlap` | nothing | pure Python, always available |

`GET /health` reports which one is active.

## Endpoints

### `GET /health`

```json
{ "status": "ok", "service": "lost-found-ai", "model": "sklearn:tfidf-char_wb", "image_matching": true }
```

### `POST /similarity`

```json
{
  "lost":  { "title": "Black leather wallet", "category": "Wallet / Purse", "description": "...", "image_url": null },
  "found": { "title": "Wallet found in canteen", "category": "Wallet / Purse", "description": "...", "image_url": null }
}
```

```json
{ "description_similarity": 0.628, "image_similarity": null, "model": "sklearn:tfidf-char_wb", "took_ms": 12 }
```

`image_similarity: null` means "not comparable" (missing URL, download failure, or Pillow absent) —
the backend then marks the image factor as *skipped* and redistributes its weight.

### `POST /similarity/batch`

Takes an array of the same payload; used when re-scoring many pairs.

## How the scores are produced

- **Text** — see the table above. The backend blends the result with its own lexical score
  (`0.6 × ai + 0.4 × lexical`) so a model quirk can never wipe out an obvious keyword match.
- **Images** — average hash (16×16 greyscale, thresholded at the mean, rescaled because unrelated
  images already agree on ~50% of bits) combined with an 8×8×8 RGB histogram intersection:
  `0.6 × hash + 0.4 × colour`. Downloads are capped at 6 MB and restricted to http(s).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_TEXT_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model name |
| `AI_IMAGE_MATCHING` | `true` | set `false` to skip image downloads entirely |
| `AI_IMAGE_TIMEOUT` | `6` | per-image download timeout in seconds |
| `PORT` | `8000` | |

## Tests

```bash
.venv/bin/pip install pytest httpx
.venv/bin/python -m pytest -q          # 5 tests
```

They assert that the matching wallet pair scores higher than an unrelated pair, that image
similarity ranks near-identical images above different ones (over a temporary local HTTP server),
and that missing images are reported as `null`.

To prove the wiring from the Node side, including graceful degradation when this service is down:

```bash
.venv/bin/python ../scripts/ai-integration-check.py
```

## Docker

```bash
docker build -t lost-found-ai .                                        # light tier
docker build --build-arg REQUIREMENTS=requirements-ml.txt -t lost-found-ai .   # with embeddings
```

`docker compose up` in the repository root starts this service alongside the API.
