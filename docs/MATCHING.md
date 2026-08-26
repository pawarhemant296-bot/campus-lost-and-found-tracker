# The Smart Matching Engine

Code: `backend/src/matching/{similarity.js, engine.js, aiClient.js}`

The engine never relies on an exact item name. It scores five factors, each 0–100%, and combines
them with the weights from the problem statement.

| Factor | Weight | What it measures |
| --- | --- | --- |
| Item / category similarity | 25% | same category is a strong signal, blended with title similarity |
| Description similarity | 25% | shared identifying words (optionally a semantic model) |
| Location similarity | 20% | text similarity, upgraded to real distance when both reports have coordinates |
| Date / time proximity | 15% | how close the two events were, with a chronology sanity check |
| Image similarity | 15% | perceptual hash + colour histogram, via the Python service |

Weights are configurable (`MATCH_WEIGHT_*`), and the engine warns at boot if they do not sum to 1.

## Weight redistribution — why a missing photo does not hurt

Most reports have no photo, and the AI service is optional. A naive implementation would score
image similarity as 0% and silently cap every match at 85%.

Instead, a factor that *cannot be evaluated* is marked `skipped` and its weight is redistributed
over the remaining factors:

```
effective_weight(factor) = weight(factor) / Σ weight(non-skipped factors)
```

With no photos, the active weights become category 29.4%, description 29.4%, location 23.5%,
time 17.6% — so a perfect textual match can still reach 100%. The UI states this explicitly on the
"why these two match" panel, so nobody has to guess.

## Text similarity, and why plain Jaccard is not enough

`tokenSimilarity()` normalises text, drops stopwords, applies a tiny stemmer (`keys → key`), and
weights *salient* words — colours, materials, object nouns — double. "black leather wallet" carries
the signal; "I left it there" does not.

Three measures are then combined:

```
0.40 × Dice            symmetric overlap
0.35 × containment     overlap ÷ the shorter description
0.25 × salient coverage how many identifying words of the shorter side matched
```

The reason is asymmetry: the **owner** describes what is inside ("library card, ~400 rupees") while
the **finder** describes what is visible ("on a canteen table near the counter"). Both talk about
the same wallet with very different words and lengths. Dice alone punishes that badly — during
development the demo pair scored 34.8% on description with pure Dice and 70.6% with this blend,
moving the overall match from 74.6% to 87.3%.

`textSimilarity()` finally blends in a character-trigram score (15%) so typos and partial words
still match.

## Location

`locationSimilarity()` returns text similarity, but if **both** reports carry coordinates it uses
the haversine distance instead, on a campus scale: 0 km → 1.0, 2 km → 0.0. The larger of the two
scores wins, and the reason string reports the actual distance (`"0.02 km apart"`).

## Date / time

```
score = 1 − dayGap / MATCH_DATE_WINDOW_DAYS        (default window: 14 days)
```

Plus a chronology check: an item found **more than a day before** it was lost is implausible, so
that score is multiplied by 0.4 rather than rejected outright — people do misremember dates.

## Image similarity

Handled by the Python service (`ai-service/similarity.py`):

- **Average hash (aHash)** — 16×16 greyscale, thresholded at the mean. Agreement between unrelated
  images hovers around 0.5, so the raw value is rescaled: `(score − 0.5) / 0.5`.
- **Colour histogram intersection** — 8×8×8 RGB buckets.
- Final: `0.6 × hash + 0.4 × colour`.

Both images must exist and download successfully; otherwise the factor is skipped.

## Optional semantic description matching

When `AI_SERVICE_ENABLED=true`, `aiClient.js` posts both items to `POST /similarity` and blends the
model score with the lexical one:

```
description = 0.6 × ai_score + 0.4 × lexical_score
```

The service picks the best backend available at start-up:

1. `sentence-transformers` (all-MiniLM-L6-v2) — true semantic similarity
2. scikit-learn TF-IDF over character n-grams — light, no model download
3. pure-Python token overlap — always available

`aiClient` has a 2.5-second timeout and a 30-second circuit breaker. If the service is unreachable
the engine logs one line and continues with local heuristics — verified by
`scripts/ai-integration-check.py`.

## Worked example — the demo wallet

Ananya lost a *black leather wallet* in the *College Canteen, Block B*; four hours later Rahul
reported a found wallet in the *Canteen, Block B*. Both attached coordinates.

| Factor | Score | × weight | Contribution | Reason shown to the user |
| --- | --- | --- | --- | --- |
| Item / category | 87.6% | 25% | 25.8 | Same category: Wallet / Purse |
| Description | 70.6% | 25% | 20.8 | Shared details: black, leather, wallet, right, corner, card |
| Location | 98.8% | 20% | 23.2 | 0.02 km apart |
| Date / time | 99.4% | 15% | 17.5 | Reported on the same day |
| Image | — | 15% | 0 | Skipped — both reports need a photo |
| **Total** | | | **87.3%** | **Strong match** |

Because 87.3% ≥ `MATCH_STRONG_SCORE` (75), both users get a "Strong match found" notification
immediately.

## Thresholds

| Setting | Default | Effect |
| --- | --- | --- |
| `MATCH_MIN_SCORE` | 45 | below this nothing is stored — keeps the queue clean |
| `MATCH_STRONG_SCORE` | 75 | at or above, the notification says "Strong match" |
| `MATCH_DATE_WINDOW_DAYS` | 14 | how quickly date proximity decays |

## When matching runs

- a report is created (`POST /api/items`)
- a scoring-relevant field is edited (title, category, description, location, date, photo, coordinates)
- on demand: `POST /api/items/:id/rematch`, or `POST /api/matches/rescore` for everything (admin)

Matches are stored with a `UNIQUE (lost_item_id, found_item_id)` constraint and upserted, so
re-running the engine updates scores instead of creating duplicates. Items that reached `RETURNED`
or `CLOSED` leave the candidate pool, and users are never matched against their own reports.

## Inspecting scores without storing them

`GET /api/items/:id/match-preview` scores an item against every candidate and returns the ranked
list with full breakdowns — useful for tuning weights or explaining the algorithm during a demo.
